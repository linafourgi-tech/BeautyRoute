-- Real privilege integration test: protected workspace columns (S1).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied
-- (including 20261011120000_restrict_workspace_protected_columns.sql),
-- that:
--   1. An `authenticated` workspace member is REFUSED (SQLSTATE 42501,
--      insufficient_privilege) when updating any protected column:
--      plan_tier, subscription_status, trial_ends_at, trial_started_at,
--      owner_id, id, slug, created_at.
--   2. A mixed update (allowed + protected column) is refused as a whole --
--      the allowed column is not changed either.
--   3. The upsert path (INSERT ... ON CONFLICT DO UPDATE SET plan_tier) --
--      what a PostgREST upsert compiles to -- is refused.
--   4. The member CAN update the allowed columns (the app's real path:
--      updateWorkspace() / Sidebar's language switch), and updated_at is
--      still maintained by its BEFORE UPDATE trigger without a grant.
--   5. A non-member updating another workspace affects 0 rows (existing
--      RLS policy, unchanged).
--   6. `anon` is refused for every UPDATE on the table.
--   7. `service_role` (the authorized server-side path, e.g. a future
--      billing webhook) CAN still change plan/billing fields.
--   8. Onboarding still works: bootstrap_professional_workspace() (SECURITY
--      DEFINER) creates a workspace with its trial fields set, and the new
--      owner still can't change those fields afterwards.
--
-- Same session mechanism as rls_workspace_isolation.sql: `SET LOCAL ROLE`
-- plus the `request.jwt.claims` setting auth.uid() reads from -- what
-- PostgREST establishes after verifying a real JWT. Entirely wrapped in one
-- transaction that is ALWAYS rolled back; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000001xx) distinct from the isolation
-- test's, so the two files never interfere.

BEGIN;

DO $$
BEGIN
  -- Setup as the connecting superuser-equivalent role (test setup only).
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000010a', 'col-test-user-a@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000010b', 'col-test-user-b@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000010c', 'col-test-user-new@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000010a', 'Column Test User A'),
    ('00000000-0000-0000-0000-00000000010b', 'Column Test User B'),
    ('00000000-0000-0000-0000-00000000010c', 'Column Test New User')
  ON CONFLICT (id) DO NOTHING;

  -- updated_at is seeded far in the past so the trigger's NOW() is
  -- observable inside this single transaction.
  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand, plan_tier, subscription_status, trial_ends_at, updated_at) VALUES
    ('00000000-0000-0000-0000-0000000001aa', '00000000-0000-0000-0000-00000000010a', 'Column Test Workspace A', 'col-test-workspace-a', 'Column Test A', 'Starter', 'trial', now() + interval '7 days', '2000-01-01T00:00:00Z'),
    ('00000000-0000-0000-0000-0000000001bb', '00000000-0000-0000-0000-00000000010b', 'Column Test Workspace B', 'col-test-workspace-b', 'Column Test B', 'Starter', 'trial', now() + interval '7 days', '2000-01-01T00:00:00Z');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000001aa', '00000000-0000-0000-0000-00000000010a', true),
    ('00000000-0000-0000-0000-0000000001bb', '00000000-0000-0000-0000-00000000010b', true);
END $$;

-- ---------------------------------------------------------------------
-- As User A: an authenticated, active member of Workspace A only.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000010a', 'role', 'authenticated')::text, true);

-- 1. Every protected column is refused.
DO $$
DECLARE
  attempt text;
  attempts text[] := ARRAY[
    $q$UPDATE public.workspaces SET plan_tier = 'Studio' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET subscription_status = 'active' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET trial_ends_at = now() + interval '10 years' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET trial_started_at = now() WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET owner_id = '00000000-0000-0000-0000-00000000010b' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET id = '00000000-0000-0000-0000-0000000001cc' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET slug = 'col-test-hijacked-slug' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET created_at = '1999-01-01T00:00:00Z' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$
  ];
BEGIN
  FOREACH attempt IN ARRAY attempts LOOP
    BEGIN
      EXECUTE attempt;
      RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: authenticated member was allowed to run: %', attempt;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
  END LOOP;
  RAISE NOTICE 'S1 test 1 PASSED: all 8 protected columns refused for an authenticated member (42501).';
END $$;

-- 2. Mixed update (allowed + protected) is refused as a whole.
DO $$
DECLARE
  current_name text;
BEGIN
  BEGIN
    UPDATE public.workspaces SET name = 'Hijacked Name', plan_tier = 'Studio' WHERE id = '00000000-0000-0000-0000-0000000001aa';
    RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: mixed name+plan_tier update was allowed.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  SELECT name INTO current_name FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000001aa';
  IF current_name IS DISTINCT FROM 'Column Test Workspace A' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: refused mixed update still changed name to %.', current_name;
  END IF;
  RAISE NOTICE 'S1 test 2 PASSED: mixed allowed+protected update refused atomically; name unchanged.';
END $$;

-- 3. Upsert path (INSERT ... ON CONFLICT DO UPDATE SET <protected>) is refused.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand, plan_tier)
    VALUES ('00000000-0000-0000-0000-0000000001aa', '00000000-0000-0000-0000-00000000010a', 'Column Test Workspace A', 'col-test-workspace-a', 'Column Test A', 'Studio')
    ON CONFLICT (id) DO UPDATE SET plan_tier = EXCLUDED.plan_tier;
    RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: upsert with ON CONFLICT DO UPDATE SET plan_tier was allowed.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RAISE NOTICE 'S1 test 3 PASSED: upsert path (ON CONFLICT DO UPDATE SET plan_tier) refused.';
END $$;

-- 4. Allowed columns still work, and updated_at is still maintained.
DO $$
DECLARE
  affected int;
  row_after public.workspaces%ROWTYPE;
