import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S1 fix (workspace members must not
// be able to change plan/billing/trial/ownership columns via the public
// API). The real privilege behavior -- an `authenticated` member actually
// being refused, service_role still allowed, onboarding still working -- is
// proven against a real local Postgres by
// supabase/tests/workspace_protected_columns.sql (`npm run test:rls:local`),
// which isn't wired into CI. What this file guarantees in CI is that the
// SQL keeps the exact shape those guarantees depend on, and that no later
// migration lets authenticated/anon/PUBLIC update a protected workspaces
// column again -- via a table-wide or column-level grant, ALL TABLES IN
// SCHEMA, a multi-table or unqualified grant, or a literal/dynamic GRANT
// inside a DO block or function.
//
// Known limitation (documented, not hidden): a text scan cannot see grants
// whose GRANT keyword or role name is itself computed at runtime, or grants
// made outside migrations (dashboard / SQL editor). The post-deploy check
// scripts/verify-workspace-protected-columns.sql reads the live privileges
// and is the backstop for both.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261011120000_restrict_workspace_protected_columns.sql";
const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), "utf-8");
const workspacesService = readFileSync(join(MIGRATIONS_DIR, "../../src/services/workspaces.ts"), "utf-8");

const PROTECTED_COLUMNS = [
  "plan_tier",
  "subscription_status",
  "trial_ends_at",
  "trial_started_at",
  "owner_id",
  "id",
  "slug",
  "created_at",
  "updated_at",
];

const PROTECTED_COLUMN_SET = new Set(PROTECTED_COLUMNS);
// PUBLIC is the pseudo-role every role (anon and authenticated included)
// inherits from, so a grant to it is as dangerous as a grant to either.
const CLIENT_ROLES = new Set(["authenticated", "anon", "public"]);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

