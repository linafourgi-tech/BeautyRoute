-- Real integration test: workspace staff management (S4) and workspace
-- membership consent -- public.workspace_staff row level security, column
-- privileges, and onboarding
-- (20261015120000_restrict_workspace_staff_management.sql and
-- 20261029120000_require_workspace_membership_consent.sql).
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
--   4. ANON cannot read or manage the staff list, and cannot call
--      bootstrap_professional_workspace().
--      After every refused attempt, both workspaces' staff rows are
--      byte-for-byte unchanged.
--   5. The OWNER cannot delete or deactivate their own row, cannot move a
--      row to another workspace or re-point its profile, cannot manage
--      another workspace's staff, and cannot add another user (active or
--      inactive) without that user's consent -- but can update, deactivate,
--      reactivate, and remove existing staff.
--   6. An owner whose own staff row is missing (the pre-fix lockout) is
--      still recognised as owner and can re-add their own row -- active only
--      -- but cannot create a second workspace through onboarding.
--   7. Onboarding (bootstrap_professional_workspace()) and
--      delete_workspace() still work.
--   8. Catalog: exactly the six expected policies, for authenticated only,
--      with the consent-preserving INSERT check, the self-leave DELETE
--      policy, and the own-row SELECT policy; is_workspace_owner() and bootstrap_professional_workspace()
--      are SECURITY DEFINER with search_path=public and EXECUTE only for
--      authenticated and service_role; authenticated may UPDATE only
--      is_active and base_commission_pct; anon may UPDATE nothing.
--   9. Onboarding: an inactive and an active staff member of another
--      workspace can each create their own workspace (once), without
--      changing their existing membership; an owner cannot create a second.
--  10. Leaving: a non-owner member removes only their own row -- even a
--      blanket DELETE removes nothing else -- and loses access; an inactive
--      member sees only their own row (no other staff, no workspace data),
--      cannot reactivate it or change its commission, and can leave too; nobody -- member, owner, or a user with no
--      membership -- reads staff rows of other workspaces; the owner cannot
--      leave; a member who left cannot be re-added or reactivated by the
--      owner; an outsider removes nothing.
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
-- staff of W, L = active staff of W who leaves (test 10), R = active staff
-- of W the owner removes (test 5), X = outsider, owner of WX, E = a user
-- with no workspace, N = brand-new user (onboarding).
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
    ('00000000-0000-0000-0000-00000000080f', 'staff-test-new@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-000000000810', 'staff-test-leaver@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-000000000811', 'staff-test-removed@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000080a', 'Staff Test Owner'),
    ('00000000-0000-0000-0000-00000000080c', 'Staff Test Member'),
    ('00000000-0000-0000-0000-00000000080d', 'Staff Test Deactivated'),
    ('00000000-0000-0000-0000-00000000080b', 'Staff Test Outsider'),
    ('00000000-0000-0000-0000-00000000080e', 'Staff Test Accomplice'),
    ('00000000-0000-0000-0000-00000000080f', 'Staff Test New User'),
    ('00000000-0000-0000-0000-000000000810', 'Staff Test Leaver'),
    ('00000000-0000-0000-0000-000000000811', 'Staff Test Removed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', 'Staff Test W', 'staff-test-w', 'Staff Test W'),
    ('00000000-0000-0000-0000-0000000008bb', '00000000-0000-0000-0000-00000000080b', 'Staff Test WX', 'staff-test-wx', 'Staff Test WX');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active, base_commission_pct) VALUES
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080a', true, 0),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080c', true, 10),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080d', false, 5),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-000000000810', true, 0),
    ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-000000000811', true, 0),
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
  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 5
     OR (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008bb') != 0 THEN
    RAISE EXCEPTION 'S4 TEST FAILED: a member does not see exactly their own workspace''s 5 staff rows (and none of another workspace).';
  END IF;
  RAISE NOTICE 'S4 test 1 PASSED: active member reads their own workspace''s staff list (5 rows) and nothing of another workspace.';

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
  BEGIN
    PERFORM public.bootstrap_professional_workspace('Anon Test', 'salon', 'Riyadh');
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: anon executed bootstrap_professional_workspace().';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: no EXECUTE privilege (42501)
  END;
END $$;

RESET ROLE;
SELECT pg_temp.assert_staff_unchanged('anon');
DO $$ BEGIN RAISE NOTICE 'S4 test 4 PASSED: anon cannot read, add, update, or delete staff rows, or call bootstrap_professional_workspace(); staff unchanged.'; END $$;

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

  -- Cannot add another user to their own workspace -- active, or as an
  -- inactive "pending" row -- without that user's consent.
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080e', true);
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner added another user without their consent.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: new row violates row-level security policy (42501)
  END;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-00000000080e', false);
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner added another user as an inactive member without their consent.';
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
  -- Can update, deactivate, reactivate, and remove existing staff.
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
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-000000000811';
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
     OR EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = '00000000-0000-0000-0000-000000000811')
     OR EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = '00000000-0000-0000-0000-00000000080e') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: the owner''s staff changes did not produce the expected rows.';
  END IF;
  IF (SELECT (n, digest) FROM pg_temp.staff_fingerprint('00000000-0000-0000-0000-0000000008bb'))
     IS DISTINCT FROM (SELECT (n, digest) FROM staff_baseline WHERE ws = '00000000-0000-0000-0000-0000000008bb') THEN
    RAISE EXCEPTION 'S4 TEST FAILED: managing W''s staff changed another workspace''s staff rows.';
  END IF;
  RAISE NOTICE 'S4 test 5 PASSED: owner cannot delete/deactivate/re-point their own row, move rows, manage another workspace, or add another user (active or inactive) without consent; can update, deactivate, reactivate, and remove existing staff; WX unchanged.';
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
  -- Owning W (even without a staff row) still counts as onboarded.
  BEGIN
    PERFORM public.bootstrap_professional_workspace('Staff Test Second Workspace', 'salon', 'Riyadh');
    RAISE EXCEPTION 'TEST FAILED: an owner without a staff row created a second workspace through onboarding.';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Onboarding already completed for this user' THEN RAISE; END IF;
  END;
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
  RAISE NOTICE 'S4 test 6 PASSED: an owner without a staff row is still recognised as owner, can re-add their own row (active only), and cannot create a second workspace.';
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
-- 9. Onboarding: staff of another workspace can create their own (once).
--    After test 5, M is an INACTIVE member of W and D an ACTIVE one; O owns W.
-- ---------------------------------------------------------------------
CREATE FUNCTION pg_temp.assert_independent_onboarding(who uuid, label text, expect_w_member boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  new_ws uuid;
BEGIN
  new_ws := public.bootstrap_professional_workspace('Staff Test Independent ' || label, 'freelancer', 'Riyadh');
  IF NOT public.is_workspace_owner(new_ws)
     OR NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = new_ws AND profile_id = who AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = who AND onboarding_completed) THEN
    RAISE EXCEPTION 'TEST FAILED: the % staff member''s own workspace was not created as owner with an active staff row.', label;
  END IF;
  -- Their membership of W is unchanged by onboarding.
  IF public.is_workspace_member('00000000-0000-0000-0000-0000000008aa') IS DISTINCT FROM expect_w_member THEN
    RAISE EXCEPTION 'TEST FAILED: onboarding changed the % staff member''s membership of W.', label;
  END IF;
  -- Now an owner: a second workspace is refused.
  BEGIN
    PERFORM public.bootstrap_professional_workspace('Staff Test Second ' || label, 'freelancer', 'Riyadh');
    RAISE EXCEPTION 'TEST FAILED: the % staff member created a second workspace.', label;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Onboarding already completed for this user' THEN RAISE; END IF;
  END;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080c', 'role', 'authenticated')::text, true);
