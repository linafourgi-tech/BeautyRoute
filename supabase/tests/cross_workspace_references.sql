-- Real integration test: cross-workspace references (S5)
-- (20261026120000_prevent_cross_workspace_references.sql).
--
-- LOCAL POSTGRES ONLY. Run via scripts/test-rls-local.sh, which fail-fast
-- guards against running anywhere but a Docker container on this machine
-- (see that script). Never run this against a shared or production
-- Supabase project.
--
-- Proves, against a real local Postgres with the real migrations applied,
-- that:
--   1. A member of workspace A only, who knows B's record ids, cannot INSERT
--      or UPDATE A's rows to reference B's client, service, tag,
--      appointment, visit, or file (appointments, visits, appointment_services,
--      client_tags, ai_history, revenues, expenses) -- each refused with
--      42501.
--   2. A member of BOTH A and B is refused the same way, and also cannot
--      move a referenced B record (client, service, tag, appointment, visit,
--      file) into A while B's rows still reference it -- including a client
--      linked only through client_tags and an appointment linked only
--      through appointment_services (cases only the move-side triggers can
--      refuse). Moving an unreferenced record between their own workspaces
--      still works.
--      After every refused attempt, B's rows are byte-for-byte unchanged and
--      no cross-workspace reference exists.
--   3. Same-workspace behavior is unchanged: appointments with services,
--      visits linked to an appointment, revenues linked to a visit, expenses
--      with a receipt file, client tags, and ai_history rows can still be
--      created and updated.
--   4. B's owner can still delete B's service, client, and the whole
--      workspace (delete_workspace()) -- nothing in A blocks them.
--   5. Catalog: each of the 11 *_access policies has the expected
--      same-workspace WITH CHECK, its USING clause is unchanged, and the
--      clients/appointments checks do not read client_tags /
--      appointment_services (the recursive shape).
--   6. Recursion probe (permanent): a plain member can INSERT and UPDATE in
--      all 11 tables -- no policy raises 42P17 "infinite recursion".
--   7. Catalog: all 13 triggers (7 reference-side, 6 move-side) exist, are
--      enabled, fire on the reviewed events (the move side only when
--      workspace_id changes), and their functions are SECURITY INVOKER with
--      a pinned search_path, owned by postgres, take the reviewed row locks,
--      and are not executable by anon, authenticated, or PUBLIC.
--   8. ON DELETE SET NULL actions and deletions of referenced records still
--      work: deleting an appointment, visit, or file a same-workspace row
--      references clears that reference instead of being blocked.
--
-- Concurrency (racing a reference write against a move) is covered
-- separately by scripts/test-cross-workspace-races-local.sh, which needs two
-- real sessions and so cannot live in this single-transaction file.
--
-- Same session mechanism as the other tests: `SET LOCAL ROLE` plus the
-- `request.jwt.claims` setting auth.uid() reads from. Entirely wrapped in
-- one transaction that is ALWAYS rolled back; nothing persists. Fixed,
-- obviously-fake UUIDs (...-0000000009xx) distinct from the other test
-- files'.
--
-- Local-only guard: the first statement after BEGIN refuses to run unless
-- the session setting beautyroute.local_rls_test is 'on', which only
-- scripts/test-rls-local.sh sets (via PGOPTIONS on its docker exec). Any
-- other route -- psql against a remote URL, `supabase db query --linked`,
-- a SQL editor -- stops there, before any setup. The guard covers
-- whole-file runs only: never run a selection of this file by hand.

BEGIN;

