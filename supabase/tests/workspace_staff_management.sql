-- Real integration test: workspace staff management (S4),
-- public.workspace_staff row level security and column privileges
-- (20261015120000_restrict_workspace_staff_management.sql).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied,
-- that:
--   1. An active MEMBER can read their workspace's staff list (and only
--      their own workspace's).
--   2. A non-owner MEMBER cannot add an outsider, delete or deactivate the
--      owner's row, reactivate a deactivated colleague, change a
--      commission (even their own), or re-point a row's workspace/profile.
--   3. An OUTSIDER (owner of another workspace) cannot read or manage the
--      staff list.
--   4. ANON cannot read or manage the staff list.
--      After every refused attempt, both workspaces' staff rows are
--      byte-for-byte unchanged.
--   5. The OWNER cannot delete or deactivate their own row, cannot move a
--      row to another workspace or re-point its profile, and cannot manage
--      another workspace's staff -- but can add, update, deactivate,
--      reactivate, and remove other staff.
--   6. An owner whose own staff row is missing (the pre-fix lockout) is
--      still recognised as owner and can re-add their own row -- active only.
--   7. Onboarding (bootstrap_professional_workspace()) and
--      delete_workspace() still work.
--   8. Catalog: exactly the four new policies, for authenticated only;
--      is_workspace_owner() is SECURITY DEFINER with search_path=public and
--      EXECUTE only for authenticated and service_role; authenticated may
--      UPDATE only is_active and base_commission_pct; anon may UPDATE nothing.
--
-- Same session mechanism as the other tests: `SET LOCAL ROLE` plus the
-- `request.jwt.claims` setting auth.uid() reads from. Entirely wrapped in
-- one transaction that is ALWAYS rolled back; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000008xx) distinct from the other test
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
-- O = owner of W, M = active staff of W (commission 10), D = deactivated
-- staff of W, X = outsider, owner of WX, A = a user with no workspace,
-- N = brand-new user (onboarding).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000080a', 'staff-test-owner@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000080c', 'staff-test-member@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000080d', 'staff-test-deactivated@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000080b', 'staff-test-outsider@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000080e', 'staff-test-accomplice@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000080f', 'staff-test-new@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000080a', 'Staff Test Owner'),
    ('00000000-0000-0000-0000-00000000080c', 'Staff Test Member'),
    ('00000000-0000-0000-0000-00000000080d', 'Staff Test Deactivated'),
    ('00000000-0000-0000-0000-00000000080b', 'Staff Test Outsider'),
    ('00000000-0000-0000-0000-00000000080e', 'Staff Test Accomplice'),
    ('00000000-0000-0000-0000-00000000080f', 'Staff Test New User')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', 'Staff Test W', 'staff-test-w', 'Staff Test W'),
    ('00000000-0000-0000-0000-0000000008bb', '00000000-0000-0000-0000-00000000080b', 'Staff Test WX', 'staff-test-wx', 'Staff Test WX');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active, base_commission_pct) VALUES
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', true, 0),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080c', true, 10),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080d', false, 5),
    ('00000000-0000-0000-0000-0000000008bb', '00000000-0000-0000-0000-00000000080b', true, 0);
END $$;

-- Test-only helpers (pg_temp, inside the always-rolled-back transaction),
-- only ever called as the test's setup role.
CREATE FUNCTION pg_temp.staff_fingerprint(ws uuid)
RETURNS TABLE (n bigint, digest text)
LANGUAGE sql STABLE AS $$
  SELECT count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), ''))
  FROM public.workspace_staff t WHERE t.workspace_id = ws
$$;

CREATE TEMP TABLE staff_baseline ON COMMIT DROP AS
  SELECT ws, f.* FROM unnest(ARRAY['00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008bb']::uuid[]) AS ws,
         pg_temp.staff_fingerprint(ws) AS f;