BEGIN
  UPDATE public.workspaces SET locale = 'ar-SA' WHERE id = '00000000-0000-0000-0000-0000000001aa';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected != 1 THEN
    RAISE EXCEPTION 'S1 TEST FAILED: member could not update allowed column locale (expected 1 row, got %).', affected;
  END IF;

  UPDATE public.workspaces
     SET name = 'Column Test Workspace A2', display_brand = 'Column Test A2', timezone = 'Asia/Dubai', currency = 'AED',
         locale = 'en-SA', city = 'Riyadh', district = 'Al Narjis', business_type = 'freelancer'
   WHERE id = '00000000-0000-0000-0000-0000000001aa';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected != 1 THEN
    RAISE EXCEPTION 'S1 TEST FAILED: member could not update all 8 allowed columns together (expected 1 row, got %).', affected;
  END IF;

  SELECT * INTO row_after FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000001aa';
  IF row_after.name != 'Column Test Workspace A2' OR row_after.city != 'Riyadh' OR row_after.business_type != 'freelancer' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: allowed-column update did not persist as expected.';
  END IF;
  IF row_after.updated_at <= '2000-01-01T00:00:00Z' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: updated_at was not maintained by trg_workspaces_updated_at (still %).', row_after.updated_at;
  END IF;
  IF row_after.plan_tier != 'Starter' OR row_after.subscription_status != 'trial' OR row_after.owner_id != '00000000-0000-0000-0000-00000000010a' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: protected fields changed (plan_tier=%, subscription_status=%, owner_id=%).',
      row_after.plan_tier, row_after.subscription_status, row_after.owner_id;
  END IF;
  RAISE NOTICE 'S1 test 4 PASSED: all 8 allowed columns updatable; updated_at maintained; protected fields untouched.';
END $$;

-- 5. Non-member: updating another workspace affects 0 rows (RLS unchanged).
DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.workspaces SET name = 'Hijacked B' WHERE id = '00000000-0000-0000-0000-0000000001bb';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected != 0 THEN
    RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: User A updated % row(s) of Workspace B.', affected;
  END IF;
  RAISE NOTICE 'S1 test 5 PASSED: non-member update of another workspace affected 0 rows.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 6. As anon: every UPDATE on the table is refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
DECLARE
  attempt text;
  attempts text[] := ARRAY[
    $q$UPDATE public.workspaces SET name = 'Anon Name' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET locale = 'ar-SA' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$,
    $q$UPDATE public.workspaces SET plan_tier = 'Studio' WHERE id = '00000000-0000-0000-0000-0000000001aa'$q$
  ];
BEGIN
  FOREACH attempt IN ARRAY attempts LOOP
    BEGIN
      EXECUTE attempt;
      RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon was allowed to run: %', attempt;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
  END LOOP;
  RAISE NOTICE 'S1 test 6 PASSED: anon refused for every UPDATE on public.workspaces (42501).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 7. As service_role: the authorized server-side path still works.
-- ---------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.workspaces SET plan_tier = 'Pro', subscription_status = 'active' WHERE id = '00000000-0000-0000-0000-0000000001aa';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected != 1 THEN
    RAISE EXCEPTION 'S1 TEST FAILED: service_role could not update plan/billing fields (expected 1 row, got %).', affected;
  END IF;
  RAISE NOTICE 'S1 test 7 PASSED: service_role can still change plan_tier/subscription_status.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 8. Onboarding: bootstrap_professional_workspace() as a brand-new user.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000010c', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  new_workspace_id uuid;
  ws public.workspaces%ROWTYPE;
BEGIN
  new_workspace_id := public.bootstrap_professional_workspace('Column Test New Business', 'freelancer', 'Riyadh');
  SELECT * INTO ws FROM public.workspaces WHERE id = new_workspace_id;
  IF ws.id IS NULL THEN
    RAISE EXCEPTION 'S1 TEST FAILED: onboarding bootstrap did not create a workspace visible to its owner.';
  END IF;
  IF ws.subscription_status != 'trial' OR ws.trial_ends_at IS NULL OR ws.trial_started_at IS NULL THEN
    RAISE EXCEPTION 'S1 TEST FAILED: onboarding did not set trial fields (status=%, started=%, ends=%).',
      ws.subscription_status, ws.trial_started_at, ws.trial_ends_at;
  END IF;

  BEGIN
    UPDATE public.workspaces SET trial_ends_at = now() + interval '10 years' WHERE id = new_workspace_id;
    RAISE EXCEPTION 'S1 TEST FAILED -- SECURITY BOUNDARY BROKEN: new owner extended their own trial.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RAISE NOTICE 'S1 test 8 PASSED: onboarding bootstrap still creates a trial workspace; new owner cannot extend the trial.';
END $$;

RESET ROLE;

-- Final cross-check as the setup role: protected state is exactly what the
-- authorized paths set, and Workspace B was never modified.
DO $$
DECLARE
  a public.workspaces%ROWTYPE;
  b public.workspaces%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000001aa';
  SELECT * INTO b FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000001bb';
  IF a.plan_tier != 'Pro' OR a.subscription_status != 'active' OR a.slug != 'col-test-workspace-a'
     OR a.owner_id != '00000000-0000-0000-0000-00000000010a' OR a.created_at <= '1999-01-02T00:00:00Z' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: Workspace A protected state is not what only the authorized paths set.';
  END IF;
  IF b.name != 'Column Test Workspace B' OR b.plan_tier != 'Starter' THEN
    RAISE EXCEPTION 'S1 TEST FAILED: Workspace B was modified by a non-member.';
  END IF;
  RAISE NOTICE 'S1 protected-columns test PASSED: all 8 checks hold (real local Postgres, real grants and RLS, no mocking).';
END $$;

ROLLBACK;