DO $$
BEGIN
  IF current_setting('beautyroute.local_rls_test', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'REFUSING TO RUN: local-only test. Run it via scripts/test-rls-local.sh (npm run test:rls:local), never directly.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Setup (as the connecting superuser-equivalent role, test setup only).
-- MA = member (owner) of A only; OB = owner of B; MAB = member of both.
-- A and B each get a full, internally consistent chain of records.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-0000-0000-0000-00000000090a', 'xref-test-member-a@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000090b', 'xref-test-owner-b@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000090c', 'xref-test-member-ab@example.invalid', '', now(), '{}'::jsonb, 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES
    ('00000000-0000-0000-0000-00000000090a', 'XRef Test Member A'),
    ('00000000-0000-0000-0000-00000000090b', 'XRef Test Owner B'),
    ('00000000-0000-0000-0000-00000000090c', 'XRef Test Member AB')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
    ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-00000000090a', 'XRef Test A', 'xref-test-a', 'XRef Test A'),
    ('00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-00000000090b', 'XRef Test B', 'xref-test-b', 'XRef Test B');

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
    ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-00000000090a', true),
    ('00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-00000000090b', true),
    ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-00000000090c', true),
    ('00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-00000000090c', true);

  -- A's chain.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009aa', 'XRef Client A'),
    ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-0000000009aa', 'XRef Client A2');
  INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES
    ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009aa', 'XRef Service A', 'haircut', 100, 30);
  INSERT INTO public.tags (id, workspace_id, name) VALUES
    ('00000000-0000-0000-0000-000000000981', '00000000-0000-0000-0000-0000000009aa', 'XRef Tag A');
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES
    ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1',
     '2026-10-26T09:00:00Z', '2026-10-26T09:30:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id) VALUES
    ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009d1');
  INSERT INTO public.visits (id, workspace_id, client_id, appointment_id) VALUES
    ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1',
     '00000000-0000-0000-0000-0000000009a1');
  INSERT INTO public.revenues (id, workspace_id, visit_id, gross_amount, payment_method) VALUES
    ('00000000-0000-0000-0000-000000000951', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009f1', 100, 'cash');
  INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose) VALUES
    ('00000000-0000-0000-0000-000000000961', '00000000-0000-0000-0000-0000000009aa', 'expense', '00000000-0000-0000-0000-000000000971',
     'https://example.invalid/xref-a.pdf', 'application/pdf', 'receipt');
  INSERT INTO public.expenses (id, workspace_id, receipt_file_id, amount, category) VALUES
    ('00000000-0000-0000-0000-000000000971', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000961', 20, 'supplies');
  INSERT INTO public.client_tags (client_id, tag_id) VALUES
    ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-000000000981');
  INSERT INTO public.ai_history (id, workspace_id, client_id, insight_type, input_context, ai_response, model_name) VALUES
    ('00000000-0000-0000-0000-000000000991', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1',
     'test', '{}'::jsonb, '{}'::jsonb, 'test-model');

  -- B's chain: every B record is referenced from inside B.
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-0000000009bb', 'XRef Client B'),
    ('00000000-0000-0000-0000-0000000009c4', '00000000-0000-0000-0000-0000000009bb', 'XRef Client B2 (unreferenced)');
  INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES
    ('00000000-0000-0000-0000-0000000009d3', '00000000-0000-0000-0000-0000000009bb', 'XRef Service B', 'haircut', 120, 45);
  INSERT INTO public.tags (id, workspace_id, name) VALUES
    ('00000000-0000-0000-0000-000000000983', '00000000-0000-0000-0000-0000000009bb', 'XRef Tag B');
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES
    ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-0000000009c3',
     '2026-10-26T10:00:00Z', '2026-10-26T10:45:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id) VALUES
    ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009d3');
  INSERT INTO public.visits (id, workspace_id, client_id, appointment_id) VALUES
    ('00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-0000000009c3',
     '00000000-0000-0000-0000-0000000009a3');
  INSERT INTO public.revenues (id, workspace_id, visit_id, gross_amount, payment_method) VALUES
    ('00000000-0000-0000-0000-000000000953', '00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-0000000009f3', 120, 'card');
  INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose) VALUES
    ('00000000-0000-0000-0000-000000000963', '00000000-0000-0000-0000-0000000009bb', 'expense', '00000000-0000-0000-0000-000000000973',
     'https://example.invalid/xref-b.pdf', 'application/pdf', 'receipt');
  INSERT INTO public.expenses (id, workspace_id, receipt_file_id, amount, category) VALUES
    ('00000000-0000-0000-0000-000000000973', '00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-000000000963', 30, 'supplies');
  INSERT INTO public.client_tags (client_id, tag_id) VALUES
    ('00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-000000000983');

  -- Trigger targets: a client referenced ONLY through client_tags, and an
  -- appointment referenced ONLY through appointment_services (no visits).
  INSERT INTO public.clients (id, workspace_id, full_name) VALUES
    ('00000000-0000-0000-0000-0000000009c5', '00000000-0000-0000-0000-0000000009bb', 'XRef Client B5 (tagged only)');
  INSERT INTO public.client_tags (client_id, tag_id) VALUES
    ('00000000-0000-0000-0000-0000000009c5', '00000000-0000-0000-0000-000000000983');
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES
    ('00000000-0000-0000-0000-0000000009a5', '00000000-0000-0000-0000-0000000009bb', '00000000-0000-0000-0000-0000000009c3',
     '2026-10-26T11:00:00Z', '2026-10-26T11:45:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id) VALUES
    ('00000000-0000-0000-0000-0000000009a5', '00000000-0000-0000-0000-0000000009d3');
END $$;

-- Test-only helpers (pg_temp, inside the always-rolled-back transaction),
-- only ever called as the test's setup role.
-- Count of cross-workspace references among the two test workspaces' rows.
CREATE FUNCTION pg_temp.xref_cross_count()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.appointments a JOIN public.clients c ON c.id = a.client_id
      WHERE a.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND c.workspace_id <> a.workspace_id)
  + (SELECT count(*) FROM public.visits v JOIN public.clients c ON c.id = v.client_id
      WHERE v.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND c.workspace_id <> v.workspace_id)
  + (SELECT count(*) FROM public.visits v JOIN public.appointments a ON a.id = v.appointment_id
      WHERE v.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND a.workspace_id <> v.workspace_id)
  + (SELECT count(*) FROM public.appointment_services x JOIN public.appointments a ON a.id = x.appointment_id JOIN public.services s ON s.id = x.service_id
      WHERE a.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND s.workspace_id <> a.workspace_id)
  + (SELECT count(*) FROM public.client_tags x JOIN public.clients c ON c.id = x.client_id JOIN public.tags t ON t.id = x.tag_id
      WHERE c.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND t.workspace_id <> c.workspace_id)
  + (SELECT count(*) FROM public.ai_history h JOIN public.clients c ON c.id = h.client_id
      WHERE h.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND c.workspace_id <> h.workspace_id)
  + (SELECT count(*) FROM public.revenues r JOIN public.visits v ON v.id = r.visit_id
      WHERE r.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND v.workspace_id <> r.workspace_id)
  + (SELECT count(*) FROM public.expenses e JOIN public.files f ON f.id = e.receipt_file_id
      WHERE e.workspace_id IN ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009bb') AND f.workspace_id <> e.workspace_id)
$$;

-- md5 of every row of B (and the link rows hanging off B's records).
CREATE FUNCTION pg_temp.xref_b_digest()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(concat_ws('#',
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.clients t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.services t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.tags t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.appointments t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.visits t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.revenues t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.files t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.expenses t WHERE t.workspace_id = '00000000-0000-0000-0000-0000000009bb'),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.appointment_services t
      WHERE t.appointment_id IN (SELECT id FROM public.appointments WHERE workspace_id = '00000000-0000-0000-0000-0000000009bb')
         OR t.service_id IN (SELECT id FROM public.services WHERE workspace_id = '00000000-0000-0000-0000-0000000009bb')),
    (SELECT string_agg(t::text, '|' ORDER BY t::text) FROM public.client_tags t
      WHERE t.client_id IN (SELECT id FROM public.clients WHERE workspace_id = '00000000-0000-0000-0000-0000000009bb')
         OR t.tag_id IN (SELECT id FROM public.tags WHERE workspace_id = '00000000-0000-0000-0000-0000000009bb'))))
