-- Phase 1 fix: appointment_services, client_tags, and service_templates all have
-- ROW LEVEL SECURITY enabled (see 20260722092124) but were never given a policy.
-- With RLS on and zero policies, Postgres denies every row to anon/authenticated,
-- which is why src/pages/ImportServices.jsx currently gets an empty result set
-- back from `service_templates` even though rows exist.

-- appointment_services and client_tags are pure join tables with no workspace_id
-- of their own, so membership is checked by joining to the parent row that does
-- carry workspace_id, reusing the existing is_workspace_member() helper.

CREATE POLICY "appointment_services_access" ON "public"."appointment_services"
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND public.is_workspace_member(a.workspace_id)
  )
);

CREATE POLICY "client_tags_access" ON "public"."client_tags"
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_tags.client_id
      AND public.is_workspace_member(c.workspace_id)
  )
);

-- service_templates has no workspace_id at all: it's a shared, global catalog
-- that import_service_templates() copies rows out of into a workspace's own
-- `services` table. It's read-only reference data, not something to scope by
-- workspace, so every authenticated user gets SELECT and nothing else.
CREATE POLICY "service_templates_read" ON "public"."service_templates"
FOR SELECT
USING (true);
