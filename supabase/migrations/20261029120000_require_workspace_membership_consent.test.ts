import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the workspace-membership consent fix
// (an owner can no longer add another user; a non-owner member can leave;
// onboarding refuses only users who already own a workspace; anon cannot
// call the onboarding function). The real behavior is proven against a real
// local Postgres by supabase/tests/workspace_staff_management.sql
// (`npm run test:rls:local`), which isn't wired into CI. What this file
// guarantees in CI is the migration's exact shape -- including that the
// onboarding function is the original with exactly one condition changed --
// and that no later migration re-opens adding members without consent.
//
// Known limitation (documented, not hidden): a text scan cannot see policies
// or grants made outside migrations (dashboard / SQL editor). The post-deploy
// check scripts/verify-workspace-staff-management.sql reads the live
// policies, functions, and privileges and is the backstop.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261029120000_require_workspace_membership_consent.sql";
const ONBOARDING_FILE = "20260724130000_professional_onboarding.sql";
const S4_FILE = "20261015120000_restrict_workspace_staff_management.sql";
const BASELINE_FILE = "20260722092124_name_of_your_migration.sql";
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const sql = read(MIGRATION_FILE);

const CLIENT_ROLES = new Set(["authenticated", "anon", "public"]);
const BOOTSTRAP_FN = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\."?bootstrap_professional_workspace"?\s*\(([\s\S]*?)\$([A-Za-z_]*)\$([\s\S]*?)\$\2\$\s*;/gi;
const STAFF_TABLE = String.raw`(?:"?public"?\s*\.\s*)?"?workspace_staff"?`;
const OLD_GUARD = "IF EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = auth.uid()) THEN";
const NEW_GUARD = "IF EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = auth.uid()) THEN";

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function unquote(identifier: string): string {
  return identifier.trim().replace(/"/g, "").toLowerCase();
}

// Top-level statements once bootstrap_professional_workspace() definitions
// are removed (their plpgsql bodies contain semicolons).
function statements(text: string): string[] {
  return stripComments(text).replace(BOOTSTRAP_FN, " ").split(";").map(squash).filter(Boolean);
}

function bootstrapDefinitions(text: string): string[] {
  return [...stripComments(text).matchAll(BOOTSTRAP_FN)].map((m) => squash(m[0]));
}

function clientRoles(roleList: string | undefined): boolean {
  if (!roleList) return true; // no TO clause: the policy applies to PUBLIC
  return roleList.split(",").map(unquote).some((role) => CLIENT_ROLES.has(role));
}

// Quotes, schema prefix, case, and spacing removed, for exact comparison.
function normalize(expression: string): string {
  return expression.replace(/"/g, "").replace(/\bpublic\s*\./gi, "").replace(/\s+/g, "").toLowerCase();
}

// The ONLY approved INSERT check: an owner restoring their own active row.
// Compared exactly (after normalize()), so any widening -- an OR, a dropped
// condition, a negation -- is a regression, not just a missing condition.
const APPROVED_INSERT_CHECK = "is_workspace_owner(workspace_id)andprofile_id=auth.uid()andis_active";
function isApprovedInsertCheck(check: string): boolean {
  return normalize(check) === APPROVED_INSERT_CHECK;
}

// The only approved SELECT shapes for client roles on workspace_staff:
// active members see their workspace's list (S4), and anyone sees their own
// rows (this migration). Quotes, schema prefix, case, and spacing ignored.
const APPROVED_SELECT_USING = new Set(["(is_workspace_member(workspace_id))", "(profile_id=auth.uid())"]);
function normalizedUsing(clause: string): string {
  return normalize(/\bUSING\s*(\([\s\S]*\))\s*$/i.exec(clause)?.[1] ?? "");
}

// Everything that would let a client add someone else's membership again,
// expose other members' rows, or take away the consent fix:
//  * a SELECT policy on workspace_staff for a client role other than the two
//    approved shapes above;
//  * an INSERT-capable policy on workspace_staff (FOR ALL/INSERT, or no FOR
//    clause) for a client role whose check is not exactly the approved
//    own-active-row check -- including an ALTER POLICY of the insert policy;
//  * dropping the self-leave policy;
//  * a redefinition of bootstrap_professional_workspace() that refuses
//    anything other than "already owns a workspace" (e.g. the old
//    any-staff-row guard);
//  * EXECUTE on bootstrap_professional_workspace() for anon/PUBLIC.
function consentRegressions(text: string): string[] {
  const problems: string[] = [];
  for (const statement of statements(text)) {
    const policy = new RegExp(String.raw`^(CREATE|ALTER)\s+POLICY\s+("[^"]+"|\S+)\s+ON\s+${STAFF_TABLE}\b(.*)$`, "i").exec(statement);
    if (policy) {
      const name = unquote(policy[2]);
      const clause = policy[3];
      const cmd = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(clause)?.[1]?.toUpperCase();
      const roles = /\bTO\s+(.+?)(?=\bUSING\b|\bWITH\s+CHECK\b|$)/i.exec(clause)?.[1];
      const check = /\bWITH\s+CHECK\s*\(([\s\S]*)\)\s*$/i.exec(clause)?.[1] ?? /\bUSING\s*\(([\s\S]*)\)\s*$/i.exec(clause)?.[1] ?? "";
      const insertCapable = policy[1].toUpperCase() === "CREATE" ? (cmd ?? "ALL") === "INSERT" || (cmd ?? "ALL") === "ALL" : name === "workspace_staff_insert_owner";
      if (insertCapable && clientRoles(roles) && !isApprovedInsertCheck(check)) {
        problems.push(`insert policy other than the approved own-active-row check: ${name}`);
      }
      // ALTER POLICY has no FOR clause: an ALTER of a known SELECT policy is a SELECT.
      const selectPolicy = policy[1].toUpperCase() === "CREATE"
        ? cmd === "SELECT"
        : name === "workspace_staff_select_own" || name === "workspace_staff_select_members";
      if (selectPolicy && clientRoles(roles) && !APPROVED_SELECT_USING.has(normalizedUsing(clause))) {
        problems.push(`SELECT policy wider than the approved shapes: ${name}`);
      }
    }
    if (new RegExp(String.raw`^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?workspace_staff_delete_self"?\s+ON\s+${STAFF_TABLE}`, "i").test(statement)) {
      problems.push("drops the self-leave policy workspace_staff_delete_self");
    }
    const fnGrant = /^GRANT\b.*\bON\s+FUNCTION\s+(?:"?public"?\s*\.\s*)?"?bootstrap_professional_workspace"?\s*\(.*?\)\s+TO\s+(.+)$/i.exec(statement);
    if (fnGrant && fnGrant[1].split(/\bWITH\b/i)[0].split(",").map(unquote).some((role) => role === "anon" || role === "public")) {
      problems.push("EXECUTE on bootstrap_professional_workspace() to anon/PUBLIC");
    }
  }
  for (const definition of bootstrapDefinitions(text)) {
    if (!definition.includes(NEW_GUARD)) problems.push("bootstrap_professional_workspace() does not refuse only existing owners");
  }
  return problems;
}

describe("20261029120000_require_workspace_membership_consent.sql (structural regression coverage)", () => {
  it("redefines bootstrap_professional_workspace() as the original with exactly the onboarding condition changed", () => {
    const original = bootstrapDefinitions(read(ONBOARDING_FILE));
    const redefined = bootstrapDefinitions(sql);
    expect(original).toHaveLength(1);
    expect(redefined).toHaveLength(1);
    expect(original[0]).toContain(OLD_GUARD);
    expect(redefined[0]).toBe(original[0].replace(OLD_GUARD, NEW_GUARD));
    // Same signature, SECURITY DEFINER, and pinned search_path as before.
    expect(redefined[0]).toContain(`RETURNS "uuid" LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public' AS`);
  });

  it("otherwise contains exactly the reviewed statements, in order", () => {
    expect(statements(sql)).toEqual([
      'ALTER POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff" WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND "profile_id" = "auth"."uid"() AND "is_active")',
      'CREATE POLICY "workspace_staff_delete_self" ON "public"."workspace_staff" FOR DELETE TO "authenticated" USING ("profile_id" = "auth"."uid"() AND NOT "public"."is_workspace_owner"("workspace_id"))',
      'CREATE POLICY "workspace_staff_select_own" ON "public"."workspace_staff" FOR SELECT TO "authenticated" USING ("profile_id" = "auth"."uid"())',
      'REVOKE EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") FROM PUBLIC',
      'REVOKE EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") FROM "anon"',
    ]);
  });

  it("changes no grant, column privilege, other policy, or other function", () => {
    for (const statement of statements(sql)) {
      expect(statement).not.toMatch(/^GRANT\b/i);
      expect(statement).toMatch(/"workspace_staff_insert_owner"|"workspace_staff_delete_self"|"workspace_staff_select_own"|"bootstrap_professional_workspace"/);
    }
  });
});

describe("migration-order guard: no migration re-opens adding members without consent", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["S4's owner-adds-anyone insert policy", 'CREATE POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()));'],
    ["ALTER POLICY back to owner-adds-anyone", "ALTER POLICY workspace_staff_insert_owner ON public.workspace_staff WITH CHECK (is_workspace_owner(workspace_id));"],
    ["FOR ALL owner policy (covers INSERT)", "CREATE POLICY p ON public.workspace_staff TO authenticated USING (is_workspace_owner(workspace_id));"],
    ["negated own-profile check", "CREATE POLICY p ON public.workspace_staff FOR INSERT TO authenticated WITH CHECK (is_workspace_owner(workspace_id) AND NOT profile_id = auth.uid());"],
    ["own-profile condition OR-widened to any row", "CREATE POLICY p ON public.workspace_staff FOR INSERT TO authenticated WITH CHECK (is_workspace_owner(workspace_id) AND (profile_id = auth.uid() OR true));"],
    ["own-profile OR owner (owner adds anyone)", "ALTER POLICY workspace_staff_insert_owner ON public.workspace_staff WITH CHECK (profile_id = auth.uid() OR is_workspace_owner(workspace_id));"],
    ["approved check minus is_active", 'ALTER POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff" WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND "profile_id" = "auth"."uid"());'],
    ["insert policy for anon", "CREATE POLICY p ON public.workspace_staff FOR INSERT TO anon WITH CHECK (true);"],
    ["dropping the self-leave policy", 'DROP POLICY IF EXISTS "workspace_staff_delete_self" ON "public"."workspace_staff";'],
    ["SELECT policy exposing every row", "CREATE POLICY p ON public.workspace_staff FOR SELECT TO authenticated USING (true);"],
    ["own-row SELECT widened with OR", "CREATE POLICY p ON public.workspace_staff FOR SELECT TO authenticated USING (profile_id = auth.uid() OR is_active);"],
    ["ALTER of the own-row SELECT to any row", "ALTER POLICY workspace_staff_select_own ON public.workspace_staff USING (profile_id IS NOT NULL);"],
    ["ALTER of the member SELECT to any row", 'ALTER POLICY "workspace_staff_select_members" ON "public"."workspace_staff" USING (true);'],
    ["onboarding function to anon", 'GRANT EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "anon";'],
    ["onboarding function to PUBLIC", 'GRANT ALL ON FUNCTION public.bootstrap_professional_workspace(text, text, text) TO PUBLIC;'],
    [
      "onboarding function back to the any-staff-row guard",
      `CREATE OR REPLACE FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") RETURNS "uuid" LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public' AS $$ BEGIN ${OLD_GUARD} RAISE EXCEPTION 'x'; END IF; RETURN NULL; END; $$;`,
    ],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["this migration itself", sql],
    ["owner restores own active row", 'CREATE POLICY p ON public.workspace_staff FOR INSERT TO authenticated WITH CHECK (is_workspace_owner(workspace_id) AND profile_id = auth.uid() AND is_active);'],
    ["member SELECT policy", "CREATE POLICY p ON public.workspace_staff FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));"],
    ["own-row SELECT policy", 'CREATE POLICY "workspace_staff_select_own" ON "public"."workspace_staff" FOR SELECT TO "authenticated" USING ("profile_id" = "auth"."uid"());'],
    ["owner UPDATE policy", "CREATE POLICY p ON public.workspace_staff FOR UPDATE TO authenticated USING (is_workspace_owner(workspace_id));"],
    ["owner DELETE policy", "CREATE POLICY p ON public.workspace_staff FOR DELETE TO authenticated USING (is_workspace_owner(workspace_id));"],
    ["service_role write policy", "CREATE POLICY p ON public.workspace_staff FOR ALL TO service_role USING (true);"],
    ["onboarding function to authenticated", 'GRANT EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "authenticated";'],
    ["commented-out policy", "-- CREATE POLICY p ON public.workspace_staff FOR INSERT TO authenticated WITH CHECK (true);\nSELECT 1;"],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(consentRegressions(text).length).toBeGreaterThan(0);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(consentRegressions(text)).toEqual([]);
  });

  it("against the real migration corpus: flags exactly the earlier member-adding policies and the original onboarding function, and nothing else", () => {
    const hits = files.flatMap((file) => consentRegressions(read(file)).map((p) => `${file}: ${p}`));
    expect(hits).toEqual([
      `${BASELINE_FILE}: insert policy other than the approved own-active-row check: workspace_staff_access`,
      `${ONBOARDING_FILE}: EXECUTE on bootstrap_professional_workspace() to anon/PUBLIC`,
      `${ONBOARDING_FILE}: bootstrap_professional_workspace() does not refuse only existing owners`,
      `${S4_FILE}: insert policy other than the approved own-active-row check: workspace_staff_insert_owner`,
    ]);
  });

  it("REGRESSION: no migration at or after this one re-opens adding members without consent", () => {
    for (const file of files.slice(files.indexOf(MIGRATION_FILE))) {
      expect(consentRegressions(read(file)), `${file} reopens member adding without consent`).toEqual([]);
    }
  });
});
