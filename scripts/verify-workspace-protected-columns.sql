-- READ-ONLY production verification for the S1 fix
-- (supabase/migrations/20261011120000_restrict_workspace_protected_columns.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-workspace-protected-columns.sql
--
-- A single SELECT: it only reads privilege catalogs via has_*_privilege()
-- and pg_policies. It never writes, never reads table data, and never
-- touches secrets. Every row must show passed = true; any false row means
-- the deployed privileges don't match the migration.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- authenticated: protected columns must NOT be updatable.
  SELECT 'authenticated UPDATE ' || c AS check_name, false AS expected,
         has_column_privilege('authenticated', 'public.workspaces', c, 'UPDATE') AS actual
  FROM unnest(ARRAY['plan_tier', 'subscription_status', 'trial_ends_at', 'trial_started_at',
                    'owner_id', 'id', 'slug', 'created_at', 'updated_at']) AS c
  UNION ALL
  -- authenticated: exactly the 8 allowlisted columns stay updatable.
  SELECT 'authenticated UPDATE ' || c, true,
         has_column_privilege('authenticated', 'public.workspaces', c, 'UPDATE')
  FROM unnest(ARRAY['name', 'display_brand', 'timezone', 'currency', 'locale', 'city',
                    'district', 'business_type']) AS c
  UNION ALL
  -- anon: no UPDATE on any column (has_any_column_privilege covers all).
  SELECT 'anon UPDATE on any workspaces column', false,
         has_any_column_privilege('anon', 'public.workspaces', 'UPDATE')
  UNION ALL
  -- No table-wide UPDATE left for the client roles.
  SELECT 'authenticated table-wide UPDATE', false,
         has_table_privilege('authenticated', 'public.workspaces', 'UPDATE')
  UNION ALL
  SELECT 'anon table-wide UPDATE', false,
         has_table_privilege('anon', 'public.workspaces', 'UPDATE')
  UNION ALL
  -- The authorized server-side path keeps full UPDATE.
  SELECT 'service_role table-wide UPDATE', true,
         has_table_privilege('service_role', 'public.workspaces', 'UPDATE')
  UNION ALL
  -- Out of scope for S1 and intentionally unchanged: SELECT still works
  -- for the app (read paths, subscription checks).
  SELECT 'authenticated SELECT (unchanged)', true,
         has_table_privilege('authenticated', 'public.workspaces', 'SELECT')
  UNION ALL
  -- The RLS policy is unchanged: still exactly one policy, workspace_access.
  SELECT 'workspaces policy unchanged (workspace_access only)', true,
         (SELECT count(*) = 1 AND bool_and(policyname = 'workspace_access')
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces')
) AS checks
ORDER BY passed, check_name;
