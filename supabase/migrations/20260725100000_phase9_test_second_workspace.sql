-- Test scaffolding only, for verifying Phase 9's multi-workspace switching
-- live (real second workspace + real distinct data, not mocked). Not a
-- schema change -- inserts two data rows using the existing tables/columns.
-- Removed by a follow-up cleanup migration once verification is done, same
-- pattern as the Phase 5/8 test-data migrations.

-- Guarded (added during the Phase 14 migration-bootstrap fix): owner_id
-- below only exists as a real profile on the one real, linked Supabase
-- project. On a fresh/local database it doesn't exist, and this INSERT
-- would otherwise abort the whole migration replay with a foreign key
-- violation. Wrapping in `IF EXISTS(...)` makes that case a clean no-op
-- instead of an error. Behavior on the real project is byte-for-byte
-- unchanged: the profile exists there, so the condition is true and
-- every insert below proceeds exactly as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4') THEN
    INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand, city)
    VALUES (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4',
      'Second Test Workspace',
      'second-test-workspace',
      'Second Test Workspace',
      'Jeddah'
    );

    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4', true);

    INSERT INTO public.clients (workspace_id, full_name)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Only In Second Workspace');
  END IF;
END $$;
