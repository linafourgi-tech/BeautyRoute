-- Phase 5: professional onboarding.
--
-- Adds the minimum schema needed for a newly signed-up professional to
-- complete onboarding: a business_type on workspaces (no prior column could
-- hold it), an onboarding_completed flag on profiles, and trial-period
-- bookkeeping on workspaces (subscription_status/trial_started_at/
-- trial_ends_at). None of this implements billing/Stripe/payment
-- enforcement -- it only records that a trial window exists and when it
-- started/ends, for a later phase to act on.
--
-- Also adds bootstrap_professional_workspace(), a SECURITY DEFINER function
-- mirroring the existing pattern used by import_service_templates() and
-- is_workspace_member(): a new professional cannot INSERT their own first
-- workspaces/workspace_staff row through the normal authenticated client,
-- because workspace_access/workspace_staff_access both gate INSERT via
-- is_workspace_member(), which is necessarily false for a workspace that
-- doesn't exist yet. This function does the one-time bootstrap insert as the
-- table owner, guarded so it can only ever run once per profile, and is
-- responsible for all three things onboarding completion means at once:
-- creating the workspace, marking the profile as onboarded, and starting the
-- trial clock.

ALTER TABLE "public"."workspaces"
  ADD COLUMN "business_type" "text"
  CHECK ("business_type" IN ('freelancer', 'salon'));

ALTER TABLE "public"."profiles"
  ADD COLUMN "onboarding_completed" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."workspaces"
  ADD COLUMN "trial_started_at" timestamp with time zone;

ALTER TABLE "public"."workspaces"
  ADD COLUMN "trial_ends_at" timestamp with time zone;

ALTER TABLE "public"."workspaces"
  ADD COLUMN "subscription_status" "text" NOT NULL DEFAULT 'trial'
  CHECK ("subscription_status" IN ('trial', 'active', 'past_due', 'cancelled', 'expired'));

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
  IF EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = auth.uid()) THEN
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

ALTER FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "service_role";
