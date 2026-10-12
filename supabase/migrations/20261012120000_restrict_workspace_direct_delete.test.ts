import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S1-b fix (workspace rows must only
// be deleted through delete_workspace(), never by a direct DELETE). The real
// privilege behavior -- owner, non-owner member, outsider and anon refused;
// delete_workspace() still owner-only and audit-preserving; service_role
// still allowed -- is proven against a real local Postgres by
// supabase/tests/workspace_direct_delete.sql (`npm run test:rls:local`),
// which isn't wired into CI. What this file guarantees in CI is the
// migration's exact shape, and that no later migration grants DELETE (or
// ALL) on public.workspaces back to a client role.
//
// Known limitation (documented, not hidden): a text scan cannot see grants
// whose GRANT keyword or role name is itself computed at runtime, or grants
// made outside migrations (dashboard / SQL editor). The post-deploy check
// scripts/verify-workspace-direct-delete.sql reads the live privileges and
// is the backstop for both.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261012120000_restrict_workspace_direct_delete.sql";
const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), "utf-8");

// PUBLIC is the pseudo-role every role (anon and authenticated included)
// inherits from, so a grant to it is as dangerous as a grant to either.
const CLIENT_ROLES = new Set(["authenticated", "anon", "public"]);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

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
// DO blocks or function bodies (a clause ends at `;` or a quote).
function grantClauses(text: string): GrantClause[] {
  const flat = stripComments(text).replace(/\s+/g, " ");
  return [...flat.matchAll(/\bGRANT\s+([^;']+?)\s+ON\s+([^;']+?)\s+TO\s+([^;']+)/gi)].map((m) => ({
    privileges: m[1],
    objects: m[2],
    grantees: m[3],
  }));
}

// Does the ON-clause cover public.workspaces? Covers `ALL TABLES IN SCHEMA
// public`, multi-table lists, and unqualified `workspaces`. Default
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

// DELETE is a table-level privilege only (Postgres has no column-level
// DELETE), so DELETE or table-wide ALL [PRIVILEGES] grants it. A
// column-level `ALL (col, ...)` grants only column privileges -- not DELETE.
function grantsDelete(privileges: string): boolean {
  for (const part of privileges.split(/,(?![^(]*\))/)) {
    const p = part.trim();
    if (/^DELETE$/i.test(p)) return true;
    if (/^ALL(?:\s+PRIVILEGES)?$/i.test(p)) return true;
  }
  return false;
}

// Static guard: every GRANT clause (incl. literal EXECUTE strings) that
// would let authenticated/anon/PUBLIC delete workspace rows directly.
function dangerousWorkspacesDeleteGrants(text: string): string[] {
  return grantClauses(text)
    .filter((g) => coversWorkspaces(g.objects) && grantsToClientRole(g.grantees) && grantsDelete(g.privileges))
    .map((g) => `GRANT ${g.privileges} ON ${g.objects} TO ${g.grantees}`.trim());
}

// Conservative dynamic-SQL guard: a dollar-quoted body (DO block / function)
// that EXECUTEs anything containing GRANT and mentions a client role -- its
// table/privileges may be computed, so flag it for human review.
function dynamicClientRoleGrants(text: string): string[] {
  const bodies = [...stripComments(text).matchAll(/\$([A-Za-z_]*)\$([\s\S]*?)\$\1\$/g)].map((m) => m[2]);
  return bodies.filter(
    (body) => /\bEXECUTE\b/i.test(body) && /\bGRANT\b/i.test(body) && /\b(authenticated|anon)\b|\bTO\s+PUBLIC\b/i.test(body),
  );
}

describe("20261012120000_restrict_workspace_direct_delete.sql (structural regression coverage)", () => {
  it("contains exactly the two reviewed REVOKE DELETE statements and nothing else", () => {
    expect(statements(sql)).toEqual([
      'REVOKE DELETE ON TABLE "public"."workspaces" FROM "authenticated"',
      'REVOKE DELETE ON TABLE "public"."workspaces" FROM "anon"',
    ]);
  });

  it("changes nothing else -- no GRANT, policy, TRUNCATE, UPDATE, INSERT, function, or other-table statements", () => {
    for (const statement of statements(sql)) {
      expect(statement).not.toMatch(/\bGRANT\b|\bPOLICY\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bFUNCTION\b|\bEXECUTE\b|\bROW LEVEL SECURITY\b/i);
      expect(statement).toMatch(/"public"\."workspaces"/);
    }
  });
});

describe("migration-order guard: no later migration grants DELETE on public.workspaces back to a client role", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const flagged = (text: string) => dangerousWorkspacesDeleteGrants(text).length > 0 || dynamicClientRoleGrants(text).length > 0;

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["baseline form: GRANT ALL ON TABLE (quoted) to authenticated", 'GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";'],
    ["baseline form: GRANT ALL ON TABLE (quoted) to anon", 'GRANT ALL ON TABLE "public"."workspaces" TO "anon";'],
    ["GRANT DELETE, unquoted, no TABLE keyword", "GRANT DELETE ON public.workspaces TO authenticated;"],
    ["privilege list containing DELETE", 'GRANT SELECT, INSERT, DELETE ON TABLE "public"."workspaces" TO "authenticated";'],
    ["ALL PRIVILEGES", "GRANT ALL PRIVILEGES ON TABLE public.workspaces TO anon;"],
    ["multi-line, lowercase", 'grant delete\n  on table "public"."workspaces"\n  to "authenticated";'],
    ["WITH GRANT OPTION", 'GRANT DELETE ON TABLE "public"."workspaces" TO "authenticated" WITH GRANT OPTION;'],
    ["multiple grantees", 'GRANT ALL ON TABLE "public"."workspaces" TO "anon", "authenticated", "service_role";'],
    ["ALL TABLES IN SCHEMA public", "GRANT DELETE ON ALL TABLES IN SCHEMA public TO authenticated;"],
    ["ALL TABLES IN SCHEMA (quoted, multiple schemas)", 'GRANT ALL ON ALL TABLES IN SCHEMA "extensions", "public" TO "anon";'],
    ["grantee PUBLIC", "GRANT DELETE ON TABLE public.workspaces TO PUBLIC;"],
    ["PUBLIC among other grantees", 'GRANT ALL ON TABLE "public"."workspaces" TO "service_role", PUBLIC;'],
    ["multi-table list including workspaces", "GRANT DELETE ON TABLE public.clients, public.workspaces TO authenticated;"],
    ["multi-table list, workspaces first, quoted", 'GRANT ALL ON "public"."workspaces", "public"."clients" TO "authenticated";'],
    ["unqualified table name", "GRANT DELETE ON TABLE workspaces TO authenticated;"],
    ["unqualified, quoted, no TABLE keyword", 'GRANT ALL ON "workspaces" TO "anon";'],
    ["literal EXECUTE in a DO block", "DO $$ BEGIN EXECUTE 'GRANT DELETE ON TABLE public.workspaces TO authenticated'; END $$;"],
    ["literal EXECUTE in a function body", "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN EXECUTE 'GRANT ALL ON workspaces TO anon'; END $fn$;"],
    ["computed EXECUTE format(...) to a client role", "DO $$ BEGIN EXECUTE format('GRANT %s ON %I TO authenticated', 'DELETE', 'workspaces'); END $$;"],
    ["loop over pg_tables granting to a client role", "DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE 'GRANT DELETE ON public.' || quote_ident(r.tablename) || ' TO anon'; END LOOP; END $$;"],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["service_role only", 'GRANT ALL ON TABLE "public"."workspaces" TO "service_role";'],
    ["DELETE on an unrelated table workspace_staff", 'GRANT DELETE ON TABLE "public"."workspace_staff" TO "authenticated";'],
    ["DELETE on an unrelated table workspace_settings", "GRANT ALL ON TABLE public.workspace_settings TO anon;"],
    ["same table name in another schema", "GRANT DELETE ON TABLE private.workspaces TO authenticated;"],
    ["SELECT only", 'GRANT SELECT ON TABLE "public"."workspaces" TO "anon";'],
    ["column-level UPDATE (the S1 grant)", 'GRANT UPDATE ("name", "locale") ON TABLE "public"."workspaces" TO "authenticated";'],
    ["column-level ALL (grants no DELETE)", "GRANT ALL (name) ON public.workspaces TO authenticated;"],
    ["line comment", '-- GRANT DELETE ON TABLE "public"."workspaces" TO "authenticated";\nSELECT 1;'],
    ["block comment", '/* GRANT ALL ON TABLE "public"."workspaces" TO "anon"; */ SELECT 1;'],
    ["default privileges for future tables", 'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";'],
    ["ALL TABLES in a different schema", "GRANT DELETE ON ALL TABLES IN SCHEMA extensions TO authenticated;"],
    ["function grant", 'GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "authenticated";'],
    ["REVOKE (this migration's own statements)", 'REVOKE DELETE ON TABLE "public"."workspaces" FROM "authenticated";'],
    ["dynamic grant to service_role only", "DO $$ BEGIN EXECUTE 'GRANT DELETE ON public.clients TO service_role'; END $$;"],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(flagged(text)).toBe(true);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(flagged(text)).toBe(false);
  });

  it("against the real migration corpus: flags exactly the baseline's original grants, and nothing else", () => {
    const hits = files.flatMap((file) => [
      ...dangerousWorkspacesDeleteGrants(read(file)).map((g) => `${file}: ${g}`),
      ...dynamicClientRoleGrants(read(file)).map(() => `${file}: dynamic GRANT to a client role`),
    ]);
    expect(hits).toEqual([
      '20260722092124_name_of_your_migration.sql: GRANT ALL ON TABLE "public"."workspaces" TO "anon"',
      '20260722092124_name_of_your_migration.sql: GRANT ALL ON TABLE "public"."workspaces" TO "authenticated"',
    ]);
  });

  it("REGRESSION: no migration at or after this one grants DELETE on public.workspaces to authenticated/anon/PUBLIC, statically or via dynamic GRANT", () => {
    const fromHere = files.slice(files.indexOf(MIGRATION_FILE));
    for (const file of fromHere) {
      expect(dangerousWorkspacesDeleteGrants(read(file)), `${file} reopens S1-b (client-role DELETE on public.workspaces)`).toEqual([]);
      expect(dynamicClientRoleGrants(read(file)), `${file} contains a dynamic GRANT to a client role -- review manually`).toEqual([]);
    }
  });
});
