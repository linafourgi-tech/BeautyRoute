-- Test scaffolding only, for verifying Phase 11's server-side AI plan gate
-- and cross-workspace isolation live (real workspaces + real distinct data,
-- not mocked). Not a schema change -- inserts rows using existing tables.
-- Same pattern as the Phase 9 second-test-workspace migration. Removed by a
-- follow-up cleanup migration once verification is done.
--
-- ws_gate  (Starter plan): the dev user IS an active member, but the plan
--   does not include the "ai" feature -- proves the Edge Function rejects
--   with feature_not_available rather than trusting the frontend gate.
-- ws_isolation (Studio plan): the dev user IS an active member, plan DOES
--   include "ai" -- used to prove the assistant never surfaces this
--   workspace's data when queried from a different workspace (or vice versa).

-- Guarded (added during the Phase 14 migration-bootstrap fix): owner_id
-- below only exists as a real profile on the one real, linked Supabase
-- project. On a fresh/local database it doesn't exist, and these INSERTs
-- would otherwise abort the whole migration replay with a foreign key
-- violation. Wrapping in `IF EXISTS(...)` makes that case a clean no-op
-- instead of an error. Behavior on the real project is byte-for-byte
-- unchanged: the profile exists there, so the condition is true and
-- every insert below proceeds exactly as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4') THEN
    INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand, plan_tier)
    VALUES (
      'c11c11c1-1111-4111-8111-111111111111',
      'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4',
      'P11 Verify Gate WS (Starter)',
      'p11-verify-gate-ws',
      'P11 Verify Gate',
      'Starter'
    );

    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('c11c11c1-1111-4111-8111-111111111111', 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4', true);

    INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand, plan_tier)
    VALUES (
      'c22c22c2-2222-4222-8222-222222222222',
      'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4',
      'P11 Verify Isolation WS (Studio)',
      'p11-verify-isolation-ws',
      'P11 Verify Isolation',
      'Studio'
    );

    INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
    VALUES ('c22c22c2-2222-4222-8222-222222222222', 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4', true);

    INSERT INTO public.clients (workspace_id, full_name, allergies)
    VALUES ('c22c22c2-2222-4222-8222-222222222222', 'Only In Isolation Workspace — Zahra Verify', ARRAY['SecretIngredientX-only-in-isolation-ws']);
  END IF;
END $$;