SELECT pg_temp.assert_independent_onboarding('00000000-0000-0000-0000-00000000080c', 'inactive', false);
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080d', 'role', 'authenticated')::text, true);
SELECT pg_temp.assert_independent_onboarding('00000000-0000-0000-0000-00000000080d', 'active', true);
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.bootstrap_professional_workspace('Staff Test Owner Second', 'salon', 'Riyadh');
    RAISE EXCEPTION 'TEST FAILED: an existing owner created a second workspace through onboarding.';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Onboarding already completed for this user' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'Consent test 9 PASSED: an inactive and an active staff member each created their own workspace once (W membership unchanged); an existing owner cannot create a second.'; END $$;

-- ---------------------------------------------------------------------
-- 10. Leaving. W's rows now: O (owner, active), M (inactive), D (active),
--     L (active).
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000810', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- L cannot remove anyone else -- not the owner, not a colleague.
  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: a member removed the owner through the self-leave policy.'; END IF;
  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080d';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: a member removed a colleague through the self-leave policy.'; END IF;

  -- A blanket DELETE of the whole workspace removes only L's own row.
  DELETE FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: a member''s blanket DELETE removed % rows (expected only their own).', n; END IF;
  IF public.is_workspace_member('00000000-0000-0000-0000-0000000008aa')
     OR (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: a member who left still has access to the workspace.';
  END IF;
END $$;

-- M (inactive member of W; owns MW since test 9): sees only their own rows,
-- no workspace data, and can leave.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080c', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  n int;
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 1
     OR NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa'
                    AND profile_id = '00000000-0000-0000-0000-00000000080c' AND NOT is_active) THEN
    RAISE EXCEPTION 'TEST FAILED: an inactive member does not see exactly their own (inactive) membership row of W.';
  END IF;
  IF (SELECT count(*) FROM public.workspace_staff WHERE profile_id <> '00000000-0000-0000-0000-00000000080c') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an inactive member can see other staff records.';
  END IF;
  IF public.is_workspace_member('00000000-0000-0000-0000-0000000008aa')
     OR (SELECT count(*) FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000008aa') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an inactive member can access the workspace''s data.';
  END IF;

  -- Seeing their own row does not let them change it: no self-reactivation,
  -- no self-set commission (UPDATE stays owner-only).
  UPDATE public.workspace_staff SET is_active = true
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an inactive member reactivated their own membership.'; END IF;
  UPDATE public.workspace_staff SET base_commission_pct = 99
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an inactive member changed their own commission.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa'
                 AND profile_id = '00000000-0000-0000-0000-00000000080c' AND NOT is_active AND base_commission_pct = 25) THEN
    RAISE EXCEPTION 'TEST FAILED: the inactive member''s stored row changed (expected inactive, commission 25).';
  END IF;

  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 1 THEN RAISE EXCEPTION 'TEST FAILED: an inactive member could not leave (% rows).', n; END IF;

  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa') != 0
     OR public.is_workspace_member('00000000-0000-0000-0000-0000000008aa')
     OR (SELECT count(*) FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000008aa') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: a member who left still has access to the workspace or its staff list.';
  END IF;
END $$;

-- The owner cannot leave, and cannot silently re-add or reactivate L.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  n int;
BEGIN
  DELETE FROM public.workspace_staff
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-00000000080a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED: the owner left their own workspace (self-lockout).'; END IF;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-000000000810', true);
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner silently re-added a member who left.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  BEGIN
    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-000000000810', false);
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner re-added a member who left as inactive.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  UPDATE public.workspace_staff SET is_active = true
  WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa' AND profile_id = '00000000-0000-0000-0000-000000000810';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner reactivated a member who left.'; END IF;
