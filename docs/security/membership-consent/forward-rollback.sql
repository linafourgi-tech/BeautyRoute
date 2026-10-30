-- EMERGENCY PROCEDURE -- forward rollback of the workspace-membership
-- consent migration.
-- DO NOT RUN without explicit approval. Never run it automatically, and never
-- place it in supabase/migrations/.
--
-- Reverts supabase/migrations/20261029120000_require_workspace_membership_consent.sql
-- to the pre-migration (S4) state:
--   * the INSERT policy "workspace_staff_insert_owner" gets back its S4 check
--     (20261015120000_restrict_workspace_staff_management.sql);
--   * the policies "workspace_staff_delete_self" and "workspace_staff_select_own"
--     are dropped;
--   * bootstrap_professional_workspace() gets back its original definition
--     (20260724130000_professional_onboarding.sql) -- CREATE OR REPLACE keeps
--     its owner (postgres) and the authenticated/service_role grants;
--   * EXECUTE on it is granted back to PUBLIC and anon, as before (the same
--     grantees; re-granted entries are appended, so the internal order of
--     the function's ACL entries may differ -- that does not affect access).
-- No data change: no INSERT, UPDATE, or DELETE. Rows written under the
-- migration stay as they are (e.g. memberships removed by members who left,
-- workspaces created by staff through onboarding).
--
-- Intentional consequences:
--   * It REOPENS non-consensual membership: an owner can again add any
--     existing user to their workspace without that user's consent.
--   * Members can no longer leave (owner-only DELETE again), and a
--     deactivated member can no longer see their own row.
--   * Onboarding again refuses anyone with any staff row (active or not).
--   * It RESTORES EXECUTE on bootstrap_professional_workspace() for PUBLIC and
--     anon. Those are the pre-migration grantees; keeping anon/PUBLIC revoked
--     would be a separate, separately approved change (this file does not
--     make it).
--   * The migration history still lists 20261029120000 as applied while its
--     objects are gone. History and database stay diverged until an approved
--     recovery plan reconciles them.
--
-- Reviewed against the working tree on main at 2f429f6 plus this migration,
-- where 20261029120000 is the last migration that changes these policies and
-- this function. If any later migration changes them, this script is stale:
-- review it again before use.
--
-- Prerequisites (each needs explicit approval; running this file needs its
-- own, separate explicit approval):
--   1. Verify the target before running anything: the project (ref/host in
--      the connection string) and the environment (production or local).
--   2. Confirm the deployed state: scripts/verify-workspace-staff-management.sql
--      shows 28/28, and no later migration touched these objects.
--   3. Run this whole file as one unit with psql:
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/security/membership-consent/forward-rollback.sql
--      Supply DATABASE_URL securely at execution time. The connection string
--      must never be committed, logged, or written into documentation or
--      any file. Do NOT use `supabase db query -f` for this file: it sends
--      the file as one prepared statement and rejects multi-statement files.
--      The file is a single transaction. With ON_ERROR_STOP=1, psql stops at
--      the first error and exits non-zero, and the open transaction is rolled
--      back: nothing changes. A table lock not obtained within lock_timeout
--      (5s) is such an error -- retry at a quieter time.
--      Validated against a local database only: the same statements inside a
--      transaction that ended in ROLLBACK, and this exact command's
--      lock-timeout failure path. Its successful COMMIT path has NOT been
--      tested end to end, and it has never been run against production.
--   4. Post-rollback verification: production-precheck.sql MUST show every
--      check row passed = true, and scripts/verify-workspace-staff-management.sql
--      shows exactly 7 failed rows by design (six-policy set, INSERT,
--      self-leave, own-row SELECT, onboarding guard, anon and PUBLIC EXECUTE).
--      Successful execution of this file alone is not sufficient evidence.
--
-- If it is ever converted into a migration (a NEW timestamped file; never
-- edit 20261029120000): reconsider the BEGIN / SET LOCAL / COMMIT statements,
-- since the migration runner manages its own transaction. Such a migration
-- INTENTIONALLY fails the consent structural test
-- (20261029120000_require_workspace_membership_consent.test.ts): its
-- "REGRESSION: no migration at or after this one re-opens adding members
-- without consent" test flags the S4 INSERT check, the dropped self-leave
-- policy, the old onboarding guard, and the anon/PUBLIC grants. That is the
-- guard working; the same PR must withdraw the consent structural test, RLS
-- tests, and verification-script checks with explicit review.

-- Transaction wrapper (reconsider if this file becomes a migration; see above).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER POLICY "workspace_staff_insert_owner" ON "public"."workspace_staff"
    WITH CHECK ("public"."is_workspace_owner"("workspace_id") AND ("is_active" OR "profile_id" <> "auth"."uid"()));

DROP POLICY IF EXISTS "workspace_staff_select_own" ON "public"."workspace_staff";
DROP POLICY IF EXISTS "workspace_staff_delete_self" ON "public"."workspace_staff";

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

GRANT EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."bootstrap_professional_workspace"("text", "text", "text") TO "anon";

COMMIT;