$$;

CREATE TEMP TABLE xref_baseline ON COMMIT DROP AS SELECT pg_temp.xref_b_digest() AS digest;

CREATE FUNCTION pg_temp.assert_no_cross_reference(label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pg_temp.xref_cross_count() <> 0 THEN
    RAISE EXCEPTION 'S5 TEST FAILED -- SECURITY BOUNDARY BROKEN: % created % cross-workspace reference(s).', label, pg_temp.xref_cross_count();
  END IF;
  IF pg_temp.xref_b_digest() IS DISTINCT FROM (SELECT digest FROM xref_baseline) THEN
    RAISE EXCEPTION 'S5 TEST FAILED: % changed workspace B''s rows.', label;
  END IF;
END $$;

DO $$
BEGIN
  IF pg_temp.xref_cross_count() <> 0 THEN
    RAISE EXCEPTION 'S5 TEST SETUP FAILED: the seeded chains already contain a cross-workspace reference.';
  END IF;
  RAISE NOTICE 'S5 setup OK: workspaces A and B each hold a complete, internally consistent chain; baseline captured.';
END $$;

-- Attempts shared by tests 1 and 2: every way an A row could reference a B
-- record. Each must be refused with 42501. Defined once, executed as each
-- role under test (pg_temp is the session's own schema, readable by the
-- roles the test switches to).
CREATE TEMP TABLE xref_attempts (label text, stmt text) ON COMMIT DROP;
INSERT INTO xref_attempts VALUES
  ('INSERT appointments -> B client',
   $q$INSERT INTO public.appointments (workspace_id, client_id, start_time, end_time) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c3', '2026-10-27T09:00:00Z', '2026-10-27T09:30:00Z')$q$),
  ('UPDATE appointments.client_id -> B client',
   $q$UPDATE public.appointments SET client_id = '00000000-0000-0000-0000-0000000009c3' WHERE id = '00000000-0000-0000-0000-0000000009a1'$q$),
  ('INSERT visits -> B client',
   $q$INSERT INTO public.visits (workspace_id, client_id) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c3')$q$),
  ('UPDATE visits.client_id -> B client',
   $q$UPDATE public.visits SET client_id = '00000000-0000-0000-0000-0000000009c3' WHERE id = '00000000-0000-0000-0000-0000000009f1'$q$),
  ('INSERT visits -> B appointment',
   $q$INSERT INTO public.visits (workspace_id, client_id, appointment_id) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009a3')$q$),
  ('UPDATE visits.appointment_id -> B appointment',
   $q$UPDATE public.visits SET appointment_id = '00000000-0000-0000-0000-0000000009a3' WHERE id = '00000000-0000-0000-0000-0000000009f1'$q$),
  ('INSERT appointment_services -> B service',
   $q$INSERT INTO public.appointment_services (appointment_id, service_id) VALUES ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009d3')$q$),
  ('UPDATE appointment_services.service_id -> B service',
   $q$UPDATE public.appointment_services SET service_id = '00000000-0000-0000-0000-0000000009d3' WHERE appointment_id = '00000000-0000-0000-0000-0000000009a1'$q$),
  ('INSERT client_tags -> B tag',
   $q$INSERT INTO public.client_tags (client_id, tag_id) VALUES ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-000000000983')$q$),
  ('UPDATE client_tags.tag_id -> B tag',
   $q$UPDATE public.client_tags SET tag_id = '00000000-0000-0000-0000-000000000983' WHERE client_id = '00000000-0000-0000-0000-0000000009c1'$q$),
  ('INSERT ai_history -> B client',
   $q$INSERT INTO public.ai_history (workspace_id, client_id, insight_type, input_context, ai_response, model_name) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c3', 'test', '{}', '{}', 'test-model')$q$),
  ('UPDATE ai_history.client_id -> B client',
   $q$UPDATE public.ai_history SET client_id = '00000000-0000-0000-0000-0000000009c3' WHERE id = '00000000-0000-0000-0000-000000000991'$q$),
  ('INSERT revenues -> B visit',
   $q$INSERT INTO public.revenues (workspace_id, visit_id, gross_amount, payment_method) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009f3', 10, 'cash')$q$),
  ('UPDATE revenues.visit_id -> B visit',
   $q$UPDATE public.revenues SET visit_id = '00000000-0000-0000-0000-0000000009f3' WHERE id = '00000000-0000-0000-0000-000000000951'$q$),
  ('INSERT expenses -> B file',
   $q$INSERT INTO public.expenses (workspace_id, receipt_file_id, amount, category) VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000963', 5, 'supplies')$q$),
  ('UPDATE expenses.receipt_file_id -> B file',
   $q$UPDATE public.expenses SET receipt_file_id = '00000000-0000-0000-0000-000000000963' WHERE id = '00000000-0000-0000-0000-000000000971'$q$);
GRANT SELECT ON xref_attempts TO authenticated;

-- Runs every attempt as the current role; each must raise 42501.
CREATE FUNCTION pg_temp.run_xref_attempts(who text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  attempt record;
BEGIN
  FOR attempt IN SELECT * FROM xref_attempts ORDER BY label LOOP
    BEGIN
      EXECUTE attempt.stmt;
      RAISE EXCEPTION 'S5 TEST FAILED -- SECURITY BOUNDARY BROKEN: % could: %.', who, attempt.label;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected: new row violates row-level security policy (42501)
    END;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.run_xref_attempts(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 1. As MA (member of A only), holding B's ids.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090a', 'role', 'authenticated')::text, true);
SELECT pg_temp.run_xref_attempts('a member of A only');
RESET ROLE;
SELECT pg_temp.assert_no_cross_reference('a member of A only');
DO $$ BEGIN RAISE NOTICE 'S5 test 1 PASSED: a member of A only is refused (42501) for all 16 INSERT/UPDATE references to B''s client, service, tag, appointment, visit and file; B unchanged, no cross-workspace reference.'; END $$;

-- ---------------------------------------------------------------------
-- 2. As MAB (member of both A and B).
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090c', 'role', 'authenticated')::text, true);
SELECT pg_temp.run_xref_attempts('a member of both A and B');

DO $$
DECLARE
  attempt record;
  n int;
BEGIN
  -- Referenced side: moving a B record that B's rows reference into A.
  FOR attempt IN SELECT * FROM (VALUES
    ('move B client into A',      $q$UPDATE public.clients SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009c3'$q$),
    ('move B service into A',     $q$UPDATE public.services SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009d3'$q$),
    ('move B tag into A',         $q$UPDATE public.tags SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-000000000983'$q$),
    ('move B appointment into A', $q$UPDATE public.appointments SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009a3'$q$),
    ('move B visit into A',       $q$UPDATE public.visits SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009f3'$q$),
    ('move B file into A',        $q$UPDATE public.files SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-000000000963'$q$),
    -- Link-table cases, refused by the BEFORE UPDATE triggers (the policies alone would allow them):
    ('move a B client linked only through client_tags into A',
                                  $q$UPDATE public.clients SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009c5'$q$),
    ('move a B appointment linked only through appointment_services into A (re-pointing its client to A)',
                                  $q$UPDATE public.appointments SET workspace_id = '00000000-0000-0000-0000-0000000009aa', client_id = '00000000-0000-0000-0000-0000000009c1' WHERE id = '00000000-0000-0000-0000-0000000009a5'$q$)
  ) AS t(label, stmt) LOOP
    BEGIN
      EXECUTE attempt.stmt;
      RAISE EXCEPTION 'S5 TEST FAILED -- SECURITY BOUNDARY BROKEN: a member of both workspaces could %, leaving B''s rows pointing across workspaces.', attempt.label;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- expected (42501). The security property -- no cross-workspace
            -- reference, B unchanged -- is asserted right after this block;
            -- that ordinary writes still work is asserted by tests 3, 6 and 8.
    END;
  END LOOP;

  -- An unreferenced record can still move between the member's own workspaces (unchanged behavior).
  UPDATE public.clients SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-0000000009c4';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'S5 TEST FAILED: moving an unreferenced client between the member''s own workspaces no longer works.';
  END IF;
  UPDATE public.clients SET workspace_id = '00000000-0000-0000-0000-0000000009bb' WHERE id = '00000000-0000-0000-0000-0000000009c4';
END $$;

RESET ROLE;
SELECT pg_temp.assert_no_cross_reference('a member of both A and B');
DO $$ BEGIN RAISE NOTICE 'S5 test 2 PASSED: a member of both workspaces is refused all 16 references and cannot move a referenced B client, service, tag, appointment, visit or file into A (incl. the client_tags / appointment_services trigger cases); an unreferenced client still moves; B unchanged.'; END $$;

-- ---------------------------------------------------------------------
-- 3. As MA: same-workspace behavior is unchanged.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time)
  VALUES ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1', '2026-10-28T09:00:00Z', '2026-10-28T09:30:00Z');
  INSERT INTO public.appointment_services (appointment_id, service_id)
  VALUES ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009d1');
  UPDATE public.appointments SET client_id = '00000000-0000-0000-0000-0000000009c2' WHERE id = '00000000-0000-0000-0000-0000000009e1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'S5 TEST FAILED: re-pointing an appointment at another client of the same workspace failed.'; END IF;
  INSERT INTO public.visits (id, workspace_id, client_id, appointment_id)
  VALUES ('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-0000000009e1');
  INSERT INTO public.visits (id, workspace_id, client_id)
  VALUES ('00000000-0000-0000-0000-0000000009e3', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c1');
  INSERT INTO public.revenues (workspace_id, visit_id, gross_amount, payment_method)
  VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009e2', 50, 'cash');
  INSERT INTO public.revenues (workspace_id, gross_amount, payment_method)
  VALUES ('00000000-0000-0000-0000-0000000009aa', 15, 'cash');
  INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose)
  VALUES ('00000000-0000-0000-0000-0000000009e4', '00000000-0000-0000-0000-0000000009aa', 'expense', '00000000-0000-0000-0000-0000000009e5',
          'https://example.invalid/xref-a2.pdf', 'application/pdf', 'receipt');
  INSERT INTO public.expenses (id, workspace_id, receipt_file_id, amount, category)
  VALUES ('00000000-0000-0000-0000-0000000009e5', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009e4', 12, 'supplies');
  INSERT INTO public.expenses (workspace_id, amount, category) VALUES ('00000000-0000-0000-0000-0000000009aa', 7, 'rent');
  INSERT INTO public.client_tags (client_id, tag_id) VALUES ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-000000000981');
  INSERT INTO public.ai_history (workspace_id, client_id, insight_type, input_context, ai_response, model_name)
  VALUES ('00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-0000000009c2', 'test', '{}', '{}', 'test-model');
  UPDATE public.clients SET full_name = 'XRef Client A (renamed)' WHERE id = '00000000-0000-0000-0000-0000000009c1';
  UPDATE public.services SET price = 110 WHERE id = '00000000-0000-0000-0000-0000000009d1';
  UPDATE public.tags SET name = 'XRef Tag A (renamed)' WHERE id = '00000000-0000-0000-0000-000000000981';
  UPDATE public.files SET file_purpose = 'receipt-scan' WHERE id = '00000000-0000-0000-0000-000000000961';
  UPDATE public.visits SET summary_notes = 'Same-workspace update' WHERE id = '00000000-0000-0000-0000-0000000009f1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'S5 TEST FAILED: a plain same-workspace update of a referenced visit failed.'; END IF;
  RAISE NOTICE 'S5 test 3 PASSED: same-workspace appointments + services, visits (with and without an appointment), revenues (with and without a visit), expenses (with and without a receipt), client tags, ai_history, and updates of referenced records all still work.';
END $$;

RESET ROLE;
SELECT pg_temp.assert_no_cross_reference('the same-workspace operations');

-- ---------------------------------------------------------------------
-- 4. As OB (owner of B): B can delete its service, client, and workspace.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090b', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    DELETE FROM public.appointment_services
    WHERE appointment_id IN ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009a5');
    DELETE FROM public.services WHERE id = '00000000-0000-0000-0000-0000000009d3';
    DELETE FROM public.visits WHERE id = '00000000-0000-0000-0000-0000000009f3';
    DELETE FROM public.appointments WHERE id IN ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009a5');
    DELETE FROM public.clients WHERE id = '00000000-0000-0000-0000-0000000009c3';
    PERFORM public.delete_workspace('00000000-0000-0000-0000-0000000009bb');
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'S5 TEST FAILED -- SECURITY BOUNDARY BROKEN: workspace B could not delete its own records (23503) -- a row in another workspace references them. %', SQLERRM;
  END;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = '00000000-0000-0000-0000-0000000009bb')
     OR EXISTS (SELECT 1 FROM public.clients WHERE id IN ('00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-0000000009c4'))
     OR EXISTS (SELECT 1 FROM public.services WHERE id = '00000000-0000-0000-0000-0000000009d3') THEN
    RAISE EXCEPTION 'S5 TEST FAILED: B''s service, client, or workspace survived its owner''s deletion.';
  END IF;
  RAISE NOTICE 'S5 test 4 PASSED: B''s owner deleted B''s service, client, and then the whole workspace (delete_workspace()) -- nothing in A blocked it.';
END $$;

-- ---------------------------------------------------------------------
-- 5. Catalog: WITH CHECK present with the same-workspace conditions;
--    USING unchanged.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('appointments',         'appointments_access',         'is_workspace_member(workspace_id)', ARRAY['c.workspace_id = appointments.workspace_id', 'v.workspace_id <> appointments.workspace_id']),
      ('visits',               'visits_access',               'is_workspace_member(workspace_id)', ARRAY['c.workspace_id = visits.workspace_id', '(appointment_id IS NULL)', 'a.workspace_id = visits.workspace_id', 'r.workspace_id <> visits.workspace_id']),
      ('appointment_services', 'appointment_services_access', NULL,                                ARRAY['s.workspace_id = a.workspace_id', 'is_workspace_member(a.workspace_id)']),
      ('client_tags',          'client_tags_access',          NULL,                                ARRAY['t.workspace_id = c.workspace_id', 'is_workspace_member(c.workspace_id)']),
      ('ai_history',           'ai_history_access',           'is_workspace_member(workspace_id)', ARRAY['c.workspace_id = ai_history.workspace_id']),
      ('revenues',             'revenues_access',             'is_workspace_member(workspace_id)', ARRAY['(visit_id IS NULL)', 'v.workspace_id = revenues.workspace_id']),
      ('expenses',             'expenses_access',             'is_workspace_member(workspace_id)', ARRAY['(receipt_file_id IS NULL)', 'f.workspace_id = expenses.workspace_id']),
      ('clients',              'clients_access',              'is_workspace_member(workspace_id)', ARRAY['a.workspace_id <> clients.workspace_id', 'v.workspace_id <> clients.workspace_id', 'h.workspace_id <> clients.workspace_id']),
      ('services',             'services_access',             'is_workspace_member(workspace_id)', ARRAY['a.workspace_id <> services.workspace_id']),
      ('tags',                 'tags_access',                 'is_workspace_member(workspace_id)', ARRAY['c.workspace_id <> tags.workspace_id']),
      ('files',                'files_access',                'is_workspace_member(workspace_id)', ARRAY['e.workspace_id <> files.workspace_id'])
    ) AS t(tbl, pol, using_expected, fragments)
  LOOP
    DECLARE
      pp record;
      frag text;
    BEGIN
      SELECT * INTO pp FROM pg_policies WHERE schemaname = 'public' AND tablename = p.tbl AND policyname = p.pol;
      IF NOT FOUND OR pp.cmd <> 'ALL' OR pp.with_check IS NULL
         OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = p.tbl) <> 1 THEN
        RAISE EXCEPTION 'S5 TEST FAILED: % must have exactly one FOR ALL policy % with a WITH CHECK.', p.tbl, p.pol;
      END IF;
      IF p.using_expected IS NOT NULL AND pp.qual <> p.using_expected THEN
        RAISE EXCEPTION 'S5 TEST FAILED: the USING clause of % changed (%).', p.pol, pp.qual;
      END IF;
      IF p.using_expected IS NOT NULL AND position('is_workspace_member(workspace_id)' IN pp.with_check) = 0 THEN
        RAISE EXCEPTION 'S5 TEST FAILED: the WITH CHECK of % lost the membership check.', p.pol;
      END IF;
      FOREACH frag IN ARRAY p.fragments LOOP
        IF position(frag IN pp.with_check) = 0 THEN
          RAISE EXCEPTION 'S5 TEST FAILED: the WITH CHECK of % is missing "%".', p.pol, frag;
        END IF;
      END LOOP;
    END;
  END LOOP;
  -- The recursive shape must stay out: clients' / appointments' checks may
  -- not read the link tables whose own USING reads them back.
  IF (SELECT with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_access') LIKE '%client_tags%'
     OR (SELECT with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments' AND policyname = 'appointments_access') LIKE '%appointment_services%' THEN
    RAISE EXCEPTION 'S5 TEST FAILED: clients_access / appointments_access read a link table in WITH CHECK (infinite policy recursion).';
  END IF;
  RAISE NOTICE 'S5 test 5 PASSED: all 11 *_access policies carry the same-workspace WITH CHECK; their USING clauses are unchanged; no recursive link-table read.';
END $$;

-- ---------------------------------------------------------------------
-- 6. Recursion probe (permanent): as MA, every one of the 11 tables accepts
--    an INSERT and an UPDATE -- no policy raises 42P17.
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090a', 'role', 'authenticated')::text, true);

DO $$
DECLARE
  probe record;
BEGIN
  FOR probe IN SELECT * FROM (VALUES
    (1,  'clients INSERT',              $q$INSERT INTO public.clients (id, workspace_id, full_name) VALUES ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-0000000009aa', 'XRef Probe Client')$q$),
    (2,  'clients UPDATE',              $q$UPDATE public.clients SET full_name = 'XRef Probe Client 2' WHERE id = '00000000-0000-0000-0000-000000000901'$q$),
    (3,  'services INSERT',             $q$INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-0000000009aa', 'XRef Probe Service', 'haircut', 1, 1)$q$),
    (4,  'services UPDATE',             $q$UPDATE public.services SET price = 2 WHERE id = '00000000-0000-0000-0000-000000000902'$q$),
    (5,  'tags INSERT',                 $q$INSERT INTO public.tags (id, workspace_id, name) VALUES ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-0000000009aa', 'XRef Probe Tag')$q$),
    (6,  'tags UPDATE',                 $q$UPDATE public.tags SET name = 'XRef Probe Tag 2' WHERE id = '00000000-0000-0000-0000-000000000903'$q$),
    (7,  'files INSERT',                $q$INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose) VALUES ('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-0000000009aa', 'expense', '00000000-0000-0000-0000-000000000905', 'https://example.invalid/probe.pdf', 'application/pdf', 'receipt')$q$),
    (8,  'files UPDATE',                $q$UPDATE public.files SET file_purpose = 'receipt-2' WHERE id = '00000000-0000-0000-0000-000000000904'$q$),
    (9,  'appointments INSERT',         $q$INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES ('00000000-0000-0000-0000-000000000906', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000901', '2026-10-29T09:00:00Z', '2026-10-29T09:30:00Z')$q$),
    (10, 'appointments UPDATE',         $q$UPDATE public.appointments SET notes = 'probe' WHERE id = '00000000-0000-0000-0000-000000000906'$q$),
    (11, 'appointment_services INSERT', $q$INSERT INTO public.appointment_services (appointment_id, service_id) VALUES ('00000000-0000-0000-0000-000000000906', '00000000-0000-0000-0000-000000000902')$q$),
    (12, 'appointment_services UPDATE', $q$UPDATE public.appointment_services SET service_id = '00000000-0000-0000-0000-000000000902' WHERE appointment_id = '00000000-0000-0000-0000-000000000906'$q$),
    (13, 'visits INSERT',               $q$INSERT INTO public.visits (id, workspace_id, client_id, appointment_id) VALUES ('00000000-0000-0000-0000-000000000907', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000906')$q$),
    (14, 'visits UPDATE',               $q$UPDATE public.visits SET summary_notes = 'probe' WHERE id = '00000000-0000-0000-0000-000000000907'$q$),
    (15, 'client_tags INSERT',          $q$INSERT INTO public.client_tags (client_id, tag_id) VALUES ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000903')$q$),
    (16, 'client_tags UPDATE',          $q$UPDATE public.client_tags SET tag_id = '00000000-0000-0000-0000-000000000903' WHERE client_id = '00000000-0000-0000-0000-000000000901'$q$),
    (17, 'ai_history INSERT',           $q$INSERT INTO public.ai_history (id, workspace_id, client_id, insight_type, input_context, ai_response, model_name) VALUES ('00000000-0000-0000-0000-000000000908', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000901', 'test', '{}', '{}', 'test-model')$q$),
    (18, 'ai_history UPDATE',           $q$UPDATE public.ai_history SET tokens_used = 1 WHERE id = '00000000-0000-0000-0000-000000000908'$q$),
    (19, 'revenues INSERT',             $q$INSERT INTO public.revenues (id, workspace_id, visit_id, gross_amount, payment_method) VALUES ('00000000-0000-0000-0000-000000000909', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000907', 1, 'cash')$q$),
    (20, 'revenues UPDATE',             $q$UPDATE public.revenues SET tip_amount = 1 WHERE id = '00000000-0000-0000-0000-000000000909'$q$),
    (21, 'expenses INSERT',             $q$INSERT INTO public.expenses (id, workspace_id, receipt_file_id, amount, category) VALUES ('00000000-0000-0000-0000-00000000090f', '00000000-0000-0000-0000-0000000009aa', '00000000-0000-0000-0000-000000000904', 1, 'supplies')$q$),
    (22, 'expenses UPDATE',             $q$UPDATE public.expenses SET description = 'probe' WHERE id = '00000000-0000-0000-0000-00000000090f'$q$),
    -- Moving within the same workspace leaves workspace_id unchanged: the triggers must not fire or block.
    (23, 'clients UPDATE workspace_id (unchanged value)',      $q$UPDATE public.clients SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-000000000901'$q$),
    (24, 'appointments UPDATE workspace_id (unchanged value)', $q$UPDATE public.appointments SET workspace_id = '00000000-0000-0000-0000-0000000009aa' WHERE id = '00000000-0000-0000-0000-000000000906'$q$)
  ) AS t(n, label, stmt) ORDER BY n LOOP
    BEGIN
      EXECUTE probe.stmt;
    EXCEPTION WHEN SQLSTATE '42P17' THEN
      RAISE EXCEPTION 'S5 TEST FAILED: % raised infinite policy recursion (42P17): %', probe.label, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'S5 test 6 PASSED: recursion probe -- a member can INSERT and UPDATE in all 11 tables (and re-save workspace_id unchanged) with no 42P17.';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 7. Catalog: the 13 triggers and their functions.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    -- reference side: BEFORE INSERT OR UPDATE [OF ...], FOR KEY SHARE
    ('public.appointments'::regclass,         'trg_appointments_same_workspace_refs',         'public.same_workspace_appointment_refs()'::regprocedure,         'BEFORE INSERT OR UPDATE OF client_id, workspace_id ON public.appointments FOR EACH ROW EXECUTE', 'FOR KEY SHARE'),
    ('public.visits'::regclass,               'trg_visits_same_workspace_refs',               'public.same_workspace_visit_refs()'::regprocedure,               'BEFORE INSERT OR UPDATE OF client_id, appointment_id, workspace_id ON public.visits FOR EACH ROW EXECUTE', 'FOR KEY SHARE'),
    ('public.appointment_services'::regclass, 'trg_appointment_services_same_workspace_refs', 'public.same_workspace_appointment_service_refs()'::regprocedure, 'BEFORE INSERT OR UPDATE ON public.appointment_services FOR EACH ROW EXECUTE', 'FOR KEY SHARE OF a, s'),
    ('public.client_tags'::regclass,          'trg_client_tags_same_workspace_refs',          'public.same_workspace_client_tag_refs()'::regprocedure,          'BEFORE INSERT OR UPDATE ON public.client_tags FOR EACH ROW EXECUTE', 'FOR KEY SHARE OF c, t'),
    ('public.ai_history'::regclass,           'trg_ai_history_same_workspace_refs',           'public.same_workspace_ai_history_refs()'::regprocedure,           'BEFORE INSERT OR UPDATE OF client_id, workspace_id ON public.ai_history FOR EACH ROW EXECUTE', 'FOR KEY SHARE'),
    ('public.revenues'::regclass,             'trg_revenues_same_workspace_refs',             'public.same_workspace_revenue_refs()'::regprocedure,             'BEFORE INSERT OR UPDATE OF visit_id, workspace_id ON public.revenues FOR EACH ROW EXECUTE', 'FOR KEY SHARE'),
    ('public.expenses'::regclass,             'trg_expenses_same_workspace_refs',             'public.same_workspace_expense_refs()'::regprocedure,             'BEFORE INSERT OR UPDATE OF receipt_file_id, workspace_id ON public.expenses FOR EACH ROW EXECUTE', 'FOR KEY SHARE'),
    -- move side: BEFORE UPDATE OF workspace_id, only when it changes, FOR UPDATE
    ('public.clients'::regclass,      'trg_clients_same_workspace_move',      'public.same_workspace_client_move()'::regprocedure,      'BEFORE UPDATE OF workspace_id ON public.clients FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE'),
    ('public.services'::regclass,     'trg_services_same_workspace_move',     'public.same_workspace_service_move()'::regprocedure,     'BEFORE UPDATE OF workspace_id ON public.services FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE'),
    ('public.tags'::regclass,         'trg_tags_same_workspace_move',         'public.same_workspace_tag_move()'::regprocedure,         'BEFORE UPDATE OF workspace_id ON public.tags FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE'),
    ('public.appointments'::regclass, 'trg_appointments_same_workspace_move', 'public.same_workspace_appointment_move()'::regprocedure, 'BEFORE UPDATE OF workspace_id ON public.appointments FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE'),
    ('public.visits'::regclass,       'trg_visits_same_workspace_move',       'public.same_workspace_visit_move()'::regprocedure,       'BEFORE UPDATE OF workspace_id ON public.visits FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE'),
    ('public.files'::regclass,        'trg_files_same_workspace_move',        'public.same_workspace_file_move()'::regprocedure,        'BEFORE UPDATE OF workspace_id ON public.files FOR EACH ROW WHEN ((old.workspace_id IS DISTINCT FROM new.workspace_id)) EXECUTE', 'FOR UPDATE')
  ) AS v(tbl, tg, fn, def, lock) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = t.tbl AND tgname = t.tg AND NOT tgisinternal
                   AND tgenabled = 'O' AND tgfoid = t.fn AND position(t.def IN pg_get_triggerdef(oid)) > 0) THEN
      RAISE EXCEPTION 'S5 TEST FAILED: trigger % is missing, disabled, or not "%".', t.tg, t.def;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = t.fn AND NOT prosecdef AND proconfig @> ARRAY['search_path=public']
                   AND pg_get_userbyid(proowner) = 'postgres' AND position(t.lock IN prosrc) > 0) THEN
      RAISE EXCEPTION 'S5 TEST FAILED: % must be SECURITY INVOKER, search_path=public, owned by postgres, and take %.', t.fn, t.lock;
    END IF;
    IF has_function_privilege('anon', t.fn, 'EXECUTE') OR has_function_privilege('authenticated', t.fn, 'EXECUTE')
       OR has_function_privilege('public', t.fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5 TEST FAILED: % is executable by a client role.', t.fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg_%same_workspace%') <> 13 THEN
    RAISE EXCEPTION 'S5 TEST FAILED: expected exactly 13 same-workspace triggers.';
  END IF;
  RAISE NOTICE 'S5 test 7 PASSED: all 13 triggers enabled on the reviewed events; functions SECURITY INVOKER, search_path=public, owned by postgres, taking FOR KEY SHARE / FOR UPDATE, not executable by anon/authenticated/PUBLIC.';
END $$;

-- ---------------------------------------------------------------------
-- 8. As MA: ON DELETE SET NULL actions and deletions of referenced records
--    still work (the reference-side triggers skip NULL references).
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000090a', 'role', 'authenticated')::text, true);

DO $$
BEGIN
  -- A's chain from setup: appointment a1 <- visit f1 (appointment_id) <- revenue 51 (visit_id); file 61 <- expense 71.
  DELETE FROM public.appointment_services WHERE appointment_id = '00000000-0000-0000-0000-0000000009a1';
  DELETE FROM public.appointments WHERE id = '00000000-0000-0000-0000-0000000009a1';
  DELETE FROM public.visits WHERE id = '00000000-0000-0000-0000-0000000009f1';
  DELETE FROM public.files WHERE id = '00000000-0000-0000-0000-000000000961';
END $$;

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.appointments WHERE id = '00000000-0000-0000-0000-0000000009a1')
     OR EXISTS (SELECT 1 FROM public.visits WHERE id = '00000000-0000-0000-0000-0000000009f1')
     OR EXISTS (SELECT 1 FROM public.files WHERE id = '00000000-0000-0000-0000-000000000961')
     OR NOT EXISTS (SELECT 1 FROM public.revenues WHERE id = '00000000-0000-0000-0000-000000000951' AND visit_id IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.expenses WHERE id = '00000000-0000-0000-0000-000000000971' AND receipt_file_id IS NULL) THEN
    RAISE EXCEPTION 'S5 TEST FAILED: deleting a referenced appointment, visit, or file did not clear the references (ON DELETE SET NULL).';
  END IF;
  IF pg_temp.xref_cross_count() <> 0 THEN
    RAISE EXCEPTION 'S5 TEST FAILED: the deletions left a cross-workspace reference.';
  END IF;
  RAISE NOTICE 'S5 test 8 PASSED: deleting a referenced appointment, visit, and file still works; ON DELETE SET NULL cleared visits.appointment_id, revenues.visit_id, and expenses.receipt_file_id.';
  RAISE NOTICE 'S5 cross-workspace references test PASSED: all 8 checks hold (real local Postgres, real row level security and triggers, no mocking).';
END $$;

ROLLBACK;