// Splits SQL into statements (comments removed). Good enough for this
// migration's own shape checks; the guard below does NOT rely on it.
function statements(text: string): string[] {
  return stripComments(text)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unquote(identifier: string): string {
  return identifier.trim().replace(/"/g, "").toLowerCase();
}

type GrantClause = { privileges: string; objects: string; grantees: string };

// Every `GRANT <privileges> ON <objects> TO <grantees>` clause anywhere in
// the text -- top-level statements AND literal strings run by EXECUTE inside
// DO blocks or function bodies (a clause ends at `;` or a quote, so
// `EXECUTE 'GRANT ... TO authenticated'` is parsed like a plain statement).
// REVOKE ... FROM never matches (no TO), and `GRANTED BY` is excluded by \b.
function grantClauses(text: string): GrantClause[] {
  const flat = stripComments(text).replace(/\s+/g, " ");
  return [...flat.matchAll(/\bGRANT\s+([^;']+?)\s+ON\s+([^;']+?)\s+TO\s+([^;']+)/gi)].map((m) => ({
    privileges: m[1],
    objects: m[2],
    grantees: m[3],
  }));
}

// Does the ON-clause cover public.workspaces? Covers `ALL TABLES IN SCHEMA
// public`, multi-table lists, and unqualified `workspaces` (treated as
// public.workspaces -- the only schema this project puts it in). Default
// privileges (`ON TABLES`), functions, sequences, schemas, and other
// schemas' tables (e.g. private.workspaces) don't.
function coversWorkspaces(objects: string): boolean {
  const target = objects.trim().replace(/^TABLE\s+/i, "");
  const allTables = target.match(/^ALL\s+TABLES\s+IN\s+SCHEMA\s+(.+)$/i);
  if (allTables) return allTables[1].split(",").map(unquote).includes("public");
  if (/^(ALL\s+\w+|TABLES|FUNCTIONS?|PROCEDURES?|ROUTINES?|SEQUENCES?|SCHEMA|DATABASE|DOMAIN|TYPE|LANGUAGE|LARGE\s+OBJECT|FOREIGN|TABLESPACE|PARAMETER)\b/i.test(target)) {
    return false;
  }
  return target.split(",").map(unquote).some((name) => name === "workspaces" || name === "public.workspaces");
}

function grantsToClientRole(grantees: string): boolean {
  const list = grantees.split(/\b(?:WITH|GRANTED)\b/i)[0];
  return list.split(",").map(unquote).some((role) => CLIENT_ROLES.has(role));
}

// Dangerous privilege: table-wide ALL / UPDATE, or a column-level
// ALL / UPDATE whose column list includes a protected column (that would
// reopen S1 just as surely as a table-wide grant).
function reopensProtectedUpdate(privileges: string): boolean {
  for (const part of privileges.split(/,(?![^(]*\))/)) {
    const m = part.trim().match(/^(ALL(?:\s+PRIVILEGES)?|UPDATE)\s*(?:\(([^)]*)\))?$/i);
    if (!m) continue;
    if (m[2] === undefined) return true;
    if (m[2].split(",").map(unquote).some((column) => PROTECTED_COLUMN_SET.has(column))) return true;
  }
  return false;
}

// Static guard: every GRANT clause (incl. literal EXECUTE strings) that
// would let authenticated/anon/PUBLIC update a protected workspaces column.
function dangerousWorkspacesGrants(text: string): string[] {
  return grantClauses(text)
    .filter((g) => coversWorkspaces(g.objects) && grantsToClientRole(g.grantees) && reopensProtectedUpdate(g.privileges))
    .map((g) => `GRANT ${g.privileges} ON ${g.objects} TO ${g.grantees}`.trim());
}

// Conservative dynamic-SQL guard: a dollar-quoted body (DO block / function)
// that EXECUTEs anything containing GRANT and mentions a client role. Its
// table/privileges may be computed (format(), concatenation, a loop over
// pg_tables), so it can't be checked statically -- flag it for human review
// instead. Limitation: dynamic SQL that also computes the word GRANT or the
// role name (e.g. from a variable) cannot be detected by any text scan; the
// read-only scripts/verify-workspace-protected-columns.sql check after
// deployment is the backstop for that, and for grants made outside
// migrations (dashboard / SQL editor).
function dynamicClientRoleGrants(text: string): string[] {
  const bodies = [...stripComments(text).matchAll(/\$([A-Za-z_]*)\$([\s\S]*?)\$\1\$/g)].map((m) => m[2]);
  return bodies.filter(
    (body) => /\bEXECUTE\b/i.test(body) && /\bGRANT\b/i.test(body) && /\b(authenticated|anon)\b|\bTO\s+PUBLIC\b/i.test(body),
  );
}

function grantedUpdateColumns(text: string): string[] {
  const grant = statements(text).find((s) => /^GRANT UPDATE \(/i.test(s) && /"?workspaces"? TO "?authenticated"?$/i.test(s));
  if (!grant) return [];
  const list = grant.match(/UPDATE \(([^)]*)\)/i)![1];
  return list.split(",").map((c) => c.replace(/"/g, "").trim()).filter(Boolean);
}

function updatableWorkspaceFieldsFromService(): string[] {
  const block = workspacesService.match(/const UPDATABLE_WORKSPACE_FIELDS = \[([\s\S]*?)\] as const/);
  if (!block) throw new Error("UPDATABLE_WORKSPACE_FIELDS not found in src/services/workspaces.ts");
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("20261011120000_restrict_workspace_protected_columns.sql (structural regression coverage)", () => {
  it("revokes table-wide UPDATE on public.workspaces from both authenticated and anon", () => {
    const stmts = statements(sql);
    expect(stmts).toContain('REVOKE UPDATE ON TABLE "public"."workspaces" FROM "authenticated"');
    expect(stmts).toContain('REVOKE UPDATE ON TABLE "public"."workspaces" FROM "anon"');
  });

  it("grants UPDATE to authenticated on exactly the columns updateWorkspace() allows -- the SQL grant and the app allowlist can't drift apart", () => {
    const granted = grantedUpdateColumns(sql);
    const allowlisted = updatableWorkspaceFieldsFromService();
    expect(allowlisted.length).toBeGreaterThan(0);
    expect([...granted].sort()).toEqual([...allowlisted].sort());
    expect(granted).toEqual(["name", "display_brand", "timezone", "currency", "locale", "city", "district", "business_type"]);
  });

  it("REGRESSION: never grants UPDATE on a protected plan/billing/trial/ownership/identity column", () => {
    const granted = grantedUpdateColumns(sql);
    for (const column of PROTECTED_COLUMNS) {
      expect(granted, `protected column "${column}" must not be client-updatable`).not.toContain(column);
    }
  });

  it("grants nothing at all to anon, and no table-wide UPDATE to anyone", () => {
    const grants = statements(sql).filter((s) => /^GRANT/i.test(s));
    expect(grants).toHaveLength(1);
    for (const grant of grants) {
      expect(grant).not.toMatch(/\banon\b/i);
    }
    expect(dangerousWorkspacesGrants(sql)).toEqual([]);
  });

  it("changes nothing else -- no RLS policy, DELETE, INSERT, or other-table statements", () => {
    const stmts = statements(sql);
    expect(stmts).toHaveLength(3);
    for (const statement of stmts) {
      expect(statement).not.toMatch(/\bPOLICY\b|\bDELETE\b|\bINSERT\b|\bROW LEVEL SECURITY\b/i);
      expect(statement).toMatch(/"public"\."workspaces"/);
    }
  });
});

describe("migration-order guard: no later migration lets client roles update protected workspace columns again", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const flagged = (text: string) => dangerousWorkspacesGrants(text).length > 0 || dynamicClientRoleGrants(text).length > 0;

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  // Each form the guard claims to catch, checked against the real detector.
  const MUST_FLAG: Array<[string, string]> = [
    ["baseline form: GRANT ALL ON TABLE (quoted) to authenticated", 'GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";'],
    ["baseline form: GRANT ALL ON TABLE (quoted) to anon", 'GRANT ALL ON TABLE "public"."workspaces" TO "anon";'],
    ["UPDATE without TABLE keyword, unquoted", "GRANT UPDATE ON public.workspaces TO authenticated;"],
    ["privilege list containing UPDATE", 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."workspaces" TO "authenticated";'],
    ["ALL PRIVILEGES", "GRANT ALL PRIVILEGES ON TABLE public.workspaces TO anon;"],
    ["multi-line, lowercase", 'grant all\n  on table "public"."workspaces"\n  to "authenticated";'],
    ["WITH GRANT OPTION", 'GRANT ALL ON TABLE "public"."workspaces" TO "authenticated" WITH GRANT OPTION;'],
    ["multiple grantees", 'GRANT ALL ON TABLE "public"."workspaces" TO "anon", "authenticated", "service_role";'],
    ["gap 1: ALL TABLES IN SCHEMA public", "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;"],
    ["gap 1: ALL TABLES IN SCHEMA (quoted, multiple schemas)", 'GRANT UPDATE ON ALL TABLES IN SCHEMA "extensions", "public" TO "anon";'],
    ["gap 2: grantee PUBLIC", "GRANT UPDATE ON TABLE public.workspaces TO PUBLIC;"],
    ["gap 2: PUBLIC among other grantees", 'GRANT ALL ON TABLE "public"."workspaces" TO "service_role", PUBLIC;'],
    ["gap 3: multi-table list including workspaces", "GRANT ALL ON TABLE public.clients, public.workspaces TO authenticated;"],
    ["gap 3: multi-table list, workspaces first, quoted", 'GRANT UPDATE ON "public"."workspaces", "public"."clients" TO "authenticated";'],
    ["gap 4: unqualified table name", "GRANT ALL ON TABLE workspaces TO authenticated;"],
    ["gap 4: unqualified, quoted, no TABLE keyword", 'GRANT UPDATE ON "workspaces" TO "anon";'],
    ["gap 5: literal EXECUTE in a DO block", "DO $$ BEGIN EXECUTE 'GRANT ALL ON TABLE public.workspaces TO authenticated'; END $$;"],
    ["gap 5: literal EXECUTE in a function body", "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN EXECUTE 'GRANT UPDATE ON workspaces TO anon'; END $fn$;"],
    ["gap 5: computed EXECUTE format(...) to a client role", "DO $$ BEGIN EXECUTE format('GRANT %s ON %I TO authenticated', 'ALL', 'workspaces'); END $$;"],
    ["gap 5: loop over pg_tables granting to a client role", "DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE 'GRANT ALL ON public.' || quote_ident(r.tablename) || ' TO anon'; END LOOP; END $$;"],
    ["column-level grant that includes a protected column", 'GRANT UPDATE ("name", "plan_tier") ON TABLE "public"."workspaces" TO "authenticated";'],
    ["column-level ALL that includes a protected column", "GRANT ALL (owner_id) ON public.workspaces TO authenticated;"],
  ];

  // Forms that must stay unflagged (no false positives).
  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["service_role only", 'GRANT ALL ON TABLE "public"."workspaces" TO "service_role";'],
    ["column-level UPDATE on allowed columns (this migration's own grant)", 'GRANT UPDATE ("name", "locale") ON TABLE "public"."workspaces" TO "authenticated";'],
    ["column-level UPDATE without a space", "GRANT UPDATE(name) ON public.workspaces TO authenticated;"],
    ["unrelated table workspace_staff", 'GRANT ALL ON TABLE "public"."workspace_staff" TO "authenticated";'],
    ["unrelated table workspace_settings", "GRANT ALL ON TABLE public.workspace_settings TO anon;"],
    ["same table name in another schema", "GRANT ALL ON TABLE private.workspaces TO authenticated;"],
    ["SELECT only", 'GRANT SELECT ON TABLE "public"."workspaces" TO "anon";'],
    ["line comment", '-- GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";\nSELECT 1;'],
    ["block comment", '/* GRANT ALL ON TABLE "public"."workspaces" TO "authenticated"; */ SELECT 1;'],
    ["default privileges for future tables", 'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";'],
    ["ALL TABLES in a different schema", "GRANT ALL ON ALL TABLES IN SCHEMA extensions TO authenticated;"],
    ["function grant", 'GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "authenticated";'],
    ["REVOKE (this migration's own statements)", 'REVOKE UPDATE ON TABLE "public"."workspaces" FROM "authenticated";'],
    ["dynamic grant to service_role only", "DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.clients TO service_role'; END $$;"],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(flagged(text)).toBe(true);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(flagged(text)).toBe(false);
  });

  it("against the real migration corpus: flags exactly the baseline's original grants, and nothing else", () => {
    const hits = files.flatMap((file) => [
      ...dangerousWorkspacesGrants(read(file)).map((g) => `${file}: ${g}`),
      ...dynamicClientRoleGrants(read(file)).map(() => `${file}: dynamic GRANT to a client role`),
    ]);
    expect(hits).toEqual([
      '20260722092124_name_of_your_migration.sql: GRANT ALL ON TABLE "public"."workspaces" TO "anon"',
      '20260722092124_name_of_your_migration.sql: GRANT ALL ON TABLE "public"."workspaces" TO "authenticated"',
    ]);
  });

  it("REGRESSION: no migration at or after this one lets authenticated/anon/PUBLIC update protected workspace columns, statically or via dynamic GRANT", () => {
    const fromHere = files.slice(files.indexOf(MIGRATION_FILE));
    for (const file of fromHere) {
      expect(dangerousWorkspacesGrants(read(file)), `${file} reopens S1 (client-role UPDATE on protected workspace columns)`).toEqual([]);
      expect(dynamicClientRoleGrants(read(file)), `${file} contains a dynamic GRANT to a client role -- review manually`).toEqual([]);
    }
  });
});
