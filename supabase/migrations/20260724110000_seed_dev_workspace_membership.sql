-- Dev-only bootstrap: links the seeded dev auth user (created directly in
-- Supabase Studio, profile id confirmed to exist below) to the existing
-- "BeautyRoute Demo" workspace, so auth.uid() satisfies is_workspace_member()
-- during local development. No new workspace is created — one already exists
-- (3c26322e-d230-423a-b3de-2d4fd64a7c9e), owned by profile
-- f6c66ce9-760f-4032-9519-ffee5fe92677, with its own workspace_staff row
-- already in place; this just adds a second member for the dev session.

-- Guarded (added during the Phase 14 migration-bootstrap fix): this
-- workspace/profile pair only exists on the one real, linked Supabase
-- project -- on a fresh/local database neither row exists, and this
-- INSERT would otherwise abort the whole migration replay with a foreign
-- key violation. INSERT ... SELECT ... WHERE EXISTS makes that case a
-- clean zero-row no-op instead of an error. Behavior on the real project
-- is byte-for-byte unchanged: both rows exist there, so the WHERE EXISTS
-- conditions are true and the insert proceeds exactly as before.
INSERT INTO "public"."workspace_staff"
  ("workspace_id", "profile_id", "is_active")
SELECT '3c26322e-d230-423a-b3de-2d4fd64a7c9e', 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4', true
WHERE EXISTS (SELECT 1 FROM "public"."workspaces" WHERE "id" = '3c26322e-d230-423a-b3de-2d4fd64a7c9e')
  AND EXISTS (SELECT 1 FROM "public"."profiles" WHERE "id" = 'e59f77cf-4cf1-4ae6-b87b-7f2932fe6ca4')
ON CONFLICT ("workspace_id", "profile_id") DO NOTHING;
