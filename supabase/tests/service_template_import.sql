-- Real integration test: service-template import authorization (S2),
-- public.import_service_templates()
-- (20261013120000_restrict_import_service_templates.sql).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied,
-- that:
--   1. An active MEMBER can import templates into their workspace; the
--      import is audited with the member as actor, and deduplication by
--      service name is unchanged (existing names skipped, a repeat call
--      imports 0).
--   2. An OUTSIDER (owner of another workspace) is refused (42501) for the
--      victim workspace, but can still import into their own.
--   3. An INACTIVE staff member of the victim workspace is refused.
--   4. ANON is refused at the EXECUTE privilege (42501), before the body.
--   5. A member passing a NULL workspace id is refused.
--   6. service_role keeps EXECUTE, but a call without a member's auth.uid()
--      is refused by the membership check.
--      After every refusal above, the victim workspace's services and audit
--      history are byte-for-byte unchanged.
--   7. Onboarding still works: a new user bootstraps a workspace and
--      imports templates into it.
--   8. Privileges and definition: EXECUTE is held by authenticated and
--      service_role but not anon or PUBLIC; the function is still SECURITY
--      DEFINER with search_path=public; the services_access policy is
--      unchanged.
--
-- Same session mechanism as the other tests: `SET LOCAL ROLE` plus the
-- `request.jwt.claims` setting auth.uid() reads from. Entirely wrapped in
-- one transaction that is ALWAYS rolled back; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000005xx) distinct from the other test
-- files'.
--
-- Local-only guard: the first statement after BEGIN refuses to run unless
-- the session setting beautyroute.local_rls_test is 'on', which only
-- scripts/test-rls-local.sh sets (via PGOPTIONS on its docker exec). Any
-- other route -- psql against a remote URL, `supabase db query --linked`,
-- a SQL editor -- stops there, before any setup. The guard covers
-- whole-file runs only: never run a selection of this file by hand.

BEGIN;

DO $$
BEGIN
  IF current_setting('beautyroute.local_rls_test', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'REFUSING TO RUN: local-only test. Run it via scripts/test-rls-local.sh (npm run test:rls:local), never directly.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Setup (as the connecting superuser-equivalent role, test setup only).
-- O = owner of victim workspace V, M = active staff of V,
-- I = inactive staff of V, X = outsider, owner of workspace WX,
-- N = brand-new user with no workspace (onboarding).
-- Templates A, B, C are synthetic catalog rows; V already has a service
-- named like B.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000050a', 'import-test-owner@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000050c', 'import-test-staff@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000050d', 'import-test-inactive@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000050b', 'import-test-outsider@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000050e', 'import-test-new@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000050a', 'Import Test Owner'),
    ('00000000-0000-0000-0000-00000000050c', 'Import Test Staff'),
    ('00000000-0000-0000-0000-00000000050d', 'Import Test Inactive Staff'),
    ('00000000-0000-0000-0000-00000000050b', 'Import Test Outsider'),
    ('00000000-0000-0000-0000-00000000050e', 'Import Test New User')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-00000000050a', 'Import Test V', 'import-test-v', 'Import Test V'),
    ('00000000-0000-0000-0000-0000000005bb', '00000000-0000-0000-0000-00000000050b', 'Import Test WX', 'import-test-wx', 'Import Test WX');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-00000000050a', true),
    ('00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-00000000050c', true),
    ('00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-00000000050d', false),
    ('00000000-0000-0000-0000-0000000005bb', '00000000-0000-0000-0000-00000000050b', true);

  INSERT INTO public.service_templates (id, category, name, default_duration, default_price) VALUES
    ('00000000-0000-0000-0000-0000000005f1', 'haircut', 'Import Test Template A', 30, 50),
    ('00000000-0000-0000-0000-0000000005f2', 'haircut', 'Import Test Template B', 45, 80),
    ('00000000-0000-0000-0000-0000000005f3', 'styling', 'Import Test Template C', 60, 120);

  -- V already offers a service with template B's name (fires the real
  -- audit trigger: 1 audit row for V).
  INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES
    ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005aa', 'Import Test Template B', 'haircut', 95, 45);
