import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S4 fix (only a workspace's owner
// may manage its staff list). The real behavior -- members read, only the
// owner writes, the owner's own row protected, rows not movable, anon and
// outsiders refused, onboarding and delete_workspace() unchanged -- is
// proven against a real local Postgres by
// supabase/tests/workspace_staff_management.sql (`npm run test:rls:local`),
// which isn't wired into CI. What this file guarantees in CI is the
// migration's exact shape, and that no later migration re-opens staff
// management to plain members.
//
// Known limitation (documented, not hidden): a text scan cannot see policies
// or grants made outside migrations (dashboard / SQL editor) or computed at
// runtime. The post-deploy check
// scripts/verify-workspace-staff-management.sql reads the live policies,
// function, and privileges and is the backstop for both.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261015120000_restrict_workspace_staff_management.sql";
const BASELINE_FILE = "20260722092124_name_of_your_migration.sql";
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const sql = read(MIGRATION_FILE);

const CLIENT_ROLES = new Set(["authenticated", "anon", "public"]);
const OWNER_FN = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\."?is_workspace_owner"?\s*\([^)]*\)([\s\S]*?)\$([A-Za-z_]*)\$([\s\S]*?)\$\2\$\s*;/gi;
const STAFF_TABLE = String.raw`(?:"?public"?\s*\.\s*)?"?workspace_staff"?`;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function unquote(identifier: string): string {
  return identifier.trim().replace(/"/g, "").toLowerCase();
}

// Top-level statements once is_workspace_owner() definitions are removed.
function statements(text: string): string[] {
  return stripComments(text).replace(OWNER_FN, " ").split(";").map(squash).filter(Boolean);
}

function ownerFunctionBodies(text: string): string[] {
  return [...stripComments(text).matchAll(OWNER_FN)].map((m) => squash(m[3]));
}

function clientRoles(roleList: string | undefined): boolean {
  if (!roleList) return true; // no TO clause: the policy applies to PUBLIC
  return roleList.split(",").map(unquote).some((role) => CLIENT_ROLES.has(role));
}

// Everything that would re-open S4 in a migration's text:
//  * a write-capable policy on workspace_staff (FOR ALL/INSERT/UPDATE/DELETE,
//    or no FOR clause) for a client role that does not require
//    is_workspace_owner();
//  * a table-wide UPDATE/ALL grant on workspace_staff to a client role, or a
//    column grant that includes workspace_id or profile_id;
//  * a redefinition of is_workspace_owner() that no longer checks
//    owner_id = auth.uid(), or EXECUTE on it for anon/PUBLIC.
function s4Regressions(text: string): string[] {
  const problems: string[] = [];
  for (const statement of statements(text)) {
    const policy = new RegExp(String.raw`^(?:CREATE|ALTER)\s+POLICY\s+("[^"]+"|\S+)\s+ON\s+${STAFF_TABLE}\b(.*)$`, "i").exec(statement);
    if (policy) {
      const clause = policy[2];
      const cmd = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(clause)?.[1]?.toUpperCase() ?? "ALL";
      const roles = /\bTO\s+(.+?)(?=\bUSING\b|\bWITH\s+CHECK\b|$)/i.exec(clause)?.[1];
      if (cmd !== "SELECT" && clientRoles(roles) && !/\bis_workspace_owner"?\s*\(/i.test(clause)) {
        problems.push(`write policy without owner check: ${unquote(policy[1])}`);
      }
    }
    const grant = new RegExp(String.raw`^GRANT\s+(.+?)\s+ON\s+(?:TABLE\s+)?${STAFF_TABLE}\s+TO\s+(.+)$`, "i").exec(statement);
    if (grant && clientRoles(grant[2].split(/\bWITH\b/i)[0])) {
      for (const part of grant[1].split(/,(?![^(]*\))/).map((p) => p.trim())) {
        const columns = /\(([^)]*)\)/.exec(part)?.[1];
        const privilege = part.replace(/\(.*\)/, "").trim().toUpperCase();
        const updating = privilege === "UPDATE" || /^ALL(\s+PRIVILEGES)?$/.test(privilege);
        if (!updating) continue;
        if (!columns) problems.push(`table-wide ${privilege} on workspace_staff to a client role`);
        else if (columns.split(",").map(unquote).some((c) => c === "workspace_id" || c === "profile_id")) {
          problems.push("UPDATE on workspace_staff identity columns to a client role");
        }
      }
    }
    const fnGrant = /^GRANT\b.*\bON\s+FUNCTION\s+(?:"?public"?\s*\.\s*)?"?is_workspace_owner"?\s*\(.*?\)\s+TO\s+(.+)$/i.exec(statement);
    if (fnGrant && fnGrant[1].split(/\bWITH\b/i)[0].split(",").map(unquote).some((role) => role === "anon" || role === "public")) {
      problems.push("EXECUTE on is_workspace_owner() to anon/PUBLIC");
    }
  }
  for (const body of ownerFunctionBodies(text)) {
    if (!/\bowner_id\s*=\s*auth\.uid\(\)/i.test(body)) problems.push("is_workspace_owner() no longer checks owner_id = auth.uid()");
  }
  return problems;
}