END $$;

-- Nobody reads arbitrary rows through the own-row SELECT policy: each user
-- sees only rows of workspaces they actively belong to, plus their own rows.
-- D: active member of W, owner of DW (test 9).
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080d', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff
       WHERE workspace_id <> '00000000-0000-0000-0000-0000000008aa'
         AND NOT public.is_workspace_owner(workspace_id)
         AND profile_id <> '00000000-0000-0000-0000-00000000080d') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: a member can read staff rows of a workspace they do not belong to.';
  END IF;
END $$;
-- O: owner of W -- cannot read WX, or M's and D's own new workspaces.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080a', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff WHERE workspace_id <> '00000000-0000-0000-0000-0000000008aa') != 0 THEN
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an owner can read staff rows of other workspaces.';
  END IF;
END $$;
-- E: belongs to no workspace -- sees nothing.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080e', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.workspace_staff) != 0 THEN
    RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: a user with no membership can read staff rows.';
  END IF;
END $$;

-- An outsider removes nothing (their own row is in WX, not W).
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000080b', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  n int;
BEGIN
  DELETE FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n != 0 THEN RAISE EXCEPTION 'TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider removed % staff row(s) of another workspace.', n; END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (SELECT string_agg(profile_id::text || ':' || is_active, ',' ORDER BY profile_id)
        FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000008aa')
     IS DISTINCT FROM '00000000-0000-0000-0000-00000000080a:true,00000000-0000-0000-0000-00000000080d:true' THEN
    RAISE EXCEPTION 'TEST FAILED: after the leave tests W should hold exactly the owner and D (both active).';
  END IF;
  IF (SELECT (n, digest) FROM pg_temp.staff_fingerprint('00000000-0000-0000-0000-0000000008bb'))
     IS DISTINCT FROM (SELECT (n, digest) FROM staff_baseline WHERE ws = '00000000-0000-0000-0000-0000000008bb') THEN
    RAISE EXCEPTION 'TEST FAILED: the leave tests changed another workspace''s staff rows.';
  END IF;
  RAISE NOTICE 'Consent test 10 PASSED: members (active or inactive) remove only their own row and lose access; an inactive member sees only their own row and no workspace data, and cannot reactivate or re-price it; nobody reads other workspaces'' staff rows; the owner cannot leave; a member who left cannot be re-added or reactivated; an outsider removes nothing; WX unchanged.';
END $$;

-- ---------------------------------------------------------------------
-- 8. Catalog: policies, helper functions, privileges (runs last, after the
--    behavior tests; numbered as in the original S4 file).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff') != 6
     OR (SELECT string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ','), ' ' ORDER BY policyname)
           FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
        != 'workspace_staff_delete_owner:DELETE:authenticated workspace_staff_delete_self:DELETE:authenticated workspace_staff_insert_owner:INSERT:authenticated workspace_staff_select_members:SELECT:authenticated workspace_staff_select_own:SELECT:authenticated workspace_staff_update_owner:UPDATE:authenticated' THEN
    RAISE EXCEPTION 'TEST FAILED: workspace_staff does not have exactly the six expected policies for authenticated.';
  END IF;
  IF (SELECT regexp_replace(qual, '\s+', ' ', 'g') FROM pg_policies WHERE schemaname = 'public' AND policyname = 'workspace_staff_select_members')
       IS DISTINCT FROM 'is_workspace_member(workspace_id)'
     OR (SELECT regexp_replace(qual, '\s+', ' ', 'g') FROM pg_policies WHERE schemaname = 'public' AND policyname = 'workspace_staff_select_own')
       IS DISTINCT FROM '(profile_id = auth.uid())' THEN
    RAISE EXCEPTION 'TEST FAILED: the SELECT policy expressions are not exactly the reviewed ones (member list; own rows only).';
  END IF;
  IF (SELECT regexp_replace(with_check, '\s+', ' ', 'g') FROM pg_policies WHERE schemaname = 'public' AND policyname = 'workspace_staff_insert_owner')
       IS DISTINCT FROM '(is_workspace_owner(workspace_id) AND (profile_id = auth.uid()) AND is_active)'
     OR (SELECT regexp_replace(qual, '\s+', ' ', 'g') FROM pg_policies WHERE schemaname = 'public' AND policyname = 'workspace_staff_delete_self')
       IS DISTINCT FROM '((profile_id = auth.uid()) AND (NOT is_workspace_owner(workspace_id)))'
     OR (SELECT regexp_replace(qual, '\s+', ' ', 'g') FROM pg_policies WHERE schemaname = 'public' AND policyname = 'workspace_staff_delete_owner')
       IS DISTINCT FROM '(is_workspace_owner(workspace_id) AND (profile_id <> auth.uid()))' THEN
    RAISE EXCEPTION 'TEST FAILED: the INSERT / DELETE policy expressions are not exactly the reviewed ones.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.bootstrap_professional_workspace(text,text,text)'::regprocedure
                 AND prosecdef AND proconfig @> ARRAY['search_path=public'] AND pg_get_userbyid(proowner) = 'postgres'
                 AND prosrc LIKE '%FROM public.workspaces WHERE owner_id = auth.uid()%'
                 AND prosrc NOT LIKE '%FROM public.workspace_staff WHERE profile_id = auth.uid()%') THEN
    RAISE EXCEPTION 'TEST FAILED: bootstrap_professional_workspace() is not the reviewed SECURITY DEFINER definition refusing only existing owners.';
  END IF;
  IF has_function_privilege('anon', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
     OR has_function_privilege('public', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST FAILED: bootstrap_professional_workspace() EXECUTE is not exactly authenticated + service_role.';
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
  RAISE NOTICE 'S4 test 8 PASSED: exactly six authenticated-only policies with the reviewed SELECT/INSERT/DELETE expressions; is_workspace_owner() and bootstrap_professional_workspace() SECURITY DEFINER, EXECUTE for authenticated + service_role only; UPDATE limited to is_active and base_commission_pct.';
  RAISE NOTICE 'Workspace-staff management and membership consent test PASSED: all 10 checks hold (real local Postgres, real grants and row level security, no mocking).';
END $$;

ROLLBACK;