END $$;

-- Test-only helper (pg_temp, inside the always-rolled-back transaction):
-- row count and md5 digest of a workspace's services and of its audit rows.
-- Only ever called as the test's setup role, never by the roles under test.
CREATE FUNCTION pg_temp.import_fingerprint(ws uuid)
RETURNS TABLE (tbl text, n bigint, digest text)
LANGUAGE sql STABLE AS $$
  SELECT 'services', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.services t WHERE t.workspace_id = ws
  UNION ALL SELECT 'audit_logs', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.audit_logs t WHERE t.workspace_id = ws
$$;

-- ---------------------------------------------------------------------
-- 1. As an active MEMBER (M) of V: import works, is audited, deduplicates.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000050c', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  imported int;
BEGIN
  imported := public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY[
    '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005f2']::uuid[]);
  IF imported != 1 THEN
    RAISE EXCEPTION 'S2 TEST FAILED: member import of [A, B] into V returned % (expected 1: A imported, B already present).', imported;
  END IF;
  imported := public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY[
    '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005f2']::uuid[]);
  IF imported != 0 THEN
    RAISE EXCEPTION 'S2 TEST FAILED: repeating the member import returned % (expected 0 -- deduplication by name).', imported;
  END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.services WHERE workspace_id = '00000000-0000-0000-0000-0000000005aa' AND name = 'Import Test Template A'
        AND category = 'haircut' AND price = 50 AND duration_minutes = 30 AND is_active) != 1
     OR (SELECT count(*) FROM public.services WHERE workspace_id = '00000000-0000-0000-0000-0000000005aa' AND name = 'Import Test Template B') != 1
     OR NOT EXISTS (SELECT 1 FROM public.services WHERE id = '00000000-0000-0000-0000-0000000005d1' AND price = 95) THEN
    RAISE EXCEPTION 'S2 TEST FAILED: member import did not produce exactly one copy of A with the template values, leaving the existing B untouched.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs a JOIN public.services s ON s.id = a.record_id
    WHERE s.workspace_id = '00000000-0000-0000-0000-0000000005aa' AND s.name = 'Import Test Template A'
      AND a.table_name = 'services' AND a.action = 'INSERT'
      AND a.actor_id = '00000000-0000-0000-0000-00000000050c') THEN
    RAISE EXCEPTION 'S2 TEST FAILED: the member''s import was not audited with the member as actor.';
  END IF;
  RAISE NOTICE 'S2 test 1 PASSED: active member imported into V (A added once, existing B skipped, repeat imports 0), audited with the member as actor.';
END $$;

-- Baseline of V after the legitimate import: every refusal below must
-- leave it exactly like this.
CREATE TEMP TABLE import_baseline ON COMMIT DROP AS
  SELECT * FROM pg_temp.import_fingerprint('00000000-0000-0000-0000-0000000005aa');

