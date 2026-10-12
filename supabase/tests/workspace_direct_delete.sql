-- Real privilege integration test: direct workspace DELETE (S1-b).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied
-- (including 20261012120000_restrict_workspace_direct_delete.sql), that:
--   1. The workspace OWNER is refused (SQLSTATE 42501) when deleting a
--      workspace row directly -- even an "emptied" workspace with no
--      clients/services/appointments/visits left, the case where a direct
--      DELETE would otherwise succeed and cascade away its audit logs.
--   2. A non-owner active MEMBER is refused for direct DELETE.
--   3. An OUTSIDER (member of another workspace) is refused.
--   4. ANON is refused.
--   5. A non-owner member calling delete_workspace() is refused by its
--      owner check; nothing is removed.
--   6. ANON calling delete_workspace() is refused.
--   7. The OWNER calling delete_workspace() succeeds: the workspace and its
--      data are removed, and every audit row -- the earlier ones and the
--      ones its own deletes generate -- is preserved with workspace_id NULL.
--   8. service_role (the server-side admin path) can still delete directly.
--   9. The RLS policy, the 13 ON DELETE CASCADE foreign keys, and the S1
--      column-level UPDATE grants are unchanged.
--
-- Same session mechanism as rls_workspace_isolation.sql: `SET LOCAL ROLE`
-- plus the `request.jwt.claims` setting auth.uid() reads from. Entirely
-- wrapped in one transaction that is ALWAYS rolled back; nothing persists.
-- Fixed, obviously-fake UUIDs (...-0000000002xx) distinct from the other
-- test files'.

BEGIN;

