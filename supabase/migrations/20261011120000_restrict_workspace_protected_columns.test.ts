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
// migration silently restores a table-wide UPDATE grant.
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

function stripComments(text: string): string {
  return text.replace(/--[^\n]*/g, "");
}

// Splits SQL into statements (comments removed). Good enough for these
// migration files, which never put a semicolon inside a string literal in
// a GRANT/REVOKE statement.
function statements(text: string): string[] {
  return stripComments(text)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// A GRANT on exactly public.workspaces (not workspace_staff /
// workspace_settings) to authenticated or anon that is table-wide for
// UPDATE: either ALL [PRIVILEGES], or an UPDATE not followed by a column
// list.
function isTableWideWorkspacesUpdateGrant(statement: string): boolean {
  const match = statement.match(/^GRANT (.+?) ON (?:TABLE )?("?public"?\."?workspaces"?) TO (.+)$/i);
  if (!match) return false;
  const [, privileges, , grantees] = match;
  if (!/\b(authenticated|anon)\b/i.test(grantees)) return false;
  return /\bALL\b/i.test(privileges) || /\bUPDATE\b(?!\s*\()/i.test(privileges);
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
      expect(isTableWideWorkspacesUpdateGrant(grant)).toBe(false);
    }
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

describe("migration-order guard: no later migration restores a table-wide UPDATE on public.workspaces", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  it("the guard itself recognizes the dangerous patterns it is meant to catch", () => {
    expect(isTableWideWorkspacesUpdateGrant('GRANT ALL ON TABLE "public"."workspaces" TO "authenticated"')).toBe(true);
    expect(isTableWideWorkspacesUpdateGrant("GRANT ALL PRIVILEGES ON public.workspaces TO anon")).toBe(true);
    expect(isTableWideWorkspacesUpdateGrant("GRANT SELECT, UPDATE ON TABLE public.workspaces TO authenticated")).toBe(true);
    expect(isTableWideWorkspacesUpdateGrant('GRANT UPDATE ("name") ON TABLE "public"."workspaces" TO "authenticated"')).toBe(false);
    expect(isTableWideWorkspacesUpdateGrant('GRANT ALL ON TABLE "public"."workspaces" TO "service_role"')).toBe(false);
    expect(isTableWideWorkspacesUpdateGrant('GRANT ALL ON TABLE "public"."workspace_staff" TO "authenticated"')).toBe(false);
  });

  it("REGRESSION: every migration at or after this one is free of table-wide UPDATE/ALL grants on public.workspaces to authenticated or anon", () => {
    const fromHere = files.slice(files.indexOf(MIGRATION_FILE));
    for (const file of fromHere) {
      const offending = statements(readFileSync(join(MIGRATIONS_DIR, file), "utf-8")).filter(isTableWideWorkspacesUpdateGrant);
      expect(offending, `${file} restores a table-wide UPDATE grant on public.workspaces (reopens S1)`).toEqual([]);
    }
  });
});