CREATE FUNCTION pg_temp.assert_victim_unchanged(label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  diff record;
BEGIN
  FOR diff IN
    SELECT b.tbl, b.n AS expected_n, f.n AS actual_n
    FROM import_baseline b
    JOIN pg_temp.import_fingerprint('00000000-0000-0000-0000-0000000005aa') f ON f.tbl = b.tbl
    WHERE (f.n, f.digest) IS DISTINCT FROM (b.n, b.digest)
  LOOP
    RAISE EXCEPTION 'S2 TEST FAILED: % changed V''s % (rows % -> %, or row contents changed).', label, diff.tbl, diff.expected_n, diff.actual_n;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. As an OUTSIDER (X, owner of WX only): refused for V, allowed for WX.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000050b', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  imported int;
BEGIN
  BEGIN
    PERFORM public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider imported templates into another workspace.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: 'Only an active member of this workspace can import service templates' (42501)
  END;
  -- Name probing no longer works either: a template V already has is refused the same way.
  BEGIN
    PERFORM public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY['00000000-0000-0000-0000-0000000005f2']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider could probe another workspace''s service names.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  imported := public.import_service_templates('00000000-0000-0000-0000-0000000005bb', ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
  IF imported != 1 THEN
    RAISE EXCEPTION 'S2 TEST FAILED: the outsider could not import into their own workspace WX (returned %).', imported;
  END IF;
END $$;

RESET ROLE;
SELECT pg_temp.assert_victim_unchanged('the refused outsider call');
DO $$ BEGIN RAISE NOTICE 'S2 test 2 PASSED: outsider refused for V (42501, no name probing); can still import into their own workspace; V unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 3. As an INACTIVE staff member (I) of V: refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000050d', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED -- SECURITY BOUNDARY BROKEN: an inactive staff member imported templates.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_victim_unchanged('the refused inactive-staff call');
DO $$ BEGIN RAISE NOTICE 'S2 test 3 PASSED: inactive staff member refused (42501); V unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 4. As ANON: refused at the EXECUTE privilege.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon imported templates into a workspace.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: permission denied for function import_service_templates (42501)
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_victim_unchanged('the refused anon call');
DO $$ BEGIN RAISE NOTICE 'S2 test 4 PASSED: anon refused (42501); V unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 5. As the MEMBER (M): a NULL workspace id is refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000050c', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.import_service_templates(NULL, ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED: import_service_templates() accepted a NULL workspace id.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_victim_unchanged('the NULL-id call');
DO $$ BEGIN RAISE NOTICE 'S2 test 5 PASSED: NULL workspace id refused (42501); V unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 6. As service_role without a member's auth.uid(): EXECUTE is kept, but
--    the membership check refuses the call.
-- ---------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.import_service_templates('00000000-0000-0000-0000-0000000005aa', ARRAY['00000000-0000-0000-0000-0000000005f3']::uuid[]);
    RAISE EXCEPTION 'S2 TEST FAILED: a service_role call without a member auth.uid() bypassed the membership check.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_victim_unchanged('the service_role call');
DO $$ BEGIN RAISE NOTICE 'S2 test 6 PASSED: service_role keeps EXECUTE but is refused by the membership check without a member auth.uid(); V unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 7. Onboarding (N): bootstrap a workspace, then import into it.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000050e', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  new_ws uuid;
  imported int;
BEGIN
  new_ws := public.bootstrap_professional_workspace('Import Test Onboarding', 'salon', 'Riyadh');
  imported := public.import_service_templates(new_ws, ARRAY[
    '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000005f3']::uuid[]);
  IF imported != 3
     OR (SELECT count(*) FROM public.services WHERE workspace_id = new_ws) != 3 THEN
    RAISE EXCEPTION 'S2 TEST FAILED: onboarding import into a freshly bootstrapped workspace returned % (expected 3).', imported;
  END IF;
  RAISE NOTICE 'S2 test 7 PASSED: onboarding bootstrap followed by template import still works (3 services).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 8. Privileges and definition.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('public', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'S2 TEST FAILED: anon or PUBLIC can still EXECUTE import_service_templates().';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'S2 TEST FAILED: authenticated or service_role lost EXECUTE on import_service_templates().';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.import_service_templates(uuid, uuid[])'::regprocedure
                 AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'S2 TEST FAILED: import_service_templates() is no longer SECURITY DEFINER with search_path=public.';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services') != 1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services'
                    AND policyname = 'services_access' AND cmd = 'ALL' AND qual = 'is_workspace_member(workspace_id)') THEN
    RAISE EXCEPTION 'S2 TEST FAILED: the services RLS policy changed.';
  END IF;
  RAISE NOTICE 'S2 test 8 PASSED: EXECUTE only for authenticated and service_role (not anon or PUBLIC); SECURITY DEFINER with search_path=public; services_access unchanged.';
  RAISE NOTICE 'S2 service-template import test PASSED: all 8 checks hold (real local Postgres, real grants, RLS, triggers, no mocking).';
END $$;

ROLLBACK;