CREATE FUNCTION pg_temp.assert_staff_unchanged(label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  diff record;
BEGIN
  FOR diff IN
    SELECT b.ws, b.n AS expected_n, f.n AS actual_n
    FROM staff_baseline b CROSS JOIN LATERAL pg_temp.staff_fingerprint(b.ws) f
    WHERE (f.n, f.digest) IS DISTINCT FROM (b.n, b.digest)
  LOOP
    RAISE EXCEPTION 'S4 TEST FAILED: % changed the staff rows of workspace % (rows % -> %, or row contents changed).', label, diff.ws, diff.expected_n, diff.actual_n;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 1 + 2. As the non-owner MEMBER (M): can read, cannot manage.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080c', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- 1. Read access: own workspace's full staff list, nothing of WX.
  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 3
     OR (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008bb') != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED: a member does not see exactly their own workspace''s 3 staff rows (and none of another workspace).';
  END IF;
  RAISE NOTICE 'S4 test 1 PASSED: active member reads their own workspace''s staff list (3 rows) and nothing of another workspace.';

  -- 2. Management attempts, each refused.
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080e', true);
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member added an outsider to the staff list.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: new row violates row-level security policy (42501)
  END;

  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member deleted the owner''s staff row.';
  END IF;

  UPDATE public.workspace_staff SET is_active = false
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member deactivated the owner.';
  END IF;

  UPDATE public.workspace_staff SET is_active = true
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080d';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member reactivated a deactivated colleague.';
  END IF;

  UPDATE public.workspace_staff SET base_commission_pct = 99
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member changed % commission(s).', n;
  END IF;

  BEGIN
    UPDATE public.workspace_staff SET profile_id = '00000000-0000-0000-0000-00000000080e'
    WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member could re-point a staff row''s profile.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: no UPDATE privilege on profile_id (42501)
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_staff_unchanged('the non-owner member');
DO $$ BEGIN RAISE NOTICE 'S4 test 2 PASSED: non-owner member cannot add an outsider, delete/deactivate the owner, reactivate a colleague, change commissions, or re-point a row; staff unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 3. As an OUTSIDER (X, owner of WX only): cannot read or manage W's staff.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080b', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider can read another workspace''s staff list.';
  END IF;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080b', true);
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider added themselves to another workspace.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  UPDATE public.workspace_staff SET is_active = false WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider deactivated % staff row(s) of another workspace.', n;
  END IF;
  DELETE FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider deleted % staff row(s) of another workspace.', n;
  END IF;
END $$;

RESET ROLE;
SELECT pg_temp.assert_staff_unchanged('the outsider');
DO $$ BEGIN RAISE NOTICE 'S4 test 3 PASSED: outsider cannot read, add to, update, or delete another workspace''s staff list; staff unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 4. As ANON: cannot read or manage the staff list.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff) != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon can read staff rows.';
  END IF;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080e', true);
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon added a staff row.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  BEGIN
    UPDATE public.workspace_staff SET is_active = false WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon still holds UPDATE on workspace_staff.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: anon has no UPDATE privilege (42501)
  END;
  DELETE FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon deleted % staff row(s).', n;
  END IF;
END $$;

RESET ROLE;
SELECT pg_temp.assert_staff_unchanged('anon');
DO $$ BEGIN RAISE NOTICE 'S4 test 4 PASSED: anon cannot read, add, update, or delete staff rows; staff unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 5. As the OWNER (O): own row protected; can manage other staff.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- Own row: cannot delete, cannot deactivate.
  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED: the owner deleted their own staff row (self-lockout).';
  END IF;
  BEGIN
    UPDATE public.workspace_staff SET is_active = false
    WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
    RAISE EXCEPTION 'S4 TEST FAILED: the owner deactivated their own staff row (self-lockout).';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: new row violates row-level security policy (42501)
  END;

  -- Cannot move a row to another workspace, or re-point its profile.
  BEGIN
    UPDATE public.workspace_staff SET workspace_id = '00000000-0000-0000-0000-0000000008bb'
    WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
    RAISE EXCEPTION 'S4 TEST FAILED: the owner moved a staff row to another workspace.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: no UPDATE privilege on workspace_id (42501)
  END;
  BEGIN
    UPDATE public.workspace_staff SET profile_id = '00000000-0000-0000-0000-00000000080e'
    WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
    RAISE EXCEPTION 'S4 TEST FAILED: the owner re-pointed their own staff row at another profile.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;

  -- Cannot manage another workspace's staff.
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008bb', '00000000-0000-0000-0000-00000000080e', true);
    RAISE EXCEPTION 'S4 TEST FAILED: the owner of W added staff to another workspace.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_staff_unchanged('the owner''s refused attempts');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- Can add, update, deactivate, reactivate, and remove other staff.
  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
  VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080e', true);
  UPDATE public.workspace_staff SET base_commission_pct = 25
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'S4 TEST FAILED: the owner could not update a commission (% rows).', n; END IF;
  UPDATE public.workspace_staff SET is_active = false
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'S4 TEST FAILED: the owner could not deactivate a staff member (% rows).', n; END IF;
  UPDATE public.workspace_staff SET is_active = true
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080d';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'S4 TEST FAILED: the owner could not reactivate a staff member (% rows).', n; END IF;
  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080e';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'S4 TEST FAILED: the owner could not remove a staff member (% rows).', n; END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa'
                 AND profile_id = '00000000-0000-0000-0000-00000000080a' AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa'
                    AND profile_id = '00000000-0000-0000-0000-00000000080c' AND NOT is_active AND base_commission_pct = 25)
     OR NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa'
                    AND profile_id = '00000000-0000-0000-0000-00000000080d' AND is_active)
     OR EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = '00000000-0000-0000-0000-00000000080e') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: the owner''s staff changes did not produce the expected rows.';
  END IF;
  IF (SELECT (n, digest) FROM pg_temp.staff_fingerprint('00000000-0000-0000-0000-0000000008bb'))
     IS DISTINCT FROM (SELECT (n, digest) FROM staff_baseline WHERE ws = '00000000-0000-0000-0000-0000000008bb') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: managing W''s staff changed another workspace''s staff rows.';
  END IF;
  RAISE NOTICE 'S4 test 5 PASSED: owner cannot delete/deactivate/re-point their own row, move rows, or manage another workspace; can add, update, deactivate, reactivate, and remove other staff; WX unchanged.';
