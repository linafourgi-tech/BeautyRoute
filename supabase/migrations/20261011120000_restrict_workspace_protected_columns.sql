-- S1 (production-readiness audit): workspace members must not be able to
-- change plan, billing, trial, or ownership fields through the public API.
--
-- Root cause: the baseline migration's default grants
-- (20260722092124_name_of_your_migration.sql, `GRANT ALL ON TABLE
-- "public"."workspaces"` to anon and authenticated) give both roles
-- table-wide UPDATE on public.workspaces, and the only policy,
-- "workspace_access" (FOR ALL USING is_workspace_member(id), no WITH
-- CHECK), lets any member update their own workspace row -- every column,
-- including plan_tier, subscription_status, trial_ends_at and owner_id,
-- which the Edge Functions' hasFeature() plan gating trusts.
--
-- Fix: column-level privileges. Remove the table-wide UPDATE grant and
-- re-grant UPDATE only on the columns the app legitimately edits -- exactly
-- UPDATABLE_WORKSPACE_FIELDS in src/services/workspaces.ts (kept in sync by
-- this migration's own test). Postgres checks column privileges before RLS,
-- for every client, so a crafted PATCH/upsert naming any other column is
-- rejected with SQLSTATE 42501. The RLS policy itself is unchanged.
--
-- Unaffected by design (none of these run as `authenticated`/`anon`):
--   * bootstrap_professional_workspace() -- SECURITY DEFINER (sets the trial)
--   * delete_workspace()                 -- SECURITY DEFINER, DELETE only
--   * service_role (future billing webhook / admin Edge Function) and
--     postgres (dashboard, migrations) keep their existing grants.
-- updated_at is maintained by trg_workspaces_updated_at (BEFORE UPDATE);
-- column privileges apply only to columns named in the UPDATE statement,
-- so it needs no grant.
--
-- Fail-closed: any future workspaces column is NOT client-updatable until it
-- is added both to a new migration's GRANT and to UPDATABLE_WORKSPACE_FIELDS.
-- Never restore a table-wide UPDATE grant to fix a missing column -- grant
-- that single column instead (a table-wide grant would reopen S1).
--
-- Deliberately NOT changed here (separate, reviewed findings): DELETE,
-- INSERT, and every other privilege on this table.

-- Revoking at table level also revokes the implied per-column privileges.
REVOKE UPDATE ON TABLE "public"."workspaces" FROM "authenticated";
REVOKE UPDATE ON TABLE "public"."workspaces" FROM "anon";

GRANT UPDATE ("name", "display_brand", "timezone", "currency", "locale", "city", "district", "business_type")
  ON TABLE "public"."workspaces" TO "authenticated";
