-- READ-ONLY state check for the workspace-membership consent migration
-- (supabase/migrations/20261029120000_require_workspace_membership_consent.sql):
-- does the database match its PRE-migration state (S4, before the consent fix)?
--   npx supabase db query --linked -f docs/security/membership-consent/production-precheck.sql
-- A single SELECT over catalogs, privilege functions, and AGGREGATE counts
-- (no ids, names, or other row values). It never writes.
--
-- Use:
--   * BEFORE the migration's `supabase db push`: every check row (passed
--     true/false) must show passed = true. The two "informational" rows
--     (passed = NULL) are not pass/fail -- review them: they show how many
--     existing memberships are non-owner rows, which the migration keeps
--     unchanged (and whose members it lets leave).
--   * AFTER an approved forward-rollback.sql: every check row must again
--     show passed = true -- the pre-migration state is restored.
--   * While the migration is deployed it shows 4 failed check rows by design
--     (the four-policy set, the INSERT check, the two new policy names, and
--     the onboarding guard) -- not a failed deployment; verify the deployed
--     state with scripts/verify-workspace-staff-management.sql (28/28).
--
-- Limitation: the informational counts cannot tell whether an existing
-- non-owner membership was added with or without the member's consent.
WITH pol AS (
  SELECT policyname, cmd, regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') AS with_check
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff'
),
bootstrap AS (
  SELECT * FROM pg_proc WHERE oid = to_regprocedure('public.bootstrap_professional_workspace(text,text,text)')
)
SELECT check_name, expected, actual, CASE WHEN expected IS NULL THEN NULL ELSE expected = actual END AS passed
FROM (
  SELECT 'workspace_staff has exactly the four S4 policies, for authenticated only' AS check_name, 'true' AS expected,
         COALESCE((SELECT string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ','), ' ' ORDER BY policyname)
                     FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_staff')
                  = 'workspace_staff_delete_owner:DELETE:authenticated workspace_staff_insert_owner:INSERT:authenticated workspace_staff_select_members:SELECT:authenticated workspace_staff_update_owner:UPDATE:authenticated', false)::text AS actual
  UNION ALL
  SELECT 'INSERT policy is the S4 form (the one the migration replaces)', 'true',
         COALESCE((SELECT with_check FROM pol WHERE policyname = 'workspace_staff_insert_owner')
                  = '(is_workspace_owner(workspace_id) AND (is_active OR (profile_id <> auth.uid())))', false)::text
  UNION ALL
  SELECT 'no name collision: workspace_staff_delete_self / workspace_staff_select_own', '0',
         (SELECT count(*) FROM pol WHERE policyname IN ('workspace_staff_delete_self', 'workspace_staff_select_own'))::text
  UNION ALL
  SELECT 'bootstrap_professional_workspace(text,text,text) is SECURITY DEFINER, search_path=public, owned by postgres', 'true',
         COALESCE((SELECT prosecdef AND proconfig @> ARRAY['search_path=public'] AND pg_get_userbyid(proowner) = 'postgres' FROM bootstrap), false)::text
  UNION ALL
  SELECT 'bootstrap_professional_workspace() still has the original any-staff-row guard', 'true',
         COALESCE((SELECT prosrc LIKE '%FROM public.workspace_staff WHERE profile_id = auth.uid()%' FROM bootstrap), false)::text
  UNION ALL
  SELECT 'authenticated and service_role can EXECUTE bootstrap_professional_workspace() (kept by the migration)', 'true',
         COALESCE((SELECT has_function_privilege('authenticated', oid, 'EXECUTE') AND has_function_privilege('service_role', oid, 'EXECUTE') FROM bootstrap), false)::text
  UNION ALL
  SELECT 'is_workspace_owner(uuid) and is_workspace_member(uuid) exist', 'true',
         (to_regprocedure('public.is_workspace_owner(uuid)') IS NOT NULL AND to_regprocedure('public.is_workspace_member(uuid)') IS NOT NULL)::text
  UNION ALL
  SELECT 'row level security enabled on workspace_staff', 'true',
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspace_staff'::regclass)::text
  UNION ALL
  -- Informational (passed = NULL): aggregate counts only.
  SELECT 'informational: non-owner staff rows (membership where the member is not the workspace owner)', NULL,
         (SELECT count(*) FROM public.workspace_staff ws JOIN public.workspaces w ON w.id = ws.workspace_id WHERE ws.profile_id <> w.owner_id)::text
  UNION ALL
  SELECT 'informational: of those, inactive', NULL,
         (SELECT count(*) FROM public.workspace_staff ws JOIN public.workspaces w ON w.id = ws.workspace_id WHERE ws.profile_id <> w.owner_id AND NOT ws.is_active)::text
) AS checks
ORDER BY passed NULLS LAST, check_name;
