-- READ-ONLY production verification for the S4 fix
-- (supabase/migrations/20261015120000_restrict_workspace_staff_management.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-workspace-staff-management.sql
--
-- A single SELECT: it only reads pg_policies, pg_proc, and privilege
-- functions (has_*_privilege()). It never writes, never reads table data,
-- and never touches secrets. Every row must show passed = true.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- S4: the broad FOR ALL member policy is gone; exactly the four new ones exist.
  SELECT 'policy "workspace_staff_access" removed' AS check_name, false AS expected,
         EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff'
                 AND policyname = 'workspace_staff_access') AS actual
  UNION ALL
  SELECT 'exactly the four expected workspace_staff policies, for authenticated only', true,
         (SELECT string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ','), ' ' ORDER BY policyname)
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
         = 'workspace_staff_delete_owner:DELETE:authenticated workspace_staff_insert_owner:INSERT:authenticated workspace_staff_select_members:SELECT:authenticated workspace_staff_update_owner:UPDATE:authenticated'
  UNION ALL
  SELECT 'every workspace_staff write policy requires is_workspace_owner()', true,
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff'
                     AND cmd <> 'SELECT'
                     AND coalesce(qual, '') NOT LIKE '%is_workspace_owner(%'
                     AND coalesce(with_check, '') NOT LIKE '%is_workspace_owner(%')
  UNION ALL
  SELECT 'owner''s own row protected (delete excludes it; insert/update require it active)', true,
         (SELECT bool_and(CASE cmd
                            WHEN 'DELETE' THEN qual LIKE '%profile_id <> auth.uid()%'
                            WHEN 'INSERT' THEN with_check LIKE '%is_active OR (profile_id <> auth.uid())%'
                            WHEN 'UPDATE' THEN with_check LIKE '%is_active OR (profile_id <> auth.uid())%'
                            ELSE true END)
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
  UNION ALL
  -- is_workspace_owner(): definer-rights, pinned search_path, minimal EXECUTE.
  SELECT 'is_workspace_owner() is SECURITY DEFINER with search_path=public', true,
         (SELECT prosecdef AND proconfig @> ARRAY['search_path=public']
            FROM pg_proc WHERE oid = 'public.is_workspace_owner(uuid)'::regprocedure)
  UNION ALL
  SELECT 'is_workspace_owner() checks owner_id = auth.uid()', true,
         (SELECT prosrc LIKE '%w.owner_id = auth.uid()%'
            FROM pg_proc WHERE oid = 'public.is_workspace_owner(uuid)'::regprocedure)
  UNION ALL
  SELECT 'anon EXECUTE on is_workspace_owner()', false,
         has_function_privilege('anon', 'public.is_workspace_owner(uuid)', 'EXECUTE')
  UNION ALL
  SELECT 'PUBLIC EXECUTE on is_workspace_owner()', false,
         has_function_privilege('public', 'public.is_workspace_owner(uuid)', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated EXECUTE on is_workspace_owner()', true,
         has_function_privilege('authenticated', 'public.is_workspace_owner(uuid)', 'EXECUTE')
  UNION ALL
  SELECT 'service_role EXECUTE on is_workspace_owner()', true,
         has_function_privilege('service_role', 'public.is_workspace_owner(uuid)', 'EXECUTE')
  UNION ALL
  -- Column-level UPDATE: only is_active and base_commission_pct for authenticated.
  SELECT 'authenticated table-wide UPDATE on workspace_staff', false,
         has_table_privilege('authenticated', 'public.workspace_staff', 'UPDATE')
  UNION ALL
  SELECT 'authenticated UPDATE is_active', true,
         has_column_privilege('authenticated', 'public.workspace_staff', 'is_active', 'UPDATE')
  UNION ALL
  SELECT 'authenticated UPDATE base_commission_pct', true,
         has_column_privilege('authenticated', 'public.workspace_staff', 'base_commission_pct', 'UPDATE')
  UNION ALL
  SELECT 'authenticated UPDATE workspace_id', false,
         has_column_privilege('authenticated', 'public.workspace_staff', 'workspace_id', 'UPDATE')
  UNION ALL
  SELECT 'authenticated UPDATE profile_id', false,
         has_column_privilege('authenticated', 'public.workspace_staff', 'profile_id', 'UPDATE')
  UNION ALL
  SELECT 'anon UPDATE on any workspace_staff column', false,
         has_any_column_privilege('anon', 'public.workspace_staff', 'UPDATE')
  UNION ALL
  -- Unchanged.
  SELECT 'row level security enabled on workspace_staff (unchanged)', true,
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspace_staff'::regclass)
  UNION ALL
  SELECT 'authenticated SELECT on workspace_staff (unchanged)', true,
         has_table_privilege('authenticated', 'public.workspace_staff', 'SELECT')
) AS checks
ORDER BY passed, check_name;
