-- READ-ONLY production verification for the S2 fix
-- (supabase/migrations/20261013120000_restrict_import_service_templates.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-import-service-templates.sql
--
-- A single SELECT: it only reads privilege catalogs (has_*_privilege()),
-- pg_proc, and pg_policies. It never writes, never reads table data, and
-- never touches secrets. Every row must show passed = true.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- S2: EXECUTE only for authenticated and service_role.
  SELECT 'anon EXECUTE on import_service_templates()' AS check_name, false AS expected,
         has_function_privilege('anon', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE') AS actual
  UNION ALL
  SELECT 'PUBLIC EXECUTE on import_service_templates()', false,
         has_function_privilege('public', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated EXECUTE on import_service_templates()', true,
         has_function_privilege('authenticated', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE')
  UNION ALL
  SELECT 'service_role EXECUTE on import_service_templates()', true,
         has_function_privilege('service_role', 'public.import_service_templates(uuid, uuid[])', 'EXECUTE')
  UNION ALL
  -- S2: the deployed body checks membership before touching services.
  SELECT 'membership check present before the services INSERT', true,
         (SELECT position('public.is_workspace_member(p_workspace_id)' IN prosrc) > 0
             AND position('public.is_workspace_member(p_workspace_id)' IN prosrc)
                 < position('INSERT INTO public.services' IN prosrc)
            FROM pg_proc WHERE oid = 'public.import_service_templates(uuid, uuid[])'::regprocedure)
  UNION ALL
  SELECT 'membership check raises 42501', true,
         (SELECT prosrc LIKE '%ERRCODE = ''42501''%'
            FROM pg_proc WHERE oid = 'public.import_service_templates(uuid, uuid[])'::regprocedure)
  UNION ALL
  -- Definition otherwise unchanged.
  SELECT 'import_service_templates() is SECURITY DEFINER with search_path=public (unchanged)', true,
         (SELECT prosecdef AND proconfig @> ARRAY['search_path=public']
            FROM pg_proc WHERE oid = 'public.import_service_templates(uuid, uuid[])'::regprocedure)
  UNION ALL
  SELECT 'exactly one import_service_templates() overload (unchanged)', true,
         (SELECT count(*) = 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'import_service_templates')
  UNION ALL
  -- The RLS boundary the check mirrors is unchanged.
  SELECT 'services policy unchanged (services_access only)', true,
         (SELECT count(*) = 1 AND bool_and(policyname = 'services_access')
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services')
) AS checks
ORDER BY passed, check_name;