DO $$
BEGIN
  -- Setup as the connecting superuser-equivalent role (test setup only).
  -- A = owner, C = non-owner active staff member, B = outsider.
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000020a', 'del-test-owner@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000020b', 'del-test-outsider@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000020c', 'del-test-staff@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000020a', 'Delete Test Owner'),
    ('00000000-0000-0000-0000-00000000020b', 'Delete Test Outsider'),
    ('00000000-0000-0000-0000-00000000020c', 'Delete Test Staff')
  ON CONFLICT (id) DO NOTHING;

  -- W: a workspace with real data. E: an "emptied" workspace (audit history,
  -- staff and settings, but no clients/services/appointments/visits left).
  -- WB: the outsider's own workspace.
  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-00000000020a', 'Delete Test W', 'del-test-w', 'Delete Test W'),
    ('00000000-0000-0000-0000-0000000002ee', '00000000-0000-0000-0000-00000000020a', 'Delete Test E', 'del-test-e', 'Delete Test E'),
    ('00000000-0000-0000-0000-0000000002bb', '00000000-0000-0000-0000-00000000020b', 'Delete Test WB', 'del-test-wb', 'Delete Test WB');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-00000000020a', true),
    ('00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-00000000020c', true),
    ('00000000-0000-0000-0000-0000000002ee', '00000000-0000-0000-0000-00000000020a', true),
    ('00000000-0000-0000-0000-0000000002ee', '00000000-0000-0000-0000-00000000020c', true),
    ('00000000-0000-0000-0000-0000000002bb', '00000000-0000-0000-0000-00000000020b', true);

  INSERT INTO public.workspace_settings (workspace_id) VALUES
    ('00000000-0000-0000-0000-0000000002aa'),
    ('00000000-0000-0000-0000-0000000002ee');

  -- W's data. Each insert fires the real audit trigger (4 audit rows for W).
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002aa', 'Delete Test Client W');
  INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES
    ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002aa', 'Delete Test Service W', 'haircut', 100, 30);
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES
    ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-0000000002c1',
     '2026-10-12T09:00:00Z', '2026-10-12T09:30:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id) VALUES
    ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002d1');
  INSERT INTO public.visits (id, workspace_id, client_id) VALUES
    ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-0000000002c1');

  -- E: a client that was added and later removed -- leaves 2 audit rows
  -- (INSERT + DELETE) and nothing that would block a cascade.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000002c2', '00000000-0000-0000-0000-0000000002ee', 'Delete Test Client E');
  DELETE FROM public.clients WHERE id = '00000000-0000-0000-0000-0000000002c2';

  IF (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa') != 4
     OR (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002ee') != 2 THEN
    RAISE EXCEPTION 'S1-b TEST SETUP FAILED: audit trigger did not produce the expected audit rows (W=%, E=%).',
      (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa'),
      (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002ee');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. As the OWNER (A): direct DELETE is refused, even for the emptied
--    workspace E.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000020a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  attempt text;
  attempts text[] := ARRAY[
    $q$DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002ee'$q$,
    $q$DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002aa'$q$
  ];
BEGIN
  FOREACH attempt IN ARRAY attempts LOOP
    BEGIN
      EXECUTE attempt;
      RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: the owner deleted a workspace row directly: %', attempt;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
  END LOOP;
  RAISE NOTICE 'S1-b test 1 PASSED: owner refused for direct DELETE, including the emptied workspace (42501).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 2. As a non-owner active MEMBER (C): direct DELETE is refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000020c', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  attempt text;
  attempts text[] := ARRAY[
    $q$DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002aa'$q$,
    $q$DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002ee'$q$
  ];
BEGIN
  FOREACH attempt IN ARRAY attempts LOOP
    BEGIN
      EXECUTE attempt;
      RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member deleted a workspace row directly: %', attempt;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
  END LOOP;
  RAISE NOTICE 'S1-b test 2 PASSED: non-owner member refused for direct DELETE (42501).';
END $$;

-- ---------------------------------------------------------------------
-- 5. Still as member C: delete_workspace() is refused by its owner check.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000002aa');
    RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: a non-owner member ran delete_workspace() successfully.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: 'Only the workspace owner can delete this workspace' (42501)
  END;
  RAISE NOTICE 'S1-b test 5 PASSED: non-owner member refused by delete_workspace()''s owner check.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 3. As an OUTSIDER (B, member of WB only): direct DELETE is refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000020b', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002aa';
    RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider ran a direct workspace DELETE without a privilege error.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  BEGIN
    DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002bb';
    RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: the outsider deleted their own workspace row directly.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RAISE NOTICE 'S1-b test 3 PASSED: outsider refused for direct DELETE (42501).';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 4 + 6. As ANON: direct DELETE and delete_workspace() are both refused.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
BEGIN
  BEGIN
    DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002ee';
    RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: anon ran a direct workspace DELETE without a privilege error.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RAISE NOTICE 'S1-b test 4 PASSED: anon refused for direct DELETE (42501).';

  BEGIN
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000002aa');
    RAISE EXCEPTION 'S1-b TEST FAILED -- SECURITY BOUNDARY BROKEN: anon ran delete_workspace() successfully.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
  RAISE NOTICE 'S1-b test 6 PASSED: anon refused by delete_workspace() (42501).';
END $$;

RESET ROLE;

-- Nothing so far may have removed anything.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.workspaces WHERE id IN ('00000000-0000-0000-0000-0000000002aa', '00000000-0000-0000-0000-0000000002ee', '00000000-0000-0000-0000-0000000002bb')) != 3
     OR (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002ee') != 2
     OR (SELECT count(*) FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa') != 4
     OR (SELECT count(*) FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000002ee') != 2
     OR (SELECT count(*) FROM public.workspace_settings WHERE workspace_id = '00000000-0000-0000-0000-0000000002ee') != 1
     OR (SELECT count(*) FROM public.clients WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa') != 1 THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: a refused deletion still removed workspaces, staff, settings, clients, or audit history.';
  END IF;
  RAISE NOTICE 'S1-b refusals left everything intact: 3 workspaces, E''s staff/settings, all 6 audit rows, W''s data.';
END $$;

-- ---------------------------------------------------------------------
-- 7. As the OWNER (A): delete_workspace() succeeds and preserves audit
--    history.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000020a', 'role', 'authenticated')::text, true);

SELECT public.delete_workspace('00000000-0000-0000-0000-0000000002aa');

RESET ROLE;

DO $$
DECLARE
  record_ids uuid[] := ARRAY[
    '00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002d1',
    '00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002f1'
  ]::uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.clients WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.services WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.appointments WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.appointment_services WHERE appointment_id = '00000000-0000-0000-0000-0000000002a1')
     OR EXISTS (SELECT 1 FROM public.visits WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.workspace_settings WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa')
     OR EXISTS (SELECT 1 FROM public.workspace_staff WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: owner''s delete_workspace() did not remove the workspace and all its data.';
  END IF;

  -- Audit preservation: the 4 original INSERT rows are still there, detached.
  IF (SELECT count(*) FROM public.audit_logs WHERE record_id = ANY (record_ids) AND action = 'INSERT' AND workspace_id IS NULL) != 4 THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: earlier audit rows were not preserved (expected 4 detached INSERT rows, got %).',
      (SELECT count(*) FROM public.audit_logs WHERE record_id = ANY (record_ids) AND action = 'INSERT' AND workspace_id IS NULL);
  END IF;
  -- ...and the deletes delete_workspace() itself performed were audited too.
  IF (SELECT count(*) FROM public.audit_logs WHERE record_id = ANY (record_ids) AND action = 'DELETE' AND workspace_id IS NULL) != 4 THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: delete_workspace()''s own deletes were not audited and preserved (expected 4 detached DELETE rows, got %).',
      (SELECT count(*) FROM public.audit_logs WHERE record_id = ANY (record_ids) AND action = 'DELETE' AND workspace_id IS NULL);
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE workspace_id = '00000000-0000-0000-0000-0000000002aa') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: audit rows still reference the deleted workspace.';
  END IF;
  -- The other workspaces are untouched.
  IF (SELECT count(*) FROM public.workspaces WHERE id IN ('00000000-0000-0000-0000-0000000002ee', '00000000-0000-0000-0000-0000000002bb')) != 2 THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: deleting W affected another workspace.';
  END IF;
  RAISE NOTICE 'S1-b test 7 PASSED: owner''s delete_workspace() removed W and its data; all 8 audit rows preserved with workspace_id NULL.';
END $$;

-- ---------------------------------------------------------------------
-- 8. As service_role: the server-side admin path can still delete directly.
-- ---------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

DO $$
DECLARE
  affected int;
BEGIN
  DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000002ee';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected != 1 THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: service_role could not delete a workspace row directly (expected 1 row, got %).', affected;
  END IF;
  RAISE NOTICE 'S1-b test 8 PASSED: service_role can still delete a workspace row directly.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 9. Nothing else changed: policy, foreign keys, S1 grants.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces') != 1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspace_access' AND cmd = 'ALL') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: the workspaces RLS policy changed.';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.workspaces'::regclass) != 13
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.workspaces'::regclass AND confdeltype != 'c') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: the foreign keys referencing workspaces changed (expected 13, all ON DELETE CASCADE).';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.workspaces', 'locale', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.workspaces', 'plan_tier', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.workspaces', 'UPDATE')
     OR has_any_column_privilege('anon', 'public.workspaces', 'UPDATE') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: the S1 column-level UPDATE grants changed.';
  END IF;
  IF has_table_privilege('authenticated', 'public.workspaces', 'DELETE')
     OR has_table_privilege('anon', 'public.workspaces', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.workspaces', 'DELETE') THEN
    RAISE EXCEPTION 'S1-b TEST FAILED: DELETE privileges are not exactly service_role-only for the client roles checked.';
  END IF;
  RAISE NOTICE 'S1-b test 9 PASSED: policy, 13 CASCADE foreign keys, and S1 grants unchanged; DELETE revoked from authenticated and anon.';
  RAISE NOTICE 'S1-b direct-delete test PASSED: all 9 checks hold (real local Postgres, real grants, RLS, triggers, no mocking).';
END $$;

ROLLBACK;
