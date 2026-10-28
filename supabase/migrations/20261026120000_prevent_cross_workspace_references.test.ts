import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S5 fix (rows must not reference
// records of a different workspace, including under concurrent requests).
// The real behavior is proven against a real local Postgres, which isn't
// wired into CI:
//   * supabase/tests/cross_workspace_references.sql (`npm run test:rls:local`)
//     -- every cross-workspace INSERT/UPDATE refused for single- and
//     dual-workspace members, referenced records not movable from under
//     their references, same-workspace operations, deletions and ON DELETE
//     SET NULL unchanged, no policy recursion;
//   * scripts/test-cross-workspace-races-local.sh -- two real sessions racing
//     a reference write against a move, for all 10 relationships in both
//     directions, with controls that reproduce the race without the triggers.
// What this file guarantees in CI is the migration's shape, and that no later
// migration re-creates a write policy without its same-workspace condition,
// re-introduces the recursive policy shape, or removes / weakens / disables
// any of the 13 triggers.
//
// Known limitation (documented, not hidden): a text scan cannot see policies
// or triggers changed outside migrations (dashboard / SQL editor). The
// post-deploy check scripts/verify-cross-workspace-references.sql reads the
// live policies, triggers and functions and is the backstop.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261026120000_prevent_cross_workspace_references.sql";
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const sql = read(MIGRATION_FILE);

const FUNCTION_DEF = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+("?public"?\s*\.\s*)?"?(\w+)"?\s*\([^)]*\)([\s\S]*?)\$([A-Za-z_]*)\$([\s\S]*?)\$\4\$\s*;/gi;

// [trigger, table, function, events, lock clause the function must take]
const REFERENCE_TRIGGERS: Array<[string, string, string, string, string]> = [
  ["trg_appointments_same_workspace_refs", "appointments", "same_workspace_appointment_refs", 'INSERT OR UPDATE OF "client_id", "workspace_id"', "FOR KEY SHARE"],
  ["trg_visits_same_workspace_refs", "visits", "same_workspace_visit_refs", 'INSERT OR UPDATE OF "client_id", "appointment_id", "workspace_id"', "FOR KEY SHARE"],
  ["trg_appointment_services_same_workspace_refs", "appointment_services", "same_workspace_appointment_service_refs", "INSERT OR UPDATE", "FOR KEY SHARE OF a, s"],
  ["trg_client_tags_same_workspace_refs", "client_tags", "same_workspace_client_tag_refs", "INSERT OR UPDATE", "FOR KEY SHARE OF c, t"],
  ["trg_ai_history_same_workspace_refs", "ai_history", "same_workspace_ai_history_refs", 'INSERT OR UPDATE OF "client_id", "workspace_id"', "FOR KEY SHARE"],
  ["trg_revenues_same_workspace_refs", "revenues", "same_workspace_revenue_refs", 'INSERT OR UPDATE OF "visit_id", "workspace_id"', "FOR KEY SHARE"],
  ["trg_expenses_same_workspace_refs", "expenses", "same_workspace_expense_refs", 'INSERT OR UPDATE OF "receipt_file_id", "workspace_id"', "FOR KEY SHARE"],
];
const MOVE_TRIGGERS: Array<[string, string, string]> = [
  ["trg_clients_same_workspace_move", "clients", "same_workspace_client_move"],
  ["trg_services_same_workspace_move", "services", "same_workspace_service_move"],
  ["trg_tags_same_workspace_move", "tags", "same_workspace_tag_move"],
  ["trg_appointments_same_workspace_move", "appointments", "same_workspace_appointment_move"],
  ["trg_visits_same_workspace_move", "visits", "same_workspace_visit_move"],
  ["trg_files_same_workspace_move", "files", "same_workspace_file_move"],
];
const ALL_TRIGGERS = [...REFERENCE_TRIGGERS.map(([t, tb, f]) => [t, tb, f]), ...MOVE_TRIGGERS];
const TRIGGER_FUNCTIONS = ALL_TRIGGERS.map(([, , f]) => f);
// What each move guard must check for (tables read after taking FOR UPDATE).
const MOVE_GUARD_READS: Record<string, string[]> = {
  same_workspace_client_move: ["appointments", "visits", "ai_history", "client_tags"],
  same_workspace_service_move: ["appointment_services"],
  same_workspace_tag_move: ["client_tags"],
  same_workspace_appointment_move: ["visits", "appointment_services"],
  same_workspace_visit_move: ["revenues"],
  same_workspace_file_move: ["expenses"],
};
// Nullable references whose function must skip NULL (ON DELETE SET NULL).
const NULL_SKIPS: Record<string, string> = {
  same_workspace_visit_refs: "NEW.appointment_id IS NOT NULL",
  same_workspace_revenue_refs: "NEW.visit_id IS NOT NULL",
  same_workspace_expense_refs: "NEW.receipt_file_id IS NOT NULL",
};

