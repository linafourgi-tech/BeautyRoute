-- READ-ONLY production verification of the CURRENT workspace_staff controls:
--   * S4, supabase/migrations/20261015120000_restrict_workspace_staff_management.sql
--     (only the owner manages staff; the owner's own row is protected), and
--   * the membership-consent fix,
--     supabase/migrations/20261029120000_require_workspace_membership_consent.sql
--     (an owner can no longer add another user; a non-owner member can leave;
--     a user can see only their own staff rows beyond their active
--     workspaces' lists; onboarding refuses only existing owners; anon cannot
--     call it).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-workspace-staff-management.sql
--
-- It checks the state after BOTH migrations. Before the consent migration is
-- applied, the six-policy, INSERT, self-leave, own-row SELECT, and bootstrap
-- checks fail by design.
--
-- A single SELECT: it only reads pg_policies, pg_proc, pg_class, and
-- privilege functions (has_*_privilege()). It never writes, never reads table
-- data, and never touches secrets. Every row must show passed = true.
WITH pol AS (
  SELECT policyname, cmd,
         regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') AS qual,
         regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') AS with_check
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff'
),
bootstrap AS (
  SELECT * FROM pg_proc WHERE oid = 'public.bootstrap_professional_workspace(text,text,text)'::regprocedure
)
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- Policies: the broad FOR ALL member policy is gone; exactly six remain.
  SELECT 'policy "workspace_staff_access" removed' AS check_name, false AS expected,
         EXISTS (SELECT 1 FROM pol WHERE policyname = 'workspace_staff_access') AS actual
  UNION ALL
  SELECT 'exactly the six expected workspace_staff policies, for authenticated only', true,
         COALESCE((SELECT string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ','), ' ' ORDER BY policyname)
                     FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
                  = 'workspace_staff_delete_owner:DELETE:authenticated workspace_staff_delete_self:DELETE:authenticated workspace_staff_insert_owner:INSERT:authenticated workspace_staff_select_members:SELECT:authenticated workspace_staff_select_own:SELECT:authenticated workspace_staff_update_owner:UPDATE:authenticated', false)
  UNION ALL
  SELECT 'SELECT (own rows): a user sees only their own staff rows through it', true,
         COALESCE((SELECT qual FROM pol WHERE policyname = 'workspace_staff_select_own') = '(profile_id = auth.uid())', false)
  UNION ALL
  SELECT 'every write policy except the exact self-leave policy requires is_workspace_owner()', true,
         NOT EXISTS (SELECT 1 FROM pol WHERE cmd <> 'SELECT' AND policyname <> 'workspace_staff_delete_self'
                     AND qual NOT LIKE '%is_workspace_owner(%' AND with_check NOT LIKE '%is_workspace_owner(%')
  UNION ALL
  SELECT 'INSERT: an owner may insert only their own active row (no adding other users)', true,
         COALESCE((SELECT with_check FROM pol WHERE policyname = 'workspace_staff_insert_owner')
                  = '(is_workspace_owner(workspace_id) AND (profile_id = auth.uid()) AND is_active)', false)
  UNION ALL
  SELECT 'DELETE (owner): removes other staff, never the owner''s own row', true,
         COALESCE((SELECT qual FROM pol WHERE policyname = 'workspace_staff_delete_owner')
                  = '(is_workspace_owner(workspace_id) AND (profile_id <> auth.uid()))', false)
  UNION ALL
  SELECT 'DELETE (self-leave): a non-owner member removes only their own row', true,
         COALESCE((SELECT qual FROM pol WHERE policyname = 'workspace_staff_delete_self')
                  = '((profile_id = auth.uid()) AND (NOT is_workspace_owner(workspace_id)))', false)
  UNION ALL
  SELECT 'UPDATE (owner): the owner''s own row stays active', true,
         COALESCE((SELECT with_check LIKE '%is_active OR (profile_id <> auth.uid())%' FROM pol WHERE policyname = 'workspace_staff_update_owner'), false)
  UNION ALL
  -- is_workspace_owner(): definer-rights, pinned search_path, minimal EXECUTE.
  SELECT 'is_workspace_owner() is SECURITY DEFINER with search_path=public', true,
         COALESCE((SELECT prosecdef AND proconfig @> ARRAY['search_path=public']
                     FROM pg_proc WHERE oid = 'public.is_workspace_owner(uuid)'::regprocedure), false)
  UNION ALL
  SELECT 'is_workspace_owner() checks owner_id = auth.uid()', true,
         COALESCE((SELECT prosrc LIKE '%w.owner_id = auth.uid()%'
                     FROM pg_proc WHERE oid = 'public.is_workspace_owner(uuid)'::regprocedure), false)
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
  -- Onboarding: bootstrap_professional_workspace().
  SELECT 'bootstrap_professional_workspace() is SECURITY DEFINER, search_path=public, owned by postgres', true,
         COALESCE((SELECT prosecdef AND proconfig @> ARRAY['search_path=public'] AND pg_get_userbyid(proowner) = 'postgres' FROM bootstrap), false)
  UNION ALL
  SELECT 'bootstrap_professional_workspace() refuses only users who already own a workspace', true,
         COALESCE((SELECT prosrc LIKE '%FROM public.workspaces WHERE owner_id = auth.uid()%'
                          AND prosrc NOT LIKE '%FROM public.workspace_staff WHERE profile_id = auth.uid()%' FROM bootstrap), false)
  UNION ALL
  SELECT 'anon EXECUTE on bootstrap_professional_workspace()', false,
         has_function_privilege('anon', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'PUBLIC EXECUTE on bootstrap_professional_workspace()', false,
         has_function_privilege('public', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated EXECUTE on bootstrap_professional_workspace()', true,
         has_function_privilege('authenticated', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'service_role EXECUTE on bootstrap_professional_workspace()', true,
         has_function_privilege('service_role', 'public.bootstrap_professional_workspace(text,text,text)', 'EXECUTE')
  UNION ALL
  -- Unchanged.
  SELECT 'row level security enabled on workspace_staff (unchanged)', true,
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspace_staff'::regclass)
  UNION ALL
  SELECT 'authenticated SELECT on workspace_staff (unchanged)', true,
         has_table_privilege('authenticated', 'public.workspace_staff', 'SELECT')
) AS checks
ORDER BY passed, check_name;
