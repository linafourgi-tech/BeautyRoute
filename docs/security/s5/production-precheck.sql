-- READ-ONLY S5 state check: does the database match the PRE-S5 state of
-- supabase/migrations/20261026120000_prevent_cross_workspace_references.sql?
--   npx supabase db query --linked -f docs/security/s5/production-precheck.sql
-- A single SELECT over catalogs plus AGGREGATE counts (no ids or values).
-- It never writes.
--
-- S5 is already deployed (production, 2026-10-28; this check showed 8/8
-- immediately before that push). On the current, deployed state it shows
-- 5/8 -- the three checks for "no same_workspace_* functions", "no
-- trg_*_same_workspace_* triggers", and "policies have no WITH CHECK yet"
-- fail by design. 5/8 there is expected and does NOT indicate a failed
-- deployment; use scripts/verify-cross-workspace-references.sql (20/20) to
-- verify the deployed state.
--
-- Its remaining role: after an approved forward-rollback.sql, it must show
-- 8/8 (every row passed = true) to confirm the pre-S5 state was restored.
--
-- Limitation: for the two link-table policies (appointment_services_access,
-- client_tags_access) it only checks that they are FOR ALL / PUBLIC with no
-- WITH CHECK; it does not compare their USING expressions. Only the nine
-- simple policies' USING clauses are compared exactly.
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  SELECT 'zero existing cross-workspace references (aggregate count)' AS check_name, 0::bigint AS expected,
         ((SELECT count(*) FROM public.appointments x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.visits x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.visits x JOIN public.appointments a ON a.id = x.appointment_id WHERE a.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.appointment_services x JOIN public.appointments a ON a.id = x.appointment_id JOIN public.services s ON s.id = x.service_id WHERE s.workspace_id <> a.workspace_id)
        + (SELECT count(*) FROM public.client_tags x JOIN public.clients c ON c.id = x.client_id JOIN public.tags t ON t.id = x.tag_id WHERE t.workspace_id <> c.workspace_id)
        + (SELECT count(*) FROM public.ai_history x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.revenues x JOIN public.visits v ON v.id = x.visit_id WHERE v.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.expenses x JOIN public.files f ON f.id = x.receipt_file_id WHERE f.workspace_id <> x.workspace_id)) AS actual
  UNION ALL
  SELECT 'the 11 *_access policies exist (FOR ALL, PUBLIC) and have no WITH CHECK yet', 11,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'ALL' AND roles = '{public}' AND with_check IS NULL
             AND policyname IN ('appointments_access','visits_access','appointment_services_access','client_tags_access','ai_history_access',
                                'revenues_access','expenses_access','clients_access','services_access','tags_access','files_access'))
  UNION ALL
  SELECT 'the 9 simple USING clauses are is_workspace_member(workspace_id)', 9,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND qual = 'is_workspace_member(workspace_id)'
             AND policyname IN ('appointments_access','visits_access','ai_history_access','revenues_access','expenses_access',
                                'clients_access','services_access','tags_access','files_access'))
  UNION ALL
  SELECT 'no name collision: same_workspace_* functions', 0,
         (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'same\_workspace\_%')
  UNION ALL
  SELECT 'no name collision: trg_*_same_workspace_* triggers', 0,
         (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg\_%\_same\_workspace\_%')
  UNION ALL
  SELECT 'authenticated can UPDATE (needed for the row locks) the 6 referenced tables', 6,
         (SELECT count(*) FROM unnest(ARRAY['clients','services','tags','appointments','visits','files']) t
           WHERE has_any_column_privilege('authenticated', ('public.' || t)::regclass, 'UPDATE'))
  UNION ALL
  SELECT 'all foreign keys to the 6 referenced tables are ON UPDATE NO ACTION', 0,
         (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confupdtype <> 'a'
             AND confrelid IN ('public.clients'::regclass, 'public.services'::regclass, 'public.tags'::regclass,
                               'public.appointments'::regclass, 'public.visits'::regclass, 'public.files'::regclass))
  UNION ALL
  SELECT 'is_workspace_member(uuid) exists', 1,
         (SELECT count(*) FROM pg_proc WHERE oid = 'public.is_workspace_member(uuid)'::regprocedure)
) AS checks
ORDER BY passed, check_name;