describe("20261015120000_restrict_workspace_staff_management.sql (structural regression coverage)", () => {
  it("defines is_workspace_owner() once: SECURITY DEFINER, pinned search_path, checks owner_id = auth.uid()", () => {
    const defs = [...stripComments(sql).matchAll(OWNER_FN)];
    expect(defs).toHaveLength(1);
    expect(squash(defs[0][1])).toBe(`RETURNS boolean LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" TO 'public' AS`);
    expect(squash(defs[0][3])).toBe("SELECT EXISTS ( SELECT 1 FROM public.workspaces w WHERE w.id = workspace AND w.owner_id = auth.uid() );");
  });

  it("otherwise contains exactly the reviewed statements, in order", () => {
    expect(statements(sql)).toEqual([
      'ALTER FUNCTION "public"."is_workspace_owner"("workspace" "uuid") OWNER TO "postgres"',
      'REVOKE ALL ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") FROM PUBLIC',
      'REVOKE ALL ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") FROM "anon"',
      'GRANT EXECUTE ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") TO "authenticated"',
      'GRANT EXECUTE ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") TO "service_role"',
      'DROP POLICY IF EXISTS "workspace_staff_access" ON "public"."workspace_staff"',
      'CREATE POLICY "workspace_staff_select_members" ON "public"."workspace_staff" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id"))',
      'CREATE POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()))',
      'CREATE POLICY "workspace_staff_update_owner" ON "public"."workspace_staff" FOR UPDATE TO "authenticated" USING ("public"."is_workspace_owner"("workspace_id")) WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()))',
      'CREATE POLICY "workspace_staff_delete_owner" ON "public"."workspace_staff" FOR DELETE TO "authenticated" USING ("public"."is_workspace_owner"("workspace_id") AND "profile_id" <> "auth"."uid"())',
      'REVOKE UPDATE ON TABLE "public"."workspace_staff" FROM "authenticated"',
      'REVOKE UPDATE ON TABLE "public"."workspace_staff" FROM "anon"',
      'GRANT UPDATE ("is_active", "base_commission_pct") ON TABLE "public"."workspace_staff" TO "authenticated"',
    ]);
  });

  it("touches no other table, policy, or function", () => {
    for (const statement of statements(sql)) {
      expect(statement).toMatch(/"workspace_staff"|"is_workspace_owner"/);
    }
  });
});

describe("migration-order guard: no migration re-opens staff management to plain members", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["the original FOR ALL member-only policy", 'CREATE POLICY "workspace_staff_access" ON "public"."workspace_staff" USING ("public"."is_workspace_member"("workspace_id"));'],
    ["member-only INSERT", "CREATE POLICY p ON public.workspace_staff FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));"],
    ["member-only DELETE, anon", "create policy p on workspace_staff for delete to anon using (true);"],
    ["ALTER POLICY back to member-only", "ALTER POLICY workspace_staff_update_owner ON public.workspace_staff USING (is_workspace_member(workspace_id));"],
    ["baseline table grant", 'GRANT ALL ON TABLE "public"."workspace_staff" TO "authenticated";'],
    ["table-wide UPDATE", "GRANT UPDATE ON public.workspace_staff TO authenticated;"],
    ["UPDATE on identity column", 'GRANT UPDATE ("is_active", "workspace_id") ON TABLE "public"."workspace_staff" TO "authenticated";'],
    ["owner function to anon", 'GRANT EXECUTE ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") TO "anon";'],
    [
      "owner function weakened",
      'CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("workspace" "uuid") RETURNS boolean LANGUAGE "sql" AS $$ SELECT true; $$;',
    ],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["this migration itself", sql],
    ["member SELECT policy", "CREATE POLICY p ON public.workspace_staff FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));"],
    ["owner-gated write policy", "CREATE POLICY p ON public.workspace_staff FOR DELETE TO authenticated USING (is_workspace_owner(workspace_id));"],
    ["service_role write policy", "CREATE POLICY p ON public.workspace_staff FOR ALL TO service_role USING (true);"],
    ["column UPDATE on non-identity columns", 'GRANT UPDATE ("is_active", "base_commission_pct") ON TABLE "public"."workspace_staff" TO "authenticated";'],
    ["grant to service_role", 'GRANT ALL ON TABLE "public"."workspace_staff" TO "service_role";'],
    ["member-only policy on another table", 'CREATE POLICY "clients_access" ON "public"."clients" USING ("public"."is_workspace_member"("workspace_id"));'],
    ["commented-out policy", "-- CREATE POLICY p ON public.workspace_staff USING (is_workspace_member(workspace_id));\nSELECT 1;"],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(s4Regressions(text).length).toBeGreaterThan(0);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(s4Regressions(text)).toEqual([]);
  });

  it("against the real migration corpus: flags exactly the baseline's original policy and client grants, and nothing else", () => {
    const hits = files.flatMap((file) => s4Regressions(read(file)).map((p) => `${file}: ${p}`));
    expect(hits).toEqual([
      `${BASELINE_FILE}: write policy without owner check: workspace_staff_access`,
      `${BASELINE_FILE}: table-wide ALL on workspace_staff to a client role`,
      `${BASELINE_FILE}: table-wide ALL on workspace_staff to a client role`,
    ]);
  });

  it("REGRESSION: no migration at or after this one re-opens staff management to plain members", () => {
    for (const file of files.slice(files.indexOf(MIGRATION_FILE))) {
      expect(s4Regressions(read(file)), `${file} reopens S4`).toEqual([]);
    }
  });
});
