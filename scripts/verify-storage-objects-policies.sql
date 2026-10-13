-- READ-ONLY production verification for the S3 Phase 1 fix
-- (supabase/migrations/20261014120000_restrict_storage_objects.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-storage-objects-policies.sql
--
-- A single SELECT: it only reads pg_policies, pg_class, and the six bucket
-- configuration rows in storage.buckets. It never writes, never reads
-- storage objects, and never touches secrets. Every row must show
-- passed = true.
--
-- The last check ("the six buckets exist and are private") is
-- production-specific: the six buckets exist only in the production
-- project, not in the local stack. Run against a local database, this
-- script correctly reports 6 of 7 passed, with only that row failing.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- S3 Phase 1: the four always-true client policies are gone.
  SELECT 'policy "Authenticated users can view files" removed' AS check_name, false AS expected,
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'Authenticated users can view files') AS actual
  UNION ALL
  SELECT 'policy "Authenticated users can upload files" removed', false,
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'Authenticated users can upload files')
  UNION ALL
  SELECT 'policy "Authenticated users can update files" removed', false,
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'Authenticated users can update files')
  UNION ALL
  SELECT 'policy "Authenticated users can delete files" removed', false,
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'Authenticated users can delete files')
  UNION ALL
  -- No storage.objects policy may apply to a client role (Phase 1 is default-deny).
  SELECT 'no storage.objects policy applies to authenticated, anon or PUBLIC', true,
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                     AND roles && ARRAY['authenticated', 'anon', 'public']::name[])
  UNION ALL
  SELECT 'row level security enabled on storage.objects (unchanged)', true,
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass)
  UNION ALL
  -- The buckets themselves are untouched.
  SELECT 'the six buckets exist and are private (unchanged)', true,
         (SELECT count(*) = 6 AND bool_and(NOT public) FROM storage.buckets
           WHERE id IN ('avatars', 'client-photos', 'before-after', 'documents', 'receipts', 'ai-uploads'))
) AS checks
ORDER BY passed, check_name;
