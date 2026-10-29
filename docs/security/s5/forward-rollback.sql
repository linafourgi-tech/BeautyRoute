-- EMERGENCY PROCEDURE -- S5 forward rollback.
-- DO NOT RUN without explicit approval. Never run it automatically, and never
-- place it in supabase/migrations/.
--
-- Reverts supabase/migrations/20261026120000_prevent_cross_workspace_references.sql:
-- removes the 13 triggers and 13 functions S5 created, and restores the 11
-- *_access policies to their exact pre-S5 definitions (FOR ALL, PUBLIC, USING
-- only -- ALTER POLICY cannot remove a WITH CHECK, so they are dropped and
-- re-created). No data change: no INSERT, UPDATE, or DELETE.
--
-- Intentional consequences:
--   * It REMOVES the S5 protections: members can again write rows that
--     reference another workspace's records (the vulnerability S5 fixed).
--   * The migration history still lists 20261026120000 as applied while its
--     objects are gone. History and database stay diverged until an approved
--     recovery plan reconciles them.
--
-- Reviewed against main at d19cd2e, where 20261026120000 is the last
-- migration that changes these 11 policies, 13 functions, and 13 triggers.
-- If any later migration changes them, this script is stale: review it
-- again before use.
--
-- Procedure (each step needs explicit approval; running this file needs its
-- own, separate explicit approval):
--   1. Verify the target before running anything: the project (ref/host in
--      the connection string) and the environment (production or local).
--      Inspect the current state; run production-precheck.sql (5/8 is
--      expected while S5 is deployed).
--   2. Run this whole file as one unit with psql:
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/security/s5/forward-rollback.sql
--      Supply DATABASE_URL securely at execution time. The connection string
--      must never be committed, logged, or written into documentation or
--      any file.
--      The file is a single transaction. With ON_ERROR_STOP=1, psql stops at
--      the first error and exits non-zero, and the open transaction is
--      rolled back: nothing changes. A table lock not obtained within
--      lock_timeout (5s) is such an error -- retry at a quieter time.
--      Do NOT use `supabase db query -f` for this file: it sends the file as
--      one prepared statement and rejects multi-statement files.
--      This command is validated against a local database only, and only
--      its failure path end to end (lock timeout: exit 3, nothing changed).
--      Its successful COMMIT path has NOT been tested end to end: the same
--      statements were tested locally inside a transaction that ended in
--      ROLLBACK. It has never been run against production.
--   3. Run production-precheck.sql again: it MUST show 8/8. Successful
--      execution of this file alone is not sufficient evidence.
--
-- If it is ever converted into a migration (a NEW timestamped file; never
-- edit 20261026120000): reconsider the BEGIN / SET LOCAL / COMMIT statements,
-- since the migration runner manages its own transaction. Such a migration
-- INTENTIONALLY fails the S5 structural test
-- (20261026120000_prevent_cross_workspace_references.test.ts): its
-- "REGRESSION: no migration at or after this one re-opens cross-workspace
-- references" and corpus tests flag the re-created USING-only policies and
-- dropped triggers. That is the guard working; the same PR must withdraw the
-- S5 structural test, local test, and verification script with explicit
-- review that S5 is being withdrawn.

-- Transaction wrapper (reconsider if this file becomes a migration; see above).
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS "trg_appointments_same_workspace_refs" ON "public"."appointments";
DROP TRIGGER IF EXISTS "trg_visits_same_workspace_refs" ON "public"."visits";
DROP TRIGGER IF EXISTS "trg_appointment_services_same_workspace_refs" ON "public"."appointment_services";
DROP TRIGGER IF EXISTS "trg_client_tags_same_workspace_refs" ON "public"."client_tags";
DROP TRIGGER IF EXISTS "trg_ai_history_same_workspace_refs" ON "public"."ai_history";
DROP TRIGGER IF EXISTS "trg_revenues_same_workspace_refs" ON "public"."revenues";
DROP TRIGGER IF EXISTS "trg_expenses_same_workspace_refs" ON "public"."expenses";
DROP TRIGGER IF EXISTS "trg_clients_same_workspace_move" ON "public"."clients";
DROP TRIGGER IF EXISTS "trg_services_same_workspace_move" ON "public"."services";
DROP TRIGGER IF EXISTS "trg_tags_same_workspace_move" ON "public"."tags";
DROP TRIGGER IF EXISTS "trg_appointments_same_workspace_move" ON "public"."appointments";
DROP TRIGGER IF EXISTS "trg_visits_same_workspace_move" ON "public"."visits";
DROP TRIGGER IF EXISTS "trg_files_same_workspace_move" ON "public"."files";

DROP FUNCTION IF EXISTS "public"."same_workspace_appointment_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_visit_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_appointment_service_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_client_tag_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_ai_history_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_revenue_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_expense_refs"();
DROP FUNCTION IF EXISTS "public"."same_workspace_client_move"();
DROP FUNCTION IF EXISTS "public"."same_workspace_service_move"();
DROP FUNCTION IF EXISTS "public"."same_workspace_tag_move"();
DROP FUNCTION IF EXISTS "public"."same_workspace_appointment_move"();
DROP FUNCTION IF EXISTS "public"."same_workspace_visit_move"();
DROP FUNCTION IF EXISTS "public"."same_workspace_file_move"();

-- Original definitions: 20260722092124_name_of_your_migration.sql (9) and
-- 20260724100000_add_missing_rls_policies.sql (2).
DROP POLICY IF EXISTS "ai_history_access" ON "public"."ai_history";
CREATE POLICY "ai_history_access" ON "public"."ai_history" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "appointments_access" ON "public"."appointments";
CREATE POLICY "appointments_access" ON "public"."appointments" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "clients_access" ON "public"."clients";
CREATE POLICY "clients_access" ON "public"."clients" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "expenses_access" ON "public"."expenses";
CREATE POLICY "expenses_access" ON "public"."expenses" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "files_access" ON "public"."files";
CREATE POLICY "files_access" ON "public"."files" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "revenues_access" ON "public"."revenues";
CREATE POLICY "revenues_access" ON "public"."revenues" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "services_access" ON "public"."services";
CREATE POLICY "services_access" ON "public"."services" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "tags_access" ON "public"."tags";
CREATE POLICY "tags_access" ON "public"."tags" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "visits_access" ON "public"."visits";
CREATE POLICY "visits_access" ON "public"."visits" USING ("public"."is_workspace_member"("workspace_id"));
DROP POLICY IF EXISTS "appointment_services_access" ON "public"."appointment_services";
CREATE POLICY "appointment_services_access" ON "public"."appointment_services"
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND public.is_workspace_member(a.workspace_id)
  )
);
DROP POLICY IF EXISTS "client_tags_access" ON "public"."client_tags";
CREATE POLICY "client_tags_access" ON "public"."client_tags"
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_tags.client_id
      AND public.is_workspace_member(c.workspace_id)
  )
);

COMMIT;
