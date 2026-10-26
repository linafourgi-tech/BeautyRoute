-- S4 (production-readiness audit): only a workspace's owner may manage its
-- staff list.
--
-- Root cause: the only policy on workspace_staff, "workspace_staff_access"
-- (20260722092124_name_of_your_migration.sql), is FOR ALL with
-- USING (is_workspace_member(workspace_id)) and no separate WITH CHECK, so
-- any active member could insert, update, or delete any staff row of their
-- workspace: add an outsider as a member, reactivate a deactivated
-- colleague, change commissions, or delete/deactivate the owner's own row --
-- locking the owner out of their workspace's data (is_workspace_member()
-- reads exactly these rows), with no way for the owner to re-add themselves.
--
-- Fix:
--   * is_workspace_owner(workspace): true when workspaces.owner_id is the
--     caller (auth.uid()). SECURITY DEFINER (pinned search_path) so it reads
--     workspaces without RLS -- it keeps working even when the owner's own
--     staff row is missing -- and it only ever answers about the caller.
--     EXECUTE for authenticated and service_role only.
--   * The FOR ALL policy is replaced by four least-privilege policies for
--     authenticated (anon gets none, so it is denied by default):
--       SELECT -- active members (unchanged boundary);
--       INSERT, UPDATE, DELETE -- the workspace owner only.
--   * The owner's own row is protected: the owner cannot delete it, and
--     cannot insert or update it as inactive. Every write policy already
--     requires auth.uid() to be the owner, so profile_id = auth.uid()
--     identifies exactly the owner's own row.
--   * Column-level UPDATE: authenticated may update only is_active and
--     base_commission_pct. workspace_id, profile_id, id, and joined_at are no
--     longer client-updatable, so a row cannot be moved to another workspace
--     or re-pointed at another profile (which would otherwise let the
--     owner's row be reassigned away instead of deactivated). anon keeps no
--     UPDATE privilege at all.
--
-- Unaffected by design: bootstrap_professional_workspace() and
-- delete_workspace() (SECURITY DEFINER, owner postgres), service_role, and
-- the application -- no client code writes workspace_staff today.
CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("workspace" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = workspace
      AND w.owner_id = auth.uid()
);
$$;

ALTER FUNCTION "public"."is_workspace_owner"("workspace" "uuid") OWNER TO "postgres";

-- New functions in public get EXECUTE for PUBLIC and, through this schema's
-- default privileges, anon; remove both before granting the two roles that
-- need it.
REVOKE ALL ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."is_workspace_owner"("workspace" "uuid") TO "service_role";

DROP POLICY IF EXISTS "workspace_staff_access" ON "public"."workspace_staff";

CREATE POLICY "workspace_staff_select_members" ON "public"."workspace_staff"
    FOR SELECT TO "authenticated"
    USING ("public"."is_workspace_member"("workspace_id"));

CREATE POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff"
    FOR INSERT TO "authenticated"
    WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()));

CREATE POLICY "workspace_staff_update_owner" ON "public"."workspace_staff"
    FOR UPDATE TO "authenticated"
    USING ("public"."is_workspace_owner"("workspace_id"))
    WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()));

CREATE POLICY "workspace_staff_delete_owner" ON "public"."workspace_staff"
    FOR DELETE TO "authenticated"
    USING ("public"."is_workspace_owner"("workspace_id") AND "profile_id" <> "auth"."uid"());

REVOKE UPDATE ON TABLE "public"."workspace_staff" FROM "authenticated";
REVOKE UPDATE ON TABLE "public"."workspace_staff" FROM "anon";
GRANT UPDATE ("is_active", "base_commission_pct") ON TABLE "public"."workspace_staff" TO "authenticated";
