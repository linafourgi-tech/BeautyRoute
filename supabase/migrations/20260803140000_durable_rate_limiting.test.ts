import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Same rationale as 20260803120000_safe_workspace_deletion.test.ts: there is
// no live-Postgres/RLS integration test tier in this project, so the actual
// sliding-window counting, atomicity, and cross-function/cross-user
// isolation properties of check_rate_limit() can't be exercised end-to-end
// here. What IS verifiable without a real database is that the migration's
// SQL has the exact structural properties those guarantees depend on -- so
// a future edit that loosens scoping, drops the lock, or grants a direct
// table policy fails a test instead of silently reintroducing exactly the
// non-durable/spoofable rate limiter this migration was written to replace.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260803140000_durable_rate_limiting.sql");
const sql = readFileSync(migrationPath, "utf-8");

describe("20260803140000_durable_rate_limiting.sql (structural regression coverage)", () => {
  it("defines check_rate_limit() as SECURITY DEFINER with a pinned search_path", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION "public"\."check_rate_limit"/);
    expect(sql).toMatch(/LANGUAGE "plpgsql" SECURITY DEFINER/);
    expect(sql).toMatch(/SET "search_path" TO 'public'/);
  });

  it("REGRESSION: rejects an unauthenticated caller before touching the table -- callable only in an authenticated context", () => {
    const authCheck = sql.indexOf("RAISE EXCEPTION 'Authentication required'");
    const firstTableAccess = sql.indexOf("DELETE FROM public.rate_limit_events");
    expect(authCheck).toBeGreaterThan(-1);
    expect(authCheck).toBeLessThan(firstTableAccess);
  });

  it("REGRESSION: scopes every query to auth.uid() -- never a caller-supplied user id -- so one user can't read or alter another's counter", () => {
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).not.toMatch(/p_user_id/);
    // Every DELETE/SELECT/INSERT touching the table includes v_user_id.
    const statements = [...sql.matchAll(/(DELETE FROM public\.rate_limit_events|SELECT count\(\*\)[\s\S]*?FROM public\.rate_limit_events|INSERT INTO public\.rate_limit_events)[\s\S]*?;/g)].map((m) => m[0]);
    expect(statements.length).toBeGreaterThanOrEqual(3);
    for (const statement of statements) {
      expect(statement, `statement doesn't scope by v_user_id: ${statement}`).toMatch(/v_user_id/);
    }
  });

  it("REGRESSION: scopes every query by function_name -- prevents cross-function counter collisions", () => {
    const statements = [...sql.matchAll(/(DELETE FROM public\.rate_limit_events|SELECT count\(\*\)[\s\S]*?FROM public\.rate_limit_events)[\s\S]*?;/g)].map((m) => m[0]);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    for (const statement of statements) {
      expect(statement, `statement doesn't scope by function_name: ${statement}`).toMatch(/function_name\s*=\s*p_function_name/);
    }
  });

  it("REGRESSION: serializes concurrent calls for the same (user, function) pair via an advisory transaction lock -- atomicity", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(v_user_id::text \|\| ':' \|\| p_function_name, 0\)\)/);
    // The lock must run before the count-then-insert race window it protects.
    const lockIndex = sql.indexOf("pg_advisory_xact_lock");
    const countIndex = sql.indexOf("SELECT count(*)");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeLessThan(countIndex);
  });

  it("REGRESSION: defines an expiry/window cutoff before counting -- old requests fall out of the sliding window", () => {
    expect(sql).toMatch(/created_at < now\(\) - \(p_window_seconds \|\| ' seconds'\)::interval/);
    const deleteIndex = sql.indexOf("DELETE FROM public.rate_limit_events");
    const countIndex = sql.indexOf("SELECT count(*)");
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeLessThan(countIndex);
  });

  it("enables RLS on rate_limit_events with zero direct policies -- only check_rate_limit() itself can read or write it", () => {
    expect(sql).toMatch(/ALTER TABLE "public"\."rate_limit_events" ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY .* ON "public"\."rate_limit_events"/);
  });

  it("grants EXECUTE consistent with every other SECURITY DEFINER function in this schema", () => {
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."check_rate_limit".*TO "anon"/);
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."check_rate_limit".*TO "authenticated"/);
    expect(sql).toMatch(/GRANT ALL ON FUNCTION "public"\."check_rate_limit".*TO "service_role"/);
  });
});
