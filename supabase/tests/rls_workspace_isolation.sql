-- Real RLS integration test: workspace isolation.
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves an actual security boundary against a real local Postgres
-- instance with the real schema.sql-defined RLS policies applied --
-- not a mocked Supabase client, not a mocked RLS decision:
--   1. User A (an active workspace_staff member of Workspace A) CAN read
--      Workspace A's own clients row via the real `clients_access` RLS
--      policy (public.is_workspace_member(), schema.sql).
--   2. User A CANNOT read Workspace B's clients row, despite it existing
--      in the very same table, enforced by that same policy.
--
-- Uses the exact session-variable mechanism Postgres's own auth.uid()
-- function reads from -- confirmed by reading its real source directly
-- from this local instance:
--   SELECT prosrc FROM pg_proc WHERE proname='uid' AND pronamespace='auth'::regnamespace;
--   => coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
--               (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
-- This is the same session context PostgREST itself establishes after
-- verifying a real JWT -- only the network JWT-verification step is
-- bypassed here (Supabase Auth's own concern, not this policy's), so the
-- RLS decision itself is exercised for real, not mocked.
--
-- Entirely wrapped in one transaction that is ALWAYS rolled back at the
-- end (see ROLLBACK below), regardless of pass or fail -- nothing
-- persists, safe to run repeatedly against the same local database, no
-- separate cleanup step needed. Uses fixed, obviously-fake UUIDs
-- (00000000-...-a / -b patterns) rather than real-looking data, since
-- everything is discarded via ROLLBACK either way.
--
-- IMPORTANT, separately reported (not fixed here -- see
-- docs/ai/... no, see this closure pass's final report and
-- supabase/tests/README.md): this test bootstraps its own
-- profiles/workspace_staff/clients rows inline below via direct INSERTs,
-- rather than relying on `supabase/migrations/*`, because the migration
-- chain currently cannot bootstrap a schema from an empty database on its
-- own (supabase/migrations/20260722092124_name_of_your_migration.sql, the
-- first migration, is empty). This test instead runs against schema.sql
-- applied directly -- see supabase/tests/README.md for the exact setup
-- steps and why.

BEGIN;

DO $$
BEGIN
  -- Setup runs as the connecting (superuser-equivalent) role -- this is
  -- the standard, legitimate use of an elevated role for TEST SETUP only.
  -- Every assertion query below runs as `authenticated`, never this role.
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000000a', 'rls-test-user-a@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000000b', 'rls-test-user-b@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000000a', 'RLS Test User A'),
    ('00000000-0000-0000-0000-00000000000b', 'RLS Test User B');

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000000a', 'RLS Test Workspace A', 'rls-test-workspace-a', 'RLS Test A'),
    ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-00000000000b', 'RLS Test Workspace B', 'rls-test-workspace-b', 'RLS Test B');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000000a', true),
    ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-00000000000b', true);

  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-000000000c0a', '00000000-0000-0000-0000-0000000000aa', 'Client belonging to Workspace A'),
    ('00000000-0000-0000-0000-000000000c0b', '00000000-0000-0000-0000-0000000000bb', 'Client belonging to Workspace B');
END $$;

-- Switch to the real `authenticated` role and set the real JWT-claims
-- session variable auth.uid() reads from, as User A.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  visible_to_a int;
  can_see_b int;
BEGIN
  -- Assertion 1: User A can read their own workspace's client.
  SELECT count(*) INTO visible_to_a FROM public.clients WHERE id = '00000000-0000-0000-0000-000000000c0a';
  IF visible_to_a != 1 THEN
    RAISE EXCEPTION 'RLS TEST FAILED: authenticated User A could not read their own workspace''s client row (expected 1, got %). clients_access / is_workspace_member() may be broken.', visible_to_a;
  END IF;

  -- Assertion 2: User A CANNOT read Workspace B's client. This is the
  -- actual security-boundary assertion this test exists to prove.
  SELECT count(*) INTO can_see_b FROM public.clients WHERE id = '00000000-0000-0000-0000-000000000c0b';
  IF can_see_b != 0 THEN
    RAISE EXCEPTION 'RLS TEST FAILED -- SECURITY BOUNDARY BROKEN: authenticated User A (member of Workspace A only) was able to read % row(s) belonging to Workspace B via the clients table. clients_access / is_workspace_member() is NOT enforcing workspace isolation.', can_see_b;
  END IF;

  RAISE NOTICE 'RLS workspace-isolation test PASSED: User A saw exactly their own workspace''s client (1 row) and zero rows from Workspace B.';
END $$;

RESET ROLE;
ROLLBACK;