// Per policy: the tables its write check must consult.
const REQUIRED_REFERENCES: Record<string, { table: string; mustRead: string[] }> = {
  appointments_access: { table: "appointments", mustRead: ["clients", "visits"] },
  visits_access: { table: "visits", mustRead: ["clients", "appointments", "revenues"] },
  appointment_services_access: { table: "appointment_services", mustRead: ["appointments", "services"] },
  client_tags_access: { table: "client_tags", mustRead: ["clients", "tags"] },
  ai_history_access: { table: "ai_history", mustRead: ["clients"] },
  revenues_access: { table: "revenues", mustRead: ["visits"] },
  expenses_access: { table: "expenses", mustRead: ["files"] },
  clients_access: { table: "clients", mustRead: ["appointments", "visits", "ai_history"] },
  services_access: { table: "services", mustRead: ["appointment_services"] },
  tags_access: { table: "tags", mustRead: ["client_tags"] },
  files_access: { table: "files", mustRead: ["expenses"] },
};
// Reading these from the named table's own policy is infinite recursion (42P17).
const RECURSIVE_READS: Record<string, string> = { clients: "client_tags", appointments: "appointment_services" };
const GUARDED_TABLES = new Set(Object.values(REQUIRED_REFERENCES).map((r) => r.table));

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function plain(text: string): string {
  return squash(text.replace(/"/g, "")).toLowerCase();
}

function statements(text: string): string[] {
  return stripComments(text).replace(FUNCTION_DEF, " ").split(";").map(squash).filter(Boolean);
}

function functionDefs(text: string): Array<{ name: string; header: string; body: string }> {
  return [...stripComments(text).matchAll(FUNCTION_DEF)].map((m) => ({ name: m[2].toLowerCase(), header: squash(m[3]), body: squash(m[5]) }));
}

// Tables named after FROM/JOIN (or in a FROM list) in a clause.
function tablesRead(clause: string): Set<string> {
  const p = plain(clause);
  const names = [...p.matchAll(/\b(?:from|join)\s+(?:public\.)?(\w+)/g)].map((m) => m[1]);
  for (const list of p.matchAll(/\bfrom\s+([\w.]+\s+\w+(?:\s*,\s*[\w.]+\s+\w+)+)/g)) {
    for (const item of list[1].split(",")) names.push(item.trim().replace(/^public\./, "").split(/\s+/)[0]);
  }
  return new Set(names);
}

// Everything that would re-open S5, re-introduce the recursion, or weaken the triggers.
function s5Regressions(text: string): string[] {
  const problems: string[] = [];
  for (const statement of statements(text)) {
    const p = plain(statement);
    const policy = /^(create|alter) policy (\S+) on (?:public\.)?(\w+)\b(.*)$/.exec(p);
    if (policy && GUARDED_TABLES.has(policy[3])) {
      const [, verb, name, table, clause] = policy;
      const cmd = /\bfor (all|select|insert|update|delete)\b/.exec(clause)?.[1] ?? (verb === "create" ? "all" : "unknown");
      const hasCheck = /\bwith check\b/.test(clause);
      const required = Object.values(REQUIRED_REFERENCES).find((r) => r.table === table)!;
      if (verb === "create" && (cmd === "all" || cmd === "insert" || cmd === "update") && !hasCheck) {
        problems.push(`${table}: write policy ${name} without a same-workspace WITH CHECK`);
      } else if (hasCheck) {
        const reads = tablesRead(clause.slice(clause.indexOf("with check")));
        const missing = required.mustRead.filter((t) => !reads.has(t));
        if (missing.length) problems.push(`${table}: WITH CHECK of ${name} does not read ${missing.join(", ")}`);
        if (RECURSIVE_READS[table] && reads.has(RECURSIVE_READS[table])) {
          problems.push(`${table}: WITH CHECK of ${name} reads ${RECURSIVE_READS[table]} (infinite policy recursion)`);
        }
      }
    }
    for (const [trigger, table, fn] of ALL_TRIGGERS) {
      if (new RegExp(`^drop trigger (if exists )?${trigger}\\b`).test(p)) problems.push(`drops trigger ${trigger}`);
      if (new RegExp(`^alter table (only )?(public\\.)?${table} disable trigger (${trigger}|all|user)\\b`).test(p)) {
        problems.push(`disables trigger ${trigger} on ${table}`);
      }
      if (new RegExp(`^drop function (if exists )?(public\\.)?${fn}\\b`).test(p)) problems.push(`drops function ${fn}`);
    }
    if (/^grant\b.*\bon function\b.*\bsame_workspace_\w+\b.*\bto\b.*\b(anon|authenticated|public)\b/.test(p.replace(/public\./g, ""))) {
      problems.push("grants EXECUTE on a same_workspace trigger function to a client role");
    }
  }
  for (const def of functionDefs(text)) {
    if (!TRIGGER_FUNCTIONS.includes(def.name)) continue;
    if (/\bsecurity definer\b/i.test(def.header)) problems.push(`${def.name} redefined as SECURITY DEFINER`);
    const ref = REFERENCE_TRIGGERS.find(([, , f]) => f === def.name);
    if (ref && !def.body.includes(ref[4])) problems.push(`${def.name} no longer takes ${ref[4]}`);
    if (!ref && !/FOR UPDATE/.test(def.body)) problems.push(`${def.name} no longer takes FOR UPDATE`);
    if (!/ERRCODE = '42501'/.test(def.body)) problems.push(`${def.name} no longer refuses with 42501`);
  }
  return problems;
}

describe("20261026120000_prevent_cross_workspace_references.sql (structural regression coverage)", () => {
  const policyStatements = statements(sql).filter((s) => /^ALTER POLICY/i.test(s));
  const defs = functionDefs(sql);

  it("alters exactly the 11 *_access policies, each with a WITH CHECK and no USING change", () => {
    const targets = policyStatements.map((s) => /^ALTER POLICY "(\w+)" ON "public"\."(\w+)"/.exec(s)!.slice(1, 3).join("@"));
    expect(targets.sort()).toEqual(Object.entries(REQUIRED_REFERENCES).map(([name, r]) => `${name}@${r.table}`).sort());
    for (const statement of policyStatements) {
      expect(statement).toMatch(/ WITH CHECK \(/);
      expect(statement).not.toMatch(/\bUSING\b/);
    }
  });

  it("every WITH CHECK keeps the membership check and reads the referenced tables", () => {
    for (const statement of policyStatements) {
      const name = /^ALTER POLICY "(\w+)"/.exec(statement)![1];
      expect(plain(statement)).toContain("public.is_workspace_member(");
      const reads = tablesRead(statement);
      for (const table of REQUIRED_REFERENCES[name].mustRead) expect(reads, `${name} must read ${table}`).toContain(table);
    }
  });

  it("does not use the recursive policy shape (clients reading client_tags, appointments reading appointment_services)", () => {
    for (const statement of policyStatements) {
      const table = /ON "public"\."(\w+)"/.exec(statement)![1];
      if (RECURSIVE_READS[table]) expect(tablesRead(statement)).not.toContain(RECURSIVE_READS[table]);
    }
  });

  it("defines exactly the 13 trigger functions as SECURITY INVOKER plpgsql with a pinned search_path", () => {
    expect(defs.map((d) => d.name).sort()).toEqual([...TRIGGER_FUNCTIONS].sort());
    for (const def of defs) {
      expect(def.header, def.name).toBe(`RETURNS trigger LANGUAGE "plpgsql" SET "search_path" TO 'public' AS`);
      expect(def.body, def.name).toMatch(/USING ERRCODE = '42501'/);
    }
    expect(stripComments(sql)).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("reference-side functions lock the referenced rows FOR KEY SHARE, filtered to the same workspace, and skip NULL references", () => {
    for (const [, , fn, , lock] of REFERENCE_TRIGGERS) {
      const body = defs.find((d) => d.name === fn)!.body;
      expect(body, fn).toContain(lock);
      expect(body, fn).toMatch(/workspace_id = (NEW|a|c)\.workspace_id/);
      expect(body, fn).toMatch(/IF NOT FOUND THEN/);
      if (NULL_SKIPS[fn]) expect(body, fn).toContain(NULL_SKIPS[fn]);
    }
  });

  it("move-side functions lock the moving row FOR UPDATE first, then check every reference to it", () => {
    for (const [, table, fn] of MOVE_TRIGGERS) {
      const body = defs.find((d) => d.name === fn)!.body;
      const lock = body.indexOf(`PERFORM 1 FROM public.${table} WHERE id = OLD.id FOR UPDATE;`);
      expect(lock, fn).toBeGreaterThan(-1);
      expect(lock, fn).toBeLessThan(body.indexOf("IF EXISTS"));
      const reads = tablesRead(body.slice(body.indexOf("IF EXISTS")));
      for (const t of MOVE_GUARD_READS[fn]) expect(reads, `${fn} must check ${t}`).toContain(t);
      expect(body, fn).toMatch(/workspace_id <> NEW\.workspace_id/);
    }
  });

  it("creates exactly the 13 triggers on the reviewed events (move side only when workspace_id changes)", () => {
    const triggers = statements(sql).filter((s) => /^CREATE TRIGGER/i.test(s));
    expect(triggers).toEqual([
      ...REFERENCE_TRIGGERS.map(
        ([name, table, fn, events]) => `CREATE TRIGGER "${name}" BEFORE ${events} ON "public"."${table}" FOR EACH ROW EXECUTE FUNCTION "public"."${fn}"()`,
      ),
      ...MOVE_TRIGGERS.map(
        ([name, table, fn]) =>
          `CREATE TRIGGER "${name}" BEFORE UPDATE OF "workspace_id" ON "public"."${table}" FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id") EXECUTE FUNCTION "public"."${fn}"()`,
      ),
    ]);
  });

  it("on tables with both kinds, the move guard sorts (and so fires) before the reference check", () => {
    for (const table of ["appointments", "visits"]) {
      expect(`trg_${table}_same_workspace_move` < `trg_${table}_same_workspace_refs`).toBe(true);
    }
  });

  it("otherwise only revokes EXECUTE on the 13 functions -- no GRANT, table, column, or data change", () => {
    const others = statements(sql).filter((s) => !/^(ALTER POLICY|CREATE TRIGGER)/i.test(s));
    expect(others).toEqual([
      `REVOKE ALL ON FUNCTION ${TRIGGER_FUNCTIONS.map((f) => `"public"."${f}"()`).join(", ")} FROM PUBLIC, "anon", "authenticated"`,
    ]);
    expect(stripComments(sql)).not.toMatch(/\bGRANT\b/i);
  });
});

describe("migration-order guard: no migration re-opens cross-workspace references", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["re-created FOR ALL policy without WITH CHECK", 'CREATE POLICY "appointments_access" ON "public"."appointments" USING ("public"."is_workspace_member"("workspace_id"));'],
    ["INSERT policy without WITH CHECK", "CREATE POLICY p ON public.visits FOR INSERT TO authenticated;"],
    ["WITH CHECK that only checks membership", 'ALTER POLICY "revenues_access" ON "public"."revenues" WITH CHECK ("public"."is_workspace_member"("workspace_id"));'],
    ["WITH CHECK missing one referenced table", "ALTER POLICY visits_access ON public.visits WITH CHECK (is_workspace_member(workspace_id) AND EXISTS (SELECT 1 FROM clients c WHERE c.id = client_id));"],
    ["recursive clients check", "ALTER POLICY clients_access ON public.clients WITH CHECK (is_workspace_member(workspace_id) AND NOT EXISTS (SELECT 1 FROM appointments a) AND NOT EXISTS (SELECT 1 FROM visits v) AND NOT EXISTS (SELECT 1 FROM ai_history h) AND NOT EXISTS (SELECT 1 FROM client_tags ct));"],
    ["recursive appointments check", "ALTER POLICY appointments_access ON public.appointments WITH CHECK (EXISTS (SELECT 1 FROM clients c) AND NOT EXISTS (SELECT 1 FROM visits v) AND NOT EXISTS (SELECT 1 FROM appointment_services x));"],
    ["drop a reference-side trigger", "DROP TRIGGER IF EXISTS trg_revenues_same_workspace_refs ON public.revenues;"],
    ["drop a move-side trigger", "DROP TRIGGER trg_files_same_workspace_move ON public.files;"],
    ["disable one trigger", "ALTER TABLE public.client_tags DISABLE TRIGGER trg_client_tags_same_workspace_refs;"],
    ["disable all triggers", "ALTER TABLE ONLY public.tags DISABLE TRIGGER ALL;"],
    ["drop a trigger function", 'DROP FUNCTION "public"."same_workspace_visit_move"();'],
    ["grant a trigger function to authenticated", 'GRANT EXECUTE ON FUNCTION "public"."same_workspace_tag_move"() TO "authenticated";'],
    [
      "function redefined as SECURITY DEFINER",
      `CREATE OR REPLACE FUNCTION public.same_workspace_client_move() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM 1 FROM public.clients WHERE id = OLD.id FOR UPDATE; RAISE EXCEPTION 'x' USING ERRCODE = '42501'; END; $$;`,
    ],
    [
      "reference function without its lock",
      `CREATE OR REPLACE FUNCTION public.same_workspace_expense_refs() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.files f WHERE f.id = NEW.receipt_file_id) THEN RAISE EXCEPTION 'x' USING ERRCODE = '42501'; END IF; RETURN NEW; END; $$;`,
    ],
    ["move function weakened", "CREATE OR REPLACE FUNCTION public.same_workspace_tag_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;"],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["this migration itself", sql],
    ["SELECT-only policy", "CREATE POLICY p ON public.clients FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));"],
    ["DELETE policy", "CREATE POLICY p ON public.tags FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));"],
    ["write policy on an unrelated table", 'CREATE POLICY "workspace_settings_access" ON "public"."workspace_settings" USING ("public"."is_workspace_member"("workspace_id"));'],
    ["complete expenses check", "ALTER POLICY expenses_access ON public.expenses WITH CHECK (is_workspace_member(workspace_id) AND (receipt_file_id IS NULL OR EXISTS (SELECT 1 FROM files f WHERE f.id = receipt_file_id)));"],
    ["commented-out policy", "-- CREATE POLICY p ON public.visits USING (true);\nSELECT 1;"],
    ["unrelated trigger", "DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;"],
    ["grant to service_role", 'GRANT EXECUTE ON FUNCTION "public"."same_workspace_tag_move"() TO "service_role";'],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(s5Regressions(text).length).toBeGreaterThan(0);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(s5Regressions(text)).toEqual([]);
  });

  it("against the real migration corpus: flags exactly the 11 original WITH-CHECK-less policies, and nothing else", () => {
    const hits = files.flatMap((file) => s5Regressions(read(file)).map((p) => `${file}: ${p}`));
    expect(hits.sort()).toEqual(
      [
        ...["ai_history", "appointments", "clients", "expenses", "files", "revenues", "services", "tags", "visits"].map(
          (t) => `20260722092124_name_of_your_migration.sql: ${t}: write policy ${t}_access without a same-workspace WITH CHECK`,
        ),
        "20260724100000_add_missing_rls_policies.sql: appointment_services: write policy appointment_services_access without a same-workspace WITH CHECK",
        "20260724100000_add_missing_rls_policies.sql: client_tags: write policy client_tags_access without a same-workspace WITH CHECK",
      ].sort(),
    );
  });

  it("REGRESSION: no migration at or after this one re-opens cross-workspace references", () => {
    for (const file of files.slice(files.indexOf(MIGRATION_FILE))) {
      expect(s5Regressions(read(file)), `${file} reopens S5`).toEqual([]);
    }
  });
});
