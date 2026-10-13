-- Real integration test: Storage object access (S3 Phase 1),
-- storage.objects row level security
-- (20261014120000_restrict_storage_objects.sql).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied,
-- that for every one of the six private buckets (avatars, client-photos,
-- before-after, documents, receipts, ai-uploads):
--   1. An authenticated MEMBER -- the recorded owner of the objects, in
--      their own workspace's path -- cannot SELECT, INSERT, UPDATE, or
--      DELETE any object (reads/updates/deletes see 0 rows; inserts are
--      refused with 42501).
--   2. An authenticated OUTSIDER (member of another workspace) gets the same.
--   3. ANON gets the same.
--      After every attempt, every object is byte-for-byte unchanged.
--   4. service_role is unchanged: it can SELECT, INSERT, UPDATE, and DELETE.
--   5. Row level security is still enabled on storage.objects, the four
--      original always-true policies are gone, and no storage.objects
--      policy applies to authenticated, anon, or PUBLIC.
--
-- The six buckets and their objects are synthetic test rows created inside
-- this transaction (the local stack defines no buckets); they never persist.
-- Direct SQL DELETEs on storage.objects are blocked by Storage's own
-- protect_delete trigger unless storage.allow_delete_query is 'true' -- the
-- setting the Storage API itself uses -- so this test sets it (transaction-
-- local) to exercise the row level security path the API goes through.
--
-- Same session mechanism as the other tests: `SET LOCAL ROLE` plus the
-- `request.jwt.claims` setting auth.uid() reads from. Entirely wrapped in
-- one transaction that is ALWAYS rolled back; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000006xx) distinct from the other test
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
-- M = member (and owner) of workspace W, X = outsider, owner of WX.
-- One object per bucket under W's path, recorded as uploaded by M.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  b text;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000060a', 'storage-test-member@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000060b', 'storage-test-outsider@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000060a', 'Storage Test Member'),
    ('00000000-0000-0000-0000-00000000060b', 'Storage Test Outsider')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-00000000060a', 'Storage Test W', 'storage-test-w', 'Storage Test W'),
    ('00000000-0000-0000-0000-0000000006bb', '00000000-0000-0000-0000-00000000060b', 'Storage Test WX', 'storage-test-wx', 'Storage Test WX');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-00000000060a', true),
    ('00000000-0000-0000-0000-0000000006bb', '00000000-0000-0000-0000-00000000060b', true);

  INSERT INTO storage.buckets (id, name, public) VALUES
    ('avatars', 'avatars', false),
    ('client-photos', 'client-photos', false),
    ('before-after', 'before-after', false),
    ('documents', 'documents', false),
    ('receipts', 'receipts', false),
    ('ai-uploads', 'ai-uploads', false)
  ON CONFLICT (id) DO NOTHING;

  FOREACH b IN ARRAY ARRAY['avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'] LOOP
    INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
    VALUES (b, '00000000-0000-0000-0000-0000000006aa/storage-test-' || b || '.txt',
            '00000000-0000-0000-0000-00000000060a', '{"size": 1, "mimetype": "text/plain"}'::jsonb);
  END LOOP;
END $$;

-- Emulate the Storage API so DELETE reaches row level security (see header).
SELECT set_config('storage.allow_delete_query', 'true', true);

-- Test-only helpers (pg_temp, inside the always-rolled-back transaction),
-- only ever called as the test's setup role.
CREATE FUNCTION pg_temp.storage_fingerprint()
RETURNS TABLE (n bigint, digest text)
LANGUAGE sql STABLE AS $$
  SELECT count(*), md5(coalesce(string_agg(o::text, '|' ORDER BY o::text), ''))
  FROM storage.objects o WHERE o.name LIKE '00000000-0000-0000-0000-0000000006%'
$$;

CREATE TEMP TABLE storage_baseline ON COMMIT DROP AS SELECT * FROM pg_temp.storage_fingerprint();

CREATE FUNCTION pg_temp.assert_objects_unchanged(label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  b record;
  f record;
BEGIN
  SELECT * INTO b FROM storage_baseline;
  SELECT * INTO f FROM pg_temp.storage_fingerprint();
  IF (f.n, f.digest) IS DISTINCT FROM (b.n, b.digest) THEN
    RAISE EXCEPTION 'S3 TEST FAILED: % changed the test objects (rows % -> %, or row contents changed).', label, b.n, f.n;
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT n FROM storage_baseline) != 6 THEN
    RAISE EXCEPTION 'S3 TEST SETUP FAILED: expected one test object in each of the 6 buckets.';
  END IF;
  RAISE NOTICE 'S3 setup OK: 6 private buckets, one object each under W''s path; baseline captured.';
END $$;

-- ---------------------------------------------------------------------
-- 1. As the authenticated MEMBER (M) -- owner of the objects, own path.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000060a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  b text;
  n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects;
  IF n != 0 THEN
    RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an authenticated member can read % storage object(s).', n;
  END IF;
  FOREACH b IN ARRAY ARRAY['avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'] LOOP
    BEGIN
      INSERT INTO storage.objects (bucket_id, name, owner_id) VALUES (b, '00000000-0000-0000-0000-0000000006aa/storage-test-new.txt', '00000000-0000-0000-0000-00000000060a');
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an authenticated member uploaded into bucket %.', b;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected: new row violates row-level security policy (42501)
    END;
    UPDATE storage.objects SET name = name || '.moved' WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an authenticated member updated % object(s) in bucket %.', n, b;
    END IF;
    DELETE FROM storage.objects WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an authenticated member deleted % object(s) in bucket %.', n, b;
    END IF;
  END LOOP;
