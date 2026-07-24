-- Dev-only bootstrap: links the seeded dev auth user (created directly in
-- Supabase Studio, profile id confirmed to exist below) to the existing
-- "BeautyRoute Demo" workspace, so auth.uid() satisfies is_workspace_member()
-- during local development. No new workspace is created — one already exists
-- (3c26322e-d230-423a-b3de-2d4fd64a7c9e), owned by profile
-- f6c66ce9-760f-4032-9519-ffee5fe92677, with its own workspace_staff row
-- already in place; this just adds a second member for the dev session.

INSERT INTO "public"."workspace_staff"
  ("workspace_id", "profile_id", "is_active")
VALUES
  ('3c26322e-d230-423a-b3de-2d4fd64a7c9e', 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4', true)
ON CONFLICT ("workspace_id", "profile_id") DO NOTHING;
