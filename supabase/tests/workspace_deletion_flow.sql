-- Real integration test: the authorized workspace-deletion flow,
-- public.delete_workspace() (20260803120000_safe_workspace_deletion.sql).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied,
-- that:
--   1. A non-owner active MEMBER is refused (42501) by delete_workspace().
--   2. An OUTSIDER -- the owner of a different workspace -- is refused.
--   3. ANON is refused.
--   4. The rightful OWNER is refused for a nonexistent workspace id and for
--      a NULL id.
--      After every refusal above, every row of the workspace and of all 14
--      child tables (plus its audit history) is byte-for-byte unchanged.
--   5. Atomicity: a failure forced partway through delete_workspace() (after
--      appointments/visits/services/clients are already deleted) undoes the
--      whole call -- every row and every audit row is unchanged afterwards.
--   6. The OWNER's delete_workspace() removes the workspace and its rows in
--      every child table; every earlier audit row is preserved unchanged
--      except for workspace_id = NULL; each audited record gets exactly one
--      detached DELETE audit row; profiles and a separate workspace are
--      untouched.
--   7. The OWNER can delete an already-emptied workspace (audit history,
--      staff and settings only); its audit rows are preserved, detached.
--   8. After deleting all of their workspaces, the owner can onboard again
--      through bootstrap_professional_workspace().
--   9. delete_workspace() (SECURITY DEFINER, EXECUTE grants), the RLS
--      policy, the 13 ON DELETE CASCADE foreign keys, and the S1 / S1-b
--      privileges are unchanged.
--
-- Same session mechanism as the other tests: `SET LOCAL ROLE` plus the
-- `request.jwt.claims` setting auth.uid() reads from. Entirely wrapped in
-- one transaction that is ALWAYS rolled back -- including the test-only
-- trigger and helper functions created below; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000003xx) distinct from the other test
-- files'.
--
-- Local-only guard: the first statement after BEGIN refuses to run unless
-- the session setting beautyroute.local_rls_test is 'on', which only
-- scripts/test-rls-local.sh sets (via PGOPTIONS on its docker exec). Any
-- other route -- psql against a remote URL, `supabase db query --linked`,
-- a SQL editor -- stops there, before any setup or DDL. The guard covers
-- whole-file runs only: never run a selection of this file by hand.
--
-- Known limitation (outcome-based assertions): every foreign key to
-- workspaces is ON DELETE CASCADE, so the final workspaces delete produces
-- the same end state even if one of delete_workspace()'s explicit
-- cascade-equivalent steps were removed (verified: dropping its
-- `DELETE FROM public.notifications` statement still passes). These
-- assertions prove the outcome, not that each explicit statement is
-- present; statement order is checked structurally by
-- supabase/migrations/20260803120000_safe_workspace_deletion.test.ts.

BEGIN;

