-- Fixes infinite RLS recursion in is_workspace_member().
--
-- The function was declared LANGUAGE sql STABLE with no SECURITY DEFINER, so it
-- ran with the caller's (authenticated/anon) privileges and was itself subject
-- to RLS. Its body selects from workspace_staff, which has a policy
-- ("workspace_staff_access") that calls is_workspace_member() again — so every
-- invocation re-entered RLS on workspace_staff, called the function again, and
-- recursed until Postgres hit "stack depth limit exceeded". This broke every
-- table whose policy depends on is_workspace_member(): workspaces, clients,
-- appointments, services, tags, visits, expenses, files, revenues,
-- appointment_services, client_tags.
--
-- Fix: mark it SECURITY DEFINER with a pinned search_path (the same pattern
-- already used elsewhere in this schema for handle_new_user,
-- import_service_templates, and rls_auto_enable). Running as the function
-- owner (postgres) means its internal query bypasses RLS instead of
-- re-triggering it. This does not change who can see what — every calling
-- policy still gates on the same membership check, just without recursing.

CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("workspace" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.workspace_staff ws
    WHERE ws.workspace_id = workspace
      AND ws.profile_id = auth.uid()
      AND ws.is_active = true
);
$$;

ALTER FUNCTION "public"."is_workspace_member"("workspace" "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "service_role";