END $$;

RESET ROLE;
SELECT pg_temp.assert_objects_unchanged('the authenticated member');
DO $$ BEGIN RAISE NOTICE 'S3 test 1 PASSED: authenticated member (objects'' owner, own workspace path) denied SELECT/INSERT/UPDATE/DELETE in all 6 buckets; objects unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 2. As an authenticated OUTSIDER (X, member of WX only).
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000060b', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  b text;
  n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects;
  IF n != 0 THEN
    RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an authenticated outsider can read % storage object(s).', n;
  END IF;
  FOREACH b IN ARRAY ARRAY['avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'] LOOP
    BEGIN
      INSERT INTO storage.objects (bucket_id, name, owner_id) VALUES (b, '00000000-0000-0000-0000-0000000006aa/storage-test-planted.txt', '00000000-0000-0000-0000-00000000060b');
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider uploaded into another workspace''s path in bucket %.', b;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
    UPDATE storage.objects SET name = name || '.moved' WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider updated % object(s) in bucket %.', n, b;
    END IF;
    DELETE FROM storage.objects WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: an outsider deleted % object(s) in bucket %.', n, b;
    END IF;
  END LOOP;
END $$;

RESET ROLE;
SELECT pg_temp.assert_objects_unchanged('the authenticated outsider');
DO $$ BEGIN RAISE NOTICE 'S3 test 2 PASSED: authenticated outsider denied SELECT/INSERT/UPDATE/DELETE in all 6 buckets; objects unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 3. As ANON.
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
DECLARE
  b text;
  n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects;
  IF n != 0 THEN
    RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon can read % storage object(s).', n;
  END IF;
  FOREACH b IN ARRAY ARRAY['avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'] LOOP
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES (b, '00000000-0000-0000-0000-0000000006aa/storage-test-anon.txt');
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon uploaded into bucket %.', b;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected
    END;
    UPDATE storage.objects SET name = name || '.moved' WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon updated % object(s) in bucket %.', n, b;
    END IF;
    DELETE FROM storage.objects WHERE bucket_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 0 THEN
      RAISE EXCEPTION 'S3 TEST FAILED -- SECURITY BOUNDARY BROKEN: anon deleted % object(s) in bucket %.', n, b;
    END IF;
  END LOOP;
END $$;

RESET ROLE;
SELECT pg_temp.assert_objects_unchanged('anon');
DO $$ BEGIN RAISE NOTICE 'S3 test 3 PASSED: anon denied SELECT/INSERT/UPDATE/DELETE in all 6 buckets; objects unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 4. As service_role: unchanged (BYPASSRLS) -- all four operations work.
-- ---------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

DO $$
DECLARE
  b text;
  n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE name LIKE '00000000-0000-0000-0000-0000000006aa/storage-test-%';
  IF n != 6 THEN
    RAISE EXCEPTION 'S3 TEST FAILED: service_role sees % of the 6 test objects.', n;
  END IF;
  FOREACH b IN ARRAY ARRAY['avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'] LOOP
    INSERT INTO storage.objects (bucket_id, name) VALUES (b, '00000000-0000-0000-0000-0000000006aa/storage-test-service.txt');
    UPDATE storage.objects SET name = '00000000-0000-0000-0000-0000000006aa/storage-test-service-moved.txt'
      WHERE bucket_id = b AND name = '00000000-0000-0000-0000-0000000006aa/storage-test-service.txt';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 1 THEN
      RAISE EXCEPTION 'S3 TEST FAILED: service_role could not update its object in bucket % (% rows).', b, n;
    END IF;
    DELETE FROM storage.objects WHERE bucket_id = b AND name = '00000000-0000-0000-0000-0000000006aa/storage-test-service-moved.txt';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n != 1 THEN
      RAISE EXCEPTION 'S3 TEST FAILED: service_role could not delete its object in bucket % (% rows).', b, n;
    END IF;
  END LOOP;
END $$;

RESET ROLE;
SELECT pg_temp.assert_objects_unchanged('service_role''s own insert/update/delete');
DO $$ BEGIN RAISE NOTICE 'S3 test 4 PASSED: service_role can still SELECT, INSERT, UPDATE and DELETE in all 6 buckets.'; END $$;

-- ---------------------------------------------------------------------
-- 5. Catalog: row level security on, no always-true or client policies.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'S3 TEST FAILED: row level security is disabled on storage.objects.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname IN ('Authenticated users can view files', 'Authenticated users can upload files',
                                'Authenticated users can update files', 'Authenticated users can delete files')) THEN
    RAISE EXCEPTION 'S3 TEST FAILED: one of the four original always-true policies still exists.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND roles && ARRAY['authenticated', 'anon', 'public']::name[]) THEN
    RAISE EXCEPTION 'S3 TEST FAILED: a storage.objects policy applies to authenticated, anon or PUBLIC (Phase 1 expects none).';
  END IF;
  RAISE NOTICE 'S3 test 5 PASSED: row level security enabled on storage.objects; the four always-true policies are gone; no client-role policies remain.';
  RAISE NOTICE 'S3 storage-objects access test PASSED: all 5 checks hold (real local Postgres, real row level security, no mocking).';
END $$;

ROLLBACK;
