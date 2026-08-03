import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// There is no live-Postgres/RLS integration test tier in this project yet
// (every Vitest/Deno test mocks the Supabase client boundary instead -- a
// known, previously-documented gap, not something this file tries to
// solve). What CAN be verified without a real database is that the SQL
// this migration actually ships has the exact structural properties its
// safety depends on -- so a future edit that reorders or loosens a
// statement here fails a test instead of silently reintroducing the
// original FK-ordering bug the very first time it runs against real data.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260803120000_safe_workspace_deletion.sql");
const sql = readFileSync(migrationPath, "utf-8");

function indexOfStatement(needle: string): number {
  const i = sql.indexOf(needle);
  expect(i, `expected to find "${needle}" in the migration`).toBeGreaterThan(-1);
  return i;
}

describe("20260803120000_safe_workspace_deletion.sql (structural regression coverage)", () => {
  it("defines delete_workspace() as SECURITY DEFINER with a pinned search_path", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION "public"\."delete_workspace"/);
    expect(sql).toMatch(/LANGUAGE "plpgsql" SECURITY DEFINER/);
    expect(sql).toMatch(/SET "search_path" TO 'public'/);
  });

  it("REGRESSION: rejects the deletion (unauthorized deletion) before touching any data -- the owner check precedes every DELETE/UPDATE", () => {
    const ownerCheck = indexOfStatement("RAISE EXCEPTION 'Only the workspace owner can delete this workspace'");
    const firstDelete = indexOfStatement("DELETE FROM public.appointment_services");
    expect(ownerCheck).toBeLessThan(firstDelete);
  });

  it("REGRESSION: deletes appointments and visits before clients (both are ON DELETE RESTRICT against clients.id)", () => {
    const appointments = indexOfStatement("DELETE FROM public.appointments WHERE workspace_id");
    const visits = indexOfStatement("DELETE FROM public.visits WHERE workspace_id");
    const clients = indexOfStatement("DELETE FROM public.clients WHERE workspace_id");
    expect(appointments).toBeLessThan(clients);
    expect(visits).toBeLessThan(clients);
  });

  it("REGRESSION: deletes appointment_services before services (appointment_services.service_id is ON DELETE RESTRICT)", () => {
    const appointmentServices = indexOfStatement("DELETE FROM public.appointment_services");
    const services = indexOfStatement("DELETE FROM public.services WHERE workspace_id");
    expect(appointmentServices).toBeLessThan(services);
  });

  it("REGRESSION: audit_logs is detached (not deleted) before the workspace row itself is removed -- preserves audit integrity", () => {
    const auditDetach = indexOfStatement("UPDATE public.audit_logs SET workspace_id = NULL WHERE workspace_id");
    const workspaceDelete = indexOfStatement("DELETE FROM public.workspaces WHERE id");
    expect(auditDetach).toBeLessThan(workspaceDelete);
  });

  it("REGRESSION: the workspaces row is deleted last -- nothing that still references workspace_id runs after it", () => {
    const workspaceDelete = sql.lastIndexOf("DELETE FROM public.workspaces WHERE id");
    const afterWorkspaceDelete = sql.slice(workspaceDelete + 1, sql.indexOf("END;", workspaceDelete));
    expect(afterWorkspaceDelete).not.toMatch(/DELETE FROM|UPDATE public\./);
  });

  it("REGRESSION: every data-touching statement is scoped by workspace_id (or a subquery scoped by it) -- workspace isolation, no accidental full-table wipe", () => {
    const statements = [...sql.matchAll(/^\s*(DELETE FROM public\.\w+|UPDATE public\.\w+ SET workspace_id = NULL)\b[^;]*;/gm)].map((m) => m[0]);
    expect(statements.length).toBeGreaterThanOrEqual(13);
    for (const statement of statements) {
      // Every table has its own workspace_id column except workspaces
      // itself, which is scoped by its own primary key (id).
      expect(statement, `statement is not scoped to a single workspace: ${statement}`).toMatch(
        /workspace_id\s*=\s*p_workspace_id|workspace_id\s+IN\b|^\s*DELETE FROM public\.workspaces WHERE id\s*=\s*p_workspace_id/
      );
    }
  });

  it("does not swallow errors in a nested BEGIN/EXCEPTION block -- a failure must roll back the whole function, not report false success", () => {
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("grants EXECUTE consistent with every other SECURITY DEFINER function in this schema", () => {
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."delete_workspace"\("p_workspace_id" "uuid"\) TO "anon"/);
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."delete_workspace"\("p_workspace_id" "uuid"\) TO "authenticated"/);
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."delete_workspace"\("p_workspace_id" "uuid"\) TO "service_role"/);
  });
});
