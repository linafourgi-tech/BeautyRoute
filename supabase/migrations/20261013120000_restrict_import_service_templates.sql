-- S2 (production-readiness audit): import_service_templates() must only add
-- services to a workspace the caller is an active member of.
--
-- Root cause: the function (20260722092124_name_of_your_migration.sql) is
-- SECURITY DEFINER, so its INSERT INTO public.services runs as its owner
-- (postgres) and bypasses the services_access RLS policy
-- (is_workspace_member(workspace_id)) -- but it never checked the caller.
-- EXECUTE is held by PUBLIC, anon and authenticated, so an anonymous caller
-- or any signed-in outsider who knows a workspace id could import template
-- services into it, and its return value revealed whether a service with a
-- given template name already existed there.
--
-- Fix:
--   * Refuse (SQLSTATE 42501) unless public.is_workspace_member(p_workspace_id)
--     -- the same boundary services_access already applies to direct inserts,
--     so the function grants nothing a member couldn't already do. The
--     check runs before any services-table access. is_workspace_member() is
--     false for a NULL auth.uid() (anon), a NULL workspace id, an inactive
--     staff row, and a non-member.
--   * Revoke EXECUTE from PUBLIC and anon. authenticated and service_role keep
--     their explicit EXECUTE grants. (A service_role call carries no member
--     auth.uid(), so it is refused by the check too; nothing calls this
--     function server-side today.)
--
-- Unchanged: the signature, SECURITY DEFINER, the pinned search_path, the
-- return value, and the import/deduplication logic (byte-for-byte the
-- original body after the new check). CREATE OR REPLACE keeps the
-- function's existing owner and ACL, so the two REVOKEs below are the only
-- privilege changes.
CREATE OR REPLACE FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    imported_count INTEGER := 0;
BEGIN

    IF NOT public.is_workspace_member(p_workspace_id) THEN
        RAISE EXCEPTION 'Only an active member of this workspace can import service templates'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.services
    (
        workspace_id,
        name,
        category,
        price,
        duration_minutes,
        description,
        display_order,
        color_hex,
        is_active
    )
    SELECT
        p_workspace_id,
        st.name,
        st.category,
        st.default_price,
        st.default_duration,
        st.description,
        st.display_order,
        st.color_hex,
        TRUE
    FROM public.service_templates st
    WHERE st.id = ANY(p_template_ids)
    AND NOT EXISTS (
        SELECT 1
        FROM public.services s
        WHERE s.workspace_id = p_workspace_id
          AND s.name = st.name
    );

    GET DIAGNOSTICS imported_count = ROW_COUNT;

    RETURN imported_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) FROM "anon";