DO $$
BEGIN
  IF current_setting('beautyroute.local_rls_test', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'REFUSING TO RUN: local-only test. Run it via scripts/test-rls-local.sh (npm run test:rls:local), never directly.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Setup (as the connecting superuser-equivalent role, test setup only).
-- O = owner of W and E, M = non-owner active staff member of W,
-- X = outsider, owner of their own workspace WX.
-- W: a workspace with a row in every workspace-scoped table.
-- E: an "emptied" workspace (audit history, staff, settings only).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000030a', 'flow-test-owner@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000030b', 'flow-test-outsider@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000030c', 'flow-test-staff@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000030a', 'Deletion Flow Test Owner'),
    ('00000000-0000-0000-0000-00000000030b', 'Deletion Flow Test Outsider'),
    ('00000000-0000-0000-0000-00000000030c', 'Deletion Flow Test Staff')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-00000000030a', 'Deletion Flow Test W', 'del-flow-test-w', 'Deletion Flow Test W'),
    ('00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-00000000030a', 'Deletion Flow Test E', 'del-flow-test-e', 'Deletion Flow Test E'),
    ('00000000-0000-0000-0000-0000000003bb', '00000000-0000-0000-0000-00000000030b', 'Deletion Flow Test WX', 'del-flow-test-wx', 'Deletion Flow Test WX');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-00000000030a', true),
    ('00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-00000000030c', true),
    ('00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-00000000030a', true),
    ('00000000-0000-0000-0000-0000000003bb', '00000000-0000-0000-0000-00000000030b', true);

  INSERT INTO public.workspace_settings (workspace_id) VALUES
    ('00000000-0000-0000-0000-0000000003aa'),
    ('00000000-0000-0000-0000-0000000003ee'),
    ('00000000-0000-0000-0000-0000000003bb');

  -- W's data, one row in every table delete_workspace() clears. The four
  -- audited tables (clients, services, appointments, visits) each fire the
  -- real audit trigger; the client UPDATE adds an UPDATE audit row.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003aa', 'Deletion Flow Test Client W');
  UPDATE public.clients SET full_name = 'Deletion Flow Test Client W (renamed)'
    WHERE id = '00000000-0000-0000-0000-0000000003c1';
  INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES
    ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003aa', 'Deletion Flow Test Service W', 'haircut', 100, 30);
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES
    ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003c1',
     '2026-10-12T09:00:00Z', '2026-10-12T09:30:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id) VALUES
    ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003d1');
  INSERT INTO public.visits (id, workspace_id, client_id, appointment_id) VALUES
    ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003c1',
     '00000000-0000-0000-0000-0000000003a1');
  INSERT INTO public.revenues (id, workspace_id, visit_id, gross_amount, payment_method) VALUES
    ('00000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003f1', 100, 'cash');
  INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose) VALUES
    ('00000000-0000-0000-0000-000000000361', '00000000-0000-0000-0000-0000000003aa', 'expense', '00000000-0000-0000-0000-000000000371',
     'https://example.invalid/del-flow-test-receipt.pdf', 'application/pdf', 'receipt');
  INSERT INTO public.expenses (id, workspace_id, receipt_file_id, amount, category) VALUES
    ('00000000-0000-0000-0000-000000000371', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-000000000361', 25, 'supplies');
  INSERT INTO public.tags (id, workspace_id, name) VALUES
    ('00000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-0000000003aa', 'Deletion Flow Test Tag');
  INSERT INTO public.client_tags (client_id, tag_id) VALUES
    ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-000000000381');
  INSERT INTO public.ai_history (id, workspace_id, client_id, insight_type, input_context, ai_response, model_name) VALUES
    ('00000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003c1',
     'test', '{}'::jsonb, '{}'::jsonb, 'test-model');
  INSERT INTO public.notifications (id, workspace_id, recipient_profile_id, title, body, channel) VALUES
    ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-00000000030c',
     'Deletion Flow Test', 'Synthetic notification', 'app');

  -- WX's data: must survive every deletion of W and E untouched.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000003c3', '00000000-0000-0000-0000-0000000003bb', 'Deletion Flow Test Client WX');
  INSERT INTO public.tags (id, workspace_id, name) VALUES
    ('00000000-0000-0000-0000-000000000383', '00000000-0000-0000-0000-0000000003bb', 'Deletion Flow Test Tag WX');

  -- E: a client that was added and later removed -- leaves 2 audit rows
  -- (INSERT + DELETE) and no data rows.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-0000000003ee', 'Deletion Flow Test Client E');
  DELETE FROM public.clients WHERE id = '00000000-0000-0000-0000-0000000003c2';

  IF (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003aa') != 5
     OR (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003ee') != 2
     OR (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003bb') != 1 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST SETUP FAILED: audit trigger did not produce the expected audit rows (W=%, E=%, WX=%).',
      (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003aa'),
      (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003ee'),
      (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000003bb');
  END IF;
END $$;

-- Test-only helper (pg_temp, and inside the always-rolled-back
-- transaction): one row per table with the row count and an md5 digest of
-- every row scoped to the given workspace -- the workspace row itself, all
-- 14 tables delete_workspace() clears, and the workspace's audit rows.
-- Only ever called as the test's setup role, never by the roles under test.
CREATE FUNCTION pg_temp.delete_flow_fingerprint(ws uuid)
RETURNS TABLE (tbl text, n bigint, digest text)
LANGUAGE sql STABLE AS $$
  SELECT 'workspaces', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.workspaces t WHERE t.id = ws
  UNION ALL SELECT 'workspace_staff', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.workspace_staff t WHERE t.workspace_id = ws
  UNION ALL SELECT 'workspace_settings', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.workspace_settings t WHERE t.workspace_id = ws
  UNION ALL SELECT 'clients', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.clients t WHERE t.workspace_id = ws
  UNION ALL SELECT 'services', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.services t WHERE t.workspace_id = ws
  UNION ALL SELECT 'appointments', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.appointments t WHERE t.workspace_id = ws
  UNION ALL SELECT 'appointment_services', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.appointment_services t
    WHERE t.appointment_id IN (SELECT a.id FROM public.appointments a WHERE a.workspace_id = ws)
  UNION ALL SELECT 'visits', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.visits t WHERE t.workspace_id = ws
  UNION ALL SELECT 'revenues', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.revenues t WHERE t.workspace_id = ws
  UNION ALL SELECT 'expenses', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.expenses t WHERE t.workspace_id = ws
  UNION ALL SELECT 'files', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.files t WHERE t.workspace_id = ws
  UNION ALL SELECT 'tags', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.tags t WHERE t.workspace_id = ws
  UNION ALL SELECT 'client_tags', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.client_tags t
    WHERE t.client_id IN (SELECT c.id FROM public.clients c WHERE c.workspace_id = ws)
  UNION ALL SELECT 'ai_history', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.ai_history t WHERE t.workspace_id = ws
  UNION ALL SELECT 'notifications', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.notifications t WHERE t.workspace_id = ws
  UNION ALL SELECT 'audit_logs', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.audit_logs t WHERE t.workspace_id = ws
$$;

-- Baselines taken right after setup.
CREATE TEMP TABLE delete_flow_baseline ON COMMIT DROP AS
  SELECT ws, f.* FROM unnest(ARRAY[
    '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb'
  ]::uuid[]) AS ws, pg_temp.delete_flow_fingerprint(ws) AS f;
CREATE TEMP TABLE delete_flow_audit_baseline ON COMMIT DROP AS
  SELECT * FROM public.audit_logs
  WHERE workspace_id IN ('00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee');

-- Raises unless every row of the given workspaces still matches its
-- baseline exactly. Same pg_temp / always-rolled-back containment.
CREATE FUNCTION pg_temp.assert_delete_flow_unchanged(label text, workspaces uuid[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  diff record;
BEGIN
  FOR diff IN
    SELECT b.ws, b.tbl, b.n AS expected_n, f.n AS actual_n
    FROM delete_flow_baseline b
    CROSS JOIN LATERAL pg_temp.delete_flow_fingerprint(b.ws) f
    WHERE b.ws = ANY (workspaces) AND f.tbl = b.tbl AND (f.n, f.digest) IS DISTINCT FROM (b.n, b.digest)
  LOOP
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: % changed workspace % table % (rows % -> %, or row contents changed).',
      label, diff.ws, diff.tbl, diff.expected_n, diff.actual_n;
  END LOOP;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM delete_flow_baseline
      WHERE ws = '00000000-0000-0000-0000-0000000003aa' AND tbl != 'audit_logs' AND n = 1) != 14
     OR (SELECT n FROM delete_flow_baseline WHERE ws = '00000000-0000-0000-0000-0000000003aa' AND tbl = 'workspace_staff') != 2 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST SETUP FAILED: W does not have the expected seed rows in every table.';
  END IF;
  RAISE NOTICE 'Deletion flow setup OK: W seeded in all 15 workspace tables, E emptied, WX separate; baselines captured.';
END $$;

-- ---------------------------------------------------------------------
-- 1. As a non-owner active MEMBER (M) of W: refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030c', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000003aa');
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member ran delete_workspace() successfully.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: 'Only the workspace owner can delete this workspace' (42501)
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_delete_flow_unchanged('the refused member call', ARRAY[
  '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 1 PASSED: non-owner member refused (42501); W, E and WX unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 2. As an OUTSIDER (X, owner of WX only): refused for W and E.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030b', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  target uuid;
BEGIN
  FOREACH target IN ARRAY ARRAY['00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee']::uuid[] LOOP
    BEGIN
      PERFORM public.delete_workspace(target);
      RAISE EXCEPTION 'DELETION FLOW TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner of another workspace deleted workspace %.', target;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
  END LOOP;
END $$;

RESET ROLE;
SELECT pg_temp.assert_delete_flow_unchanged('the refused outsider call', ARRAY[
  '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 2 PASSED: owner of a different workspace refused (42501); W, E and WX unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 3. As ANON: refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000003aa');
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED -- SECURITY BOUNDARY BROKEN: anon ran delete_workspace() successfully.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_delete_flow_unchanged('the refused anon call', ARRAY[
  '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 3 PASSED: anon refused (42501); W, E and WX unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 4. As the OWNER (O): a nonexistent id and a NULL id are refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030a', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000003ff');
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: delete_workspace() accepted a nonexistent workspace id.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: same 42501 as a non-owner, so existence is not revealed
  END;
  BEGIN
    PERFORM public.delete_workspace(NULL);
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: delete_workspace() accepted a NULL workspace id.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_delete_flow_unchanged('the owner''s nonexistent/NULL id call', ARRAY[
  '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 4 PASSED: owner refused for nonexistent and NULL ids (42501); W, E and WX unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 5. Atomicity: force a failure partway through the OWNER's call.
--    A test-only BEFORE DELETE trigger on tags raises -- tags are deleted
--    after appointment_services, client_tags, revenues, ai_history,
--    expenses, notifications, appointments, visits, services and clients
--    (and after 4 DELETE audit rows were written), but before files,
--    settings, staff, the audit detach and the workspace row. The trigger
--    and its function exist only inside this always-rolled-back
--    transaction, and are dropped again before test 6.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.delete_flow_test_forced_failure() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'deletion flow test: forced failure partway through delete_workspace()' USING ERRCODE = 'ZX001';
END $$;
CREATE TRIGGER delete_flow_test_forced_failure BEFORE DELETE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.delete_flow_test_forced_failure();

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030a', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000003aa');
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the forced failure did not fire -- the atomicity test proved nothing.';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    NULL; -- expected: the call failed with the forced error, reported to the caller as-is
  END;
END $$;

RESET ROLE;
DROP TRIGGER delete_flow_test_forced_failure ON public.tags;
DROP FUNCTION public.delete_flow_test_forced_failure();

SELECT pg_temp.assert_delete_flow_unchanged('the failed (rolled-back) owner call', ARRAY[
  '00000000-0000-0000-0000-0000000003aa', '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$
BEGIN
  -- The DELETE audit rows written before the failure must be gone too.
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'DELETE' AND record_id IN (
       '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1',
       '00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003f1')) THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: audit rows from the failed call survived its rollback.';
  END IF;
  RAISE NOTICE 'Deletion flow test 5 PASSED: failure partway through rolled back the whole call; every row and audit row unchanged.';
END $$;

-- ---------------------------------------------------------------------
-- 6. As the OWNER (O): delete_workspace(W) succeeds.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030a', 'role', 'authenticated')::text, true);

SELECT public.delete_workspace('00000000-0000-0000-0000-0000000003aa');

RESET ROLE;

DO $$
DECLARE
  remaining record;
  audited_ids uuid[] := ARRAY[
    '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1',
    '00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003f1'
  ]::uuid[];
BEGIN
  -- Every table is empty for W. (appointment_services/client_tags are
  -- checked by their own seeded keys, since their parents are gone.)
  FOR remaining IN
    SELECT tbl, n FROM pg_temp.delete_flow_fingerprint('00000000-0000-0000-0000-0000000003aa') WHERE n != 0
  LOOP
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: % row(s) left in % for the deleted workspace.', remaining.n, remaining.tbl;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.appointment_services WHERE appointment_id = '00000000-0000-0000-0000-0000000003a1')
     OR EXISTS (SELECT 1 FROM public.client_tags WHERE client_id = '00000000-0000-0000-0000-0000000003c1')
     OR EXISTS (SELECT 1 FROM public.files WHERE id = '00000000-0000-0000-0000-000000000361')
     OR EXISTS (SELECT 1 FROM public.expenses WHERE id = '00000000-0000-0000-0000-000000000371') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: join/leaf rows of the deleted workspace survived.';
  END IF;

  -- Every pre-existing audit row of W is preserved, identical except
  -- workspace_id, which is now NULL.
  IF (SELECT count(*) FROM delete_flow_audit_baseline b
      JOIN public.audit_logs a ON a.id = b.id
      WHERE b.workspace_id = '00000000-0000-0000-0000-0000000003aa'
        AND a.workspace_id IS NULL
        AND (a.actor_id, a.table_name, a.record_id, a.action, a.old_value, a.new_value, a.performed_at)
            IS NOT DISTINCT FROM
            (b.actor_id, b.table_name, b.record_id, b.action, b.old_value, b.new_value, b.performed_at)) != 5 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: W''s 5 earlier audit rows were not all preserved unchanged with workspace_id NULL.';
  END IF;
  -- Each audited record got exactly one DELETE audit row, also detached.
  IF (SELECT count(*) FROM public.audit_logs WHERE action = 'DELETE' AND record_id = ANY (audited_ids) AND workspace_id IS NULL) != 4
     OR (SELECT count(DISTINCT record_id) FROM public.audit_logs WHERE action = 'DELETE' AND record_id = ANY (audited_ids)) != 4 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: expected exactly one detached DELETE audit row per audited record (4), got %.',
      (SELECT count(*) FROM public.audit_logs WHERE action = 'DELETE' AND record_id = ANY (audited_ids));
  END IF;
  -- delete_workspace() runs as the owner's own request: the DELETE rows
  -- record the owner as actor.
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'DELETE' AND record_id = ANY (audited_ids)
             AND actor_id IS DISTINCT FROM '00000000-0000-0000-0000-00000000030a') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: DELETE audit rows do not record the owner as actor.';
  END IF;

  -- No collateral damage: profiles survive, E and WX are untouched.
  IF (SELECT count(*) FROM public.profiles WHERE id IN (
        '00000000-0000-0000-0000-00000000030a', '00000000-0000-0000-0000-00000000030b', '00000000-0000-0000-0000-00000000030c')) != 3 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: deleting the workspace removed a profile.';
  END IF;
END $$;

SELECT pg_temp.assert_delete_flow_unchanged('the owner''s deletion of W', ARRAY[
  '00000000-0000-0000-0000-0000000003ee', '00000000-0000-0000-0000-0000000003bb']::uuid[]);
-- Audit rows for W after the call: the 5 earlier rows plus 5 new ones --
-- the 4 DELETE rows checked above, and 1 UPDATE row on visits written when
-- deleting the appointment fires visits.appointment_id ON DELETE SET NULL
-- (visits is audited). Every one of them is detached: the fingerprint
-- check above requires zero audit rows still referencing W.
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 6 PASSED: owner deleted W and its rows in all 14 child tables; 5 earlier audit rows preserved unchanged and every new audit row (incl. 4 DELETE) detached with workspace_id NULL; profiles, E and WX untouched.'; END $$;

-- ---------------------------------------------------------------------
-- 7. As the OWNER (O): delete_workspace(E) succeeds for an emptied
--    workspace; its audit rows are preserved, detached.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030a', 'role', 'authenticated')::text, true);

SELECT public.delete_workspace('00000000-0000-0000-0000-0000000003ee');

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_temp.delete_flow_fingerprint('00000000-0000-0000-0000-0000000003ee') WHERE n != 0) THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the emptied workspace E or its staff/settings survived delete_workspace().';
  END IF;
  IF (SELECT count(*) FROM delete_flow_audit_baseline b
      JOIN public.audit_logs a ON a.id = b.id
      WHERE b.workspace_id = '00000000-0000-0000-0000-0000000003ee' AND a.workspace_id IS NULL) != 2 THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: E''s 2 audit rows were not preserved with workspace_id NULL.';
  END IF;
END $$;

SELECT pg_temp.assert_delete_flow_unchanged('the owner''s deletion of E', ARRAY['00000000-0000-0000-0000-0000000003bb']::uuid[]);
DO $$ BEGIN RAISE NOTICE 'Deletion flow test 7 PASSED: owner deleted the emptied workspace E; its 2 audit rows preserved with workspace_id NULL; WX untouched.'; END $$;

-- ---------------------------------------------------------------------
-- 8. As the OWNER (O), now with no workspaces left: onboarding works again.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000030a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  new_ws uuid;
BEGIN
  new_ws := public.bootstrap_professional_workspace('Deletion Flow Test Reonboard', 'salon', 'Riyadh');
  IF new_ws IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = new_ws
                    AND owner_id = '00000000-0000-0000-0000-00000000030a' AND subscription_status = 'trial')
     OR NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = new_ws
                    AND profile_id = '00000000-0000-0000-0000-00000000030a' AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.workspace_settings WHERE workspace_id = new_ws) THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: re-onboarding after deleting every workspace did not create a usable trial workspace.';
  END IF;
  RAISE NOTICE 'Deletion flow test 8 PASSED: owner re-onboarded after deleting all their workspaces (new trial workspace, staff, settings).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 9. Nothing else changed: delete_workspace() itself, the RLS policy, the
--    foreign keys, and the S1 / S1-b privileges.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT bool_and(p.prosecdef) AND count(*) = 1
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'delete_workspace')
     OR NOT has_function_privilege('authenticated', 'public.delete_workspace(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.delete_workspace(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.delete_workspace(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: delete_workspace() or its EXECUTE grants changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_flow_test_forced_failure')
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'delete_flow_test_forced_failure') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the test-only forced-failure trigger was not removed.';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces') != 1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspace_access' AND cmd = 'ALL') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the workspaces RLS policy changed.';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.workspaces'::regclass) != 13
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.workspaces'::regclass AND confdeltype != 'c') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the foreign keys referencing workspaces changed (expected 13, all ON DELETE CASCADE).';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.workspaces', 'locale', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspaces', 'plan_tier', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.workspaces', 'UPDATE')
     OR has_any_column_privilege('anon', 'public.workspaces', 'UPDATE') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the S1 column-level UPDATE grants changed.';
  END IF;
  IF has_table_privilege('authenticated', 'public.workspaces', 'DELETE')
     OR has_table_privilege('anon', 'public.workspaces', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.workspaces', 'DELETE') THEN
    RAISE EXCEPTION 'DELETION FLOW TEST FAILED: the S1-b DELETE privileges changed.';
  END IF;
  RAISE NOTICE 'Deletion flow test 9 PASSED: delete_workspace() and its grants, the policy, 13 CASCADE foreign keys, and S1 / S1-b privileges unchanged.';
  RAISE NOTICE 'Workspace deletion flow test PASSED: all 9 checks hold (real local Postgres, real grants, RLS, triggers, no mocking).';
END $$;

ROLLBACK;
