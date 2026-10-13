-- S3 (production-readiness audit), Phase 1: remove the four always-true
-- client policies on storage.objects.
--
-- Root cause: four policies on storage.objects -- created outside the
-- migrations (no migration in this repository defines Storage buckets or
-- policies) -- grant the authenticated role unrestricted access to every
-- object in every bucket, with no bucket_id or path condition:
--   * "Authenticated users can view files"   FOR SELECT USING (true)
--   * "Authenticated users can upload files" FOR INSERT WITH CHECK (true)
--   * "Authenticated users can update files" FOR UPDATE USING (true)
--   * "Authenticated users can delete files" FOR DELETE USING (true)
-- Any signed-in user could read, list, sign, upload, overwrite, move, or
-- delete any file in the six private buckets (avatars, client-photos,
-- before-after, documents, receipts, ai-uploads), across workspaces.
--
-- Fix: drop them. Row level security stays enabled on storage.objects with
-- no client policy left, so anon and authenticated are denied every
-- operation by default; service_role (BYPASSRLS) and the dashboard are
-- unaffected. Nothing in the application or the Edge Functions uses
-- Supabase Storage yet, and the six buckets held no objects when this was
-- written, so no existing upload, download, or signed URL depends on these
-- policies.
--
-- Deliberately NOT changed here (separate, reviewed decisions): the
-- buckets themselves and their settings, storage.buckets policies, and any
-- replacement policies. Workspace-scoped policies belong with the future
-- upload feature (S3 Phase 2).
--
-- Permissions: storage.objects is owned by supabase_storage_admin; the
-- postgres role may still manage its policies through supautils'
-- policy_grants. IF EXISTS keeps this a no-op where the policies were never
-- created (a fresh local database).
DROP POLICY IF EXISTS "Authenticated users can view files" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated users can upload files" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated users can update files" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated users can delete files" ON "storage"."objects";
