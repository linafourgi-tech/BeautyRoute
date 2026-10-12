-- READ-ONLY production verification for the S1-b fix
-- (supabase/migrations/20261012120000_restrict_workspace_direct_delete.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-workspace-direct-delete.sql
--
-- A single SELECT: it only reads privilege catalogs (has_*_privilege()),
-- pg_policies, pg_constraint, and pg_proc. It never writes, never reads
-- table data, and never touches secrets. Every row must show passed = true.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- S1-b: no direct DELETE for the client roles; server-side keeps it.
  SELECT 'authenticated DELETE on workspaces' AS check_name, false AS expected,
         has_table_privilege('authenticated', 'public.workspaces', 'DELETE') AS actual
  UNION ALL
  SELECT 'anon DELETE on workspaces', false,
         has_table_privilege('anon', 'public.workspaces', 'DELETE')
  UNION ALL
  SELECT 'service_role DELETE on workspaces', true,
         has_table_privilege('service_role', 'public.workspaces', 'DELETE')
  UNION ALL
  -- The authorized deletion path is unchanged.
  SELECT 'delete_workspace() exists and is SECURITY DEFINER', true,
         (SELECT bool_and(p.prosecdef) AND count(*) = 1
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'delete_workspace')
  UNION ALL
  SELECT 'authenticated EXECUTE on delete_workspace() (unchanged)', true,
         has_function_privilege('authenticated', 'public.delete_workspace(uuid)', 'EXECUTE')
  UNION ALL
  -- Policy and foreign keys unchanged.
  SELECT 'workspaces policy unchanged (workspace_access only)', true,
         (SELECT count(*) = 1 AND bool_and(policyname = 'workspace_access')
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces')
  UNION ALL
  SELECT '13 foreign keys reference workspaces, all ON DELETE CASCADE (unchanged)', true,
         (SELECT count(*) = 13 AND bool_and(confdeltype = 'c')
            FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.workspaces'::regclass)
  UNION ALL
  -- S1 still holds (spot checks; scripts/verify-workspace-protected-columns.sql is the full check).
  SELECT 'S1: authenticated UPDATE plan_tier still revoked', false,
         has_column_privilege('authenticated', 'public.workspaces', 'plan_tier', 'UPDATE')
  UNION ALL
  SELECT 'S1: authenticated UPDATE locale still granted', true,
         has_column_privilege('authenticated', 'public.workspaces', 'locale', 'UPDATE')
  UNION ALL
  -- Still readable by the app (unchanged).
  SELECT 'authenticated SELECT on workspaces (unchanged)', true,
         has_table_privilege('authenticated', 'public.workspaces', 'SELECT')
) AS checks
ORDER BY passed, check_name;
