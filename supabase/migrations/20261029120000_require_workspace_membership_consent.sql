-- Workspace membership requires the member's consent (security review of
-- workspace membership, 2026-10-29).
--
-- Root causes:
--   * "workspace_staff_insert_owner" (20261015120000_restrict_workspace_staff_management.sql)
--     lets a workspace owner insert a staff row for ANY existing profile_id.
--     That user becomes an active member without being asked -- and every
--     signed-up user can become an owner through onboarding.
--   * Every write policy on workspace_staff is owner-only, so a member who
--     was added (with or without consent) has no way to leave.
--   * bootstrap_professional_workspace() refuses anyone with ANY
--     workspace_staff row (active or not), so an unwanted -- or even a
--     deactivated -- membership permanently blocks that user from creating
--     their own workspace.
--   * PUBLIC (and so anon) can EXECUTE bootstrap_professional_workspace().
--
-- Fix (no invitation system yet -- adding another user waits for a future
-- consent-based invitation flow):
--   1. INSERT: an owner may insert only their OWN row, and only as active
--      (the existing lockout-recovery path). Nobody can add another profile
--      from the client. bootstrap_professional_workspace() and
--      delete_workspace() are SECURITY DEFINER and unaffected.
--   2. DELETE: new "workspace_staff_delete_self" lets a member remove their
--      own row (leave) unless they own the workspace. Permissive policies are
--      OR-ed, so the owner keeps removing other staff through
--      "workspace_staff_delete_owner"; this policy adds only the caller's own
--      non-owner row. A member who leaves has no row left, and (1) stops the
--      owner from re-adding them.
--      SELECT: new "workspace_staff_select_own" lets a user see their OWN
--      staff rows, active or inactive. Postgres applies SELECT policies to a
--      DELETE that filters on the table's columns, and the member policy
--      (is_workspace_member(), active members only) hides a deactivated
--      member's own row -- without this, a deactivated member could not
--      leave. It exposes no other member's row and no workspace data:
--      is_workspace_member() and every other table's policies are unchanged.
--   3. Onboarding refuses only a user who already OWNS a workspace, so
--      active or deactivated staff of another workspace can create their own.
--      The rest of the function is unchanged (body, SECURITY DEFINER, pinned
--      search_path, owner, and the authenticated/service_role grants --
--      CREATE OR REPLACE keeps the owner and privileges).
--   4. EXECUTE on bootstrap_professional_workspace() is revoked from PUBLIC
--      and anon. authenticated and service_role keep their explicit grants.
--
-- Unchanged: the member SELECT policy, the UPDATE policy, the column-level UPDATE grant
-- (is_active, base_commission_pct), owner-controlled deactivation and
-- reactivation of existing rows, is_workspace_owner(), is_workspace_member(),
-- delete_workspace(), and every existing row (no data change).

ALTER POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff"
    WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND "profile_id" = "auth"."uid"() AND "is_active");

CREATE POLICY "workspace_staff_delete_self" ON "public"."workspace_staff"
    FOR DELETE TO "authenticated"
    USING ("profile_id" = "auth"."uid"() AND NOT "public"."is_workspace_owner"("workspace_id"));

CREATE POLICY "workspace_staff_select_own" ON "public"."workspace_staff"
    FOR SELECT TO "authenticated"
    USING ("profile_id" = "auth"."uid"());

CREATE OR REPLACE FUNCTION "public"."bootstrap_professional_workspace"(
    "p_business_name" "text",
    "p_business_type" "text",
    "p_city" "text"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_slug text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Onboarding already completed for this user';
  END IF;

  v_slug := lower(regexp_replace(p_business_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.workspaces
    (owner_id, name, slug, display_brand, city, business_type,
     subscription_status, trial_started_at, trial_ends_at)
  VALUES
    (auth.uid(), p_business_name, v_slug, p_business_name, p_city, p_business_type,
     'trial', now(), now() + interval '7 days')
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
  VALUES (v_workspace_id, auth.uid(), true);

  INSERT INTO public.workspace_settings (workspace_id)
  VALUES (v_workspace_id);

  UPDATE public.profiles SET onboarding_completed = true WHERE id = auth.uid();

  RETURN v_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") FROM "anon";