END $$;

-- ---------------------------------------------------------------------
-- 6. Lockout recovery: the owner's own staff row is missing.
-- ---------------------------------------------------------------------
DELETE FROM public.workspace_staff
WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  IF NOT public.is_workspace_owner('00000000-0000-0000-0000-0000000008aa') OR public.is_workspace_member('00000000-0000-0000-0000-0000000008aa') THEN
    RAISE EXCEPTION 'S4 TEST SETUP FAILED: expected an owner without a staff row.';
  END IF;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', false);
    RAISE EXCEPTION 'S4 TEST FAILED: the owner re-added their own row as inactive.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
  VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', true);
  IF NOT public.is_workspace_member('00000000-0000-0000-0000-0000000008aa') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: re-adding the owner''s row did not restore their membership.';
  END IF;
  RAISE NOTICE 'S4 test 6 PASSED: an owner without a staff row is still recognised as owner and can re-add their own row (active only).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 7. Onboarding and delete_workspace() still work (new user N).
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080f', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  new_ws uuid;
BEGIN
  new_ws := public.bootstrap_professional_workspace('Staff Test Onboarding', 'salon', 'Riyadh');
  IF NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = new_ws
                 AND profile_id = '00000000-0000-0000-0000-00000000080f' AND is_active)
     OR NOT public.is_workspace_owner(new_ws) THEN
    RAISE EXCEPTION 'S4 TEST FAILED: onboarding did not create an owner with an active staff row.';
  END IF;
  PERFORM public.delete_workspace(new_ws);
  IF EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = new_ws) THEN
    RAISE EXCEPTION 'S4 TEST FAILED: delete_workspace() left staff rows behind.';
  END IF;
  RAISE NOTICE 'S4 test 7 PASSED: onboarding creates the owner''s active staff row; delete_workspace() still removes the workspace''s staff.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 8. Catalog: policies, helper function, privileges.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff') != 4
     OR (SELECT string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ','), ' ' ORDER BY policyname)
           FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
        != 'workspace_staff_delete_owner:DELETE:authenticated workspace_staff_insert_owner:INSERT:authenticated workspace_staff_select_members:SELECT:authenticated workspace_staff_update_owner:UPDATE:authenticated' THEN
    RAISE EXCEPTION 'S4 TEST FAILED: workspace_staff does not have exactly the four expected policies for authenticated.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_workspace_owner(uuid)'::regprocedure
                 AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'S4 TEST FAILED: is_workspace_owner() is not SECURITY DEFINER with search_path=public.';
  END IF;
  IF has_function_privilege('anon', 'public.is_workspace_owner(uuid)', 'EXECUTE')
     OR has_function_privilege('public', 'public.is_workspace_owner(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_workspace_owner(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.is_workspace_owner(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: is_workspace_owner() EXECUTE is not exactly authenticated + service_role.';
  END IF;
  IF has_table_privilege('authenticated', 'public.workspace_staff', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.workspace_staff', 'is_active', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.workspace_staff', 'base_commission_pct', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspace_staff', 'workspace_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspace_staff', 'profile_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspace_staff', 'id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspace_staff', 'joined_at', 'UPDATE')
     OR has_any_column_privilege('anon', 'public.workspace_staff', 'UPDATE') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: workspace_staff UPDATE privileges are not exactly is_active + base_commission_pct for authenticated.';
  END IF;
  RAISE NOTICE 'S4 test 8 PASSED: exactly four authenticated-only policies; is_workspace_owner() SECURITY DEFINER, EXECUTE for authenticated + service_role only; UPDATE limited to is_active and base_commission_pct.';
  RAISE NOTICE 'S4 workspace-staff management test PASSED: all 8 checks hold (real local Postgres, real grants and row level security, no mocking).';
END $$;

ROLLBACK;
