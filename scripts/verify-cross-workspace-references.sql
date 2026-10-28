-- READ-ONLY production verification for the S5 fix
-- (supabase/migrations/20261026120000_prevent_cross_workspace_references.sql).
--
-- Run AFTER an approved `supabase db push`, against the linked project:
--   npx supabase db query --linked -f scripts/verify-cross-workspace-references.sql
--
-- A single SELECT: it reads pg_policies, pg_trigger, pg_proc, privilege
-- functions, and -- for the last check only -- AGGREGATE counts of
-- cross-workspace references (a single number; no row, id, or value is
-- returned). It never writes and never touches secrets. Every row must show
-- passed = true.
WITH pol AS (
  SELECT policyname, qual, regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') AS wc
  FROM pg_policies WHERE schemaname = 'public'
)
SELECT check_name, expected, actual, (expected = actual) AS passed
FROM (
  -- Referencing side: same-workspace WITH CHECK present (membership kept).
  SELECT 'appointments_access: client in same workspace; no visit elsewhere' AS check_name, true AS expected,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%c.workspace_id = appointments.workspace_id%'
                 AND wc LIKE '%v.workspace_id <> appointments.workspace_id%' FROM pol WHERE policyname = 'appointments_access') AS actual
  UNION ALL
  SELECT 'visits_access: client and appointment in same workspace; no revenue elsewhere', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%c.workspace_id = visits.workspace_id%'
                 AND wc LIKE '%(appointment_id IS NULL)%' AND wc LIKE '%a.workspace_id = visits.workspace_id%'
                 AND wc LIKE '%r.workspace_id <> visits.workspace_id%' FROM pol WHERE policyname = 'visits_access')
  UNION ALL
  SELECT 'appointment_services_access: service in the appointment''s workspace', true,
         (SELECT wc LIKE '%s.workspace_id = a.workspace_id%' AND wc LIKE '%is_workspace_member(a.workspace_id)%'
            FROM pol WHERE policyname = 'appointment_services_access')
  UNION ALL
  SELECT 'client_tags_access: tag in the client''s workspace', true,
         (SELECT wc LIKE '%t.workspace_id = c.workspace_id%' AND wc LIKE '%is_workspace_member(c.workspace_id)%'
            FROM pol WHERE policyname = 'client_tags_access')
  UNION ALL
  SELECT 'ai_history_access: client in same workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%c.workspace_id = ai_history.workspace_id%'
            FROM pol WHERE policyname = 'ai_history_access')
  UNION ALL
  SELECT 'revenues_access: visit (when set) in same workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%(visit_id IS NULL)%' AND wc LIKE '%v.workspace_id = revenues.workspace_id%'
            FROM pol WHERE policyname = 'revenues_access')
  UNION ALL
  SELECT 'expenses_access: receipt file (when set) in same workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%(receipt_file_id IS NULL)%' AND wc LIKE '%f.workspace_id = expenses.workspace_id%'
            FROM pol WHERE policyname = 'expenses_access')
  UNION ALL
  -- Referenced side.
  SELECT 'clients_access: not movable from appointments/visits/ai_history of its workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%a.workspace_id <> clients.workspace_id%'
                 AND wc LIKE '%v.workspace_id <> clients.workspace_id%' AND wc LIKE '%h.workspace_id <> clients.workspace_id%'
            FROM pol WHERE policyname = 'clients_access')
  UNION ALL
  SELECT 'services_access: not movable from appointment_services of its workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%a.workspace_id <> services.workspace_id%'
            FROM pol WHERE policyname = 'services_access')
  UNION ALL
  SELECT 'tags_access: not movable from client_tags of its workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%c.workspace_id <> tags.workspace_id%'
            FROM pol WHERE policyname = 'tags_access')
  UNION ALL
  SELECT 'files_access: not movable from expenses of its workspace', true,
         (SELECT wc LIKE '(is_workspace_member(workspace_id) AND %' AND wc LIKE '%e.workspace_id <> files.workspace_id%'
            FROM pol WHERE policyname = 'files_access')
  UNION ALL
  -- Read/delete behavior unchanged; no recursive shape.
  SELECT 'USING clauses unchanged on the 9 workspace_id tables', true,
         (SELECT count(*) = 9 AND bool_and(COALESCE(qual = 'is_workspace_member(workspace_id)', false)) FROM pol
           WHERE policyname IN ('appointments_access', 'visits_access', 'ai_history_access', 'revenues_access', 'expenses_access',
                                'clients_access', 'services_access', 'tags_access', 'files_access'))
  UNION ALL
  SELECT 'no recursive link-table read in clients_access / appointments_access', true,
         (SELECT bool_and(CASE policyname WHEN 'clients_access' THEN wc NOT LIKE '%client_tags%'
                                          ELSE wc NOT LIKE '%appointment_services%' END)
            FROM pol WHERE policyname IN ('clients_access', 'appointments_access'))
  UNION ALL
  -- Triggers: 7 reference-side (lock-and-check) + 6 move-side (lock, then re-check).
  SELECT 'all 7 reference-side triggers enabled, BEFORE INSERT OR UPDATE, row-level', true,
         (SELECT count(*) = 7 FROM pg_trigger t
           WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgname IN (
                 'trg_appointments_same_workspace_refs', 'trg_visits_same_workspace_refs', 'trg_appointment_services_same_workspace_refs',
                 'trg_client_tags_same_workspace_refs', 'trg_ai_history_same_workspace_refs', 'trg_revenues_same_workspace_refs',
                 'trg_expenses_same_workspace_refs')
             AND pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE%FOR EACH ROW%')
  UNION ALL
  SELECT 'all 6 move-side triggers enabled, BEFORE UPDATE OF workspace_id, change-guarded', true,
         (SELECT count(*) = 6 FROM pg_trigger t
           WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgname IN (
                 'trg_clients_same_workspace_move', 'trg_services_same_workspace_move', 'trg_tags_same_workspace_move',
                 'trg_appointments_same_workspace_move', 'trg_visits_same_workspace_move', 'trg_files_same_workspace_move')
             AND pg_get_triggerdef(t.oid) LIKE '%BEFORE UPDATE OF workspace_id%FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id))%')
  UNION ALL
  SELECT 'exactly 13 same-workspace triggers', true,
         (SELECT count(*) = 13 FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg\_%\_same\_workspace\_%')
  UNION ALL
  SELECT 'trigger functions: 13, SECURITY INVOKER, search_path=public, owned by postgres', true,
         (SELECT count(*) = 13 AND bool_and(NOT prosecdef AND COALESCE(proconfig @> ARRAY['search_path=public'], false) AND pg_get_userbyid(proowner) = 'postgres')
            FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'same\_workspace\_%')
  UNION ALL
  SELECT 'reference-side functions lock FOR KEY SHARE; move-side functions lock FOR UPDATE', true,
         (SELECT bool_and(CASE WHEN proname LIKE '%\_refs' THEN prosrc LIKE '%FOR KEY SHARE%' ELSE prosrc LIKE '%FOR UPDATE%' END)
            FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'same\_workspace\_%')
  UNION ALL
  SELECT 'trigger functions not executable by anon, authenticated, or PUBLIC', false,
         (SELECT bool_or(has_function_privilege(r, p.oid, 'EXECUTE'))
            FROM unnest(ARRAY['anon', 'authenticated', 'public']) AS r,
                 pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'same\_workspace\_%')
  UNION ALL
  -- Data: aggregate count only.
  SELECT 'zero cross-workspace references in the data (aggregate count)', true,
         ((SELECT count(*) FROM public.appointments x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.visits x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.visits x JOIN public.appointments a ON a.id = x.appointment_id WHERE a.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.appointment_services x JOIN public.appointments a ON a.id = x.appointment_id JOIN public.services s ON s.id = x.service_id WHERE s.workspace_id <> a.workspace_id)
        + (SELECT count(*) FROM public.client_tags x JOIN public.clients c ON c.id = x.client_id JOIN public.tags t ON t.id = x.tag_id WHERE t.workspace_id <> c.workspace_id)
        + (SELECT count(*) FROM public.ai_history x JOIN public.clients c ON c.id = x.client_id WHERE c.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.revenues x JOIN public.visits v ON v.id = x.visit_id WHERE v.workspace_id <> x.workspace_id)
        + (SELECT count(*) FROM public.expenses x JOIN public.files f ON f.id = x.receipt_file_id WHERE f.workspace_id <> x.workspace_id)) = 0
) AS checks
ORDER BY passed, check_name;
