-- Phase 12 Step 4: safe, deterministic, auditable workspace deletion.
--
-- Root cause of the original failure (see 20260725100100 and
-- 20260725150100's own comments, which worked around it manually with a
-- one-off delete order): a plain `DELETE FROM workspaces WHERE id = ...`
-- relies on Postgres's own ON DELETE CASCADE to remove every dependent row,
-- and that's unsafe for any workspace with real appointment/visit data, for
-- two independent reasons:
--
-- 1. appointments.client_id and visits.client_id are ON DELETE RESTRICT
--    against clients -- but clients, appointments, and visits ALL ALSO
--    reference workspaces.id directly with ON DELETE CASCADE. Postgres does
--    not guarantee cascade-processing order between sibling tables, so a
--    workspace with any appointments/visits could have `clients`
--    cascade-deleted before `appointments`/`visits`, which would then
--    violate the RESTRICT constraint and abort the whole statement.
-- 2. appointments/clients/services/visits each carry an AFTER DELETE audit
--    trigger (audit_trigger()) that INSERTs a new row into audit_logs
--    referencing workspace_id. ON DELETE CASCADE is itself implemented as
--    an AFTER DELETE trigger on the *referenced* table (workspaces), which
--    runs before the cascaded deletes it triggers on referencing tables --
--    so by the time one of those child cascades fires its own audit
--    trigger, the parent workspaces row is already gone, and the new
--    audit_logs row's FK check against workspaces(id) fails immediately,
--    aborting the statement. This is exactly what both cleanup migrations
--    above hit and worked around manually, one workspace at a time.
--
-- Fix: stop relying on Postgres's native multi-table cascade ordering
-- entirely. delete_workspace() explicitly deletes every workspace-scoped
-- table, in a documented order that respects each individual FK (RESTRICT
-- dependents before their parents; audit-triggering tables before the
-- workspaces row itself, so their audit inserts succeed against a
-- still-live parent), and only deletes the workspaces row last, once
-- nothing references it anymore. Existing audit_logs rows for this
-- workspace are detached (workspace_id set to NULL -- a column that has
-- always been nullable) rather than deleted, preserving the full
-- historical audit trail -- including the fresh rows this very function's
-- own deletes generate -- even after the workspace itself is gone. No FK's
-- ON DELETE action is changed anywhere by this migration; every constraint
-- remains exactly as strict as it was before it.
--
-- Runs as a single function invocation, which Postgres treats as one atomic
-- unit: any unhandled exception (e.g. the owner check below failing, or any
-- later step failing for an unrelated reason) rolls back every effect up to
-- that point automatically. There is no explicit BEGIN/EXCEPTION block
-- because none is needed for that guarantee, and catching the exception
-- here would only hide a real failure from the caller instead of rolling
-- back cleanly.
CREATE OR REPLACE FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only the workspace's owner may delete the entire workspace -- a much
  -- narrower authorization boundary than is_workspace_member(), which would
  -- let any active staff member destroy the whole business's data.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the workspace owner can delete this workspace'
      USING ERRCODE = '42501';
  END IF;

  -- Join tables / leaves first -- nothing else depends on these, and
  -- deleting them explicitly here (rather than relying on their own
  -- ON DELETE CASCADE) keeps every step in this function independently
  -- documented instead of leaning on cross-table cascade ordering again.
  DELETE FROM public.appointment_services
    WHERE appointment_id IN (SELECT id FROM public.appointments WHERE workspace_id = p_workspace_id);
  DELETE FROM public.client_tags
    WHERE client_id IN (SELECT id FROM public.clients WHERE workspace_id = p_workspace_id);
  DELETE FROM public.revenues WHERE workspace_id = p_workspace_id;
  DELETE FROM public.ai_history WHERE workspace_id = p_workspace_id;
  DELETE FROM public.expenses WHERE workspace_id = p_workspace_id;
  DELETE FROM public.notifications WHERE workspace_id = p_workspace_id;

  -- appointments and visits MUST be deleted before clients: both carry
  -- ON DELETE RESTRICT against clients.id, so clients cannot be removed
  -- while either still references it. Deleting them here -- while the
  -- workspaces row still exists -- also means their AFTER DELETE audit
  -- triggers' INSERT INTO audit_logs succeeds normally, since audit_logs'
  -- own FK to workspaces(id) still has a live row to point at.
  DELETE FROM public.appointments WHERE workspace_id = p_workspace_id;
  DELETE FROM public.visits WHERE workspace_id = p_workspace_id;

  -- services next: appointment_services.service_id is ON DELETE RESTRICT,
  -- but every appointment_services row for this workspace was already
  -- removed in the first step above, so this is now safe.
  DELETE FROM public.services WHERE workspace_id = p_workspace_id;

  -- clients: every RESTRICTing dependent (appointments, visits) and every
  -- dependent this function orders deliberately (client_tags, ai_history)
  -- are already gone.
  DELETE FROM public.clients WHERE workspace_id = p_workspace_id;

  DELETE FROM public.tags WHERE workspace_id = p_workspace_id;
  DELETE FROM public.files WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_settings WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_staff WHERE workspace_id = p_workspace_id;

  -- Detach (not delete) this workspace's audit history -- preserves the
  -- forensic record of everything that happened, including the deletes
  -- just performed above, rather than losing it to workspaces' own
  -- ON DELETE CASCADE on audit_logs.workspace_id when the final delete
  -- below runs. workspace_id on audit_logs has always been nullable.
  UPDATE public.audit_logs SET workspace_id = NULL WHERE workspace_id = p_workspace_id;

  -- Last: nothing references this row anymore, so this is now a plain,
  -- single-row delete with no cascade side effects left to worry about.
  DELETE FROM public.workspaces WHERE id = p_workspace_id;
END;
$$;

ALTER FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "service_role";
