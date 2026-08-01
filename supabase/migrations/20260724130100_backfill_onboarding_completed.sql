-- Data-only correction, not a schema change: onboarding_completed defaulted
-- to false for every existing row when the column was added, including
-- profiles that already own a workspace (i.e. already completed onboarding
-- in every meaningful sense before this column existed). Without this,
-- those users would get routed into /onboarding by the new Login/Onboarding
-- guards and immediately hit bootstrap_professional_workspace()'s
-- already-completed guard.
UPDATE public.profiles
SET onboarding_completed = true
WHERE id IN (SELECT profile_id FROM public.workspace_staff);
