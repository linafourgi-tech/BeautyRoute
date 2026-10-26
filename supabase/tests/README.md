# RLS integration tests — LOCAL ONLY

Real Postgres/RLS integration tests, run against a real local Supabase
Postgres instance via Docker. **Never** run these against the shared/linked
production Supabase project — `scripts/test-rls-local.sh` refuses to run
unless it can reach a Supabase Postgres container actually running on this
machine (see that script's own safety comment for exactly why this is a
structural guarantee, not just a check).

## What's here

- `rls_workspace_isolation.sql` — proves the real `clients_access` RLS
  policy (`public.is_workspace_member()`, defined in `schema.sql`) actually
  enforces workspace isolation: a user who is only a member of Workspace A
  can read Workspace A's own client data, and cannot read Workspace B's,
  even though both rows exist in the same table. Self-contained: creates
  its own two fake users/workspaces/clients inside one transaction, then
  unconditionally `ROLLBACK`s at the end — nothing persists, safe to run
  repeatedly, no separate cleanup step.
- `workspace_protected_columns.sql` — proves the S1 fix
  (`20261011120000_restrict_workspace_protected_columns.sql`): an
  authenticated member is refused (`42501`) when updating `plan_tier`,
  `subscription_status`, `trial_ends_at`, `trial_started_at`, `owner_id`,
  `id`, `slug`, or `created_at` — including mixed updates and the
  `ON CONFLICT DO UPDATE` upsert path — while the 8 allowed columns still
  update; a non-member affects 0 rows; `anon` is refused; `service_role`
  can still change plan fields; and onboarding
  (`bootstrap_professional_workspace()`) still creates a trial workspace.
  Same self-contained, always-`ROLLBACK` pattern.
- `workspace_direct_delete.sql` — proves the S1-b fix
  (`20261012120000_restrict_workspace_direct_delete.sql`): the owner, a
  non-owner member, an outsider, and `anon` are all refused (`42501`) for a
  direct `DELETE` on `workspaces` — including an "emptied" workspace whose
  direct deletion would otherwise cascade away its audit logs; a non-owner
  and `anon` are refused by `delete_workspace()`'s owner check; the owner's
  `delete_workspace()` removes the workspace and its data while preserving
  every audit row (`workspace_id` set to `NULL`); `service_role` can still
  delete directly; and the RLS policy, the 13 `ON DELETE CASCADE` foreign
  keys, and the S1 grants are unchanged. Same always-`ROLLBACK` pattern.
- `workspace_deletion_flow.sql` — proves the authorized deletion flow,
  `delete_workspace()` (`20260803120000_safe_workspace_deletion.sql`),
  against a workspace seeded with a row in every table it clears: a
  non-owner member, the owner of a different workspace, `anon`, and the
  owner with a nonexistent or `NULL` id are all refused (`42501`) with every
  row of the test workspaces (and their audit history) left byte-for-byte
  unchanged; a failure forced partway through (a test-only trigger) rolls
  back the whole call; the owner's deletion removes all child rows,
  preserves every audit row with `workspace_id` `NULL`, and leaves
  profiles and a separate workspace untouched; an emptied workspace can be
  deleted; the owner can re-onboard afterwards; and the function, its
  grants, and the S1 / S1-b privileges are unchanged. Same
  always-`ROLLBACK` pattern — the test-only trigger and helpers never
  persist.
- `service_template_import.sql` — proves the S2 fix
  (`20261013120000_restrict_import_service_templates.sql`): an active
  member can import templates into their workspace (audited with the
  member as actor; deduplication by name unchanged); the owner of another
  workspace, an inactive staff member, `anon` (at the `EXECUTE` privilege),
  a member passing a `NULL` id, and a `service_role` call without a
  member's `auth.uid()` are all refused (`42501`) with the victim
  workspace's services and audit history left byte-for-byte unchanged;
  onboarding (bootstrap, then import) still works; and `EXECUTE` is held
  by `authenticated` and `service_role` only, not `anon` or `PUBLIC`.
  Same always-`ROLLBACK` pattern.
- `storage_objects_access.sql` — proves the S3 Phase 1 fix
  (`20261014120000_restrict_storage_objects.sql`): in each of the six
  private buckets (`avatars`, `client-photos`, `before-after`, `documents`,
  `receipts`, `ai-uploads`), an authenticated member (even the recorded
  owner, in their own workspace's path), an authenticated outsider, and
  `anon` cannot read, upload, update, or delete objects, with every object
  left byte-for-byte unchanged; `service_role` can still do all four; row
  level security stays enabled; and no `storage.objects` policy applies to
  `authenticated`, `anon`, or `PUBLIC`. The buckets and objects are
  synthetic rows created inside the transaction (the local stack defines
  no buckets). Direct SQL deletes are blocked by Storage's own
  `protect_delete` trigger unless `storage.allow_delete_query` is `true`
  (what the Storage API sets), so the test sets it transaction-locally to
  exercise the row-level-security path. It tests the PostgreSQL row level
  security on `storage.objects` directly, as the Storage API's database
  role would see it; it does not exercise the Storage HTTP API (uploads,
  downloads, signed URLs) end-to-end. Same always-`ROLLBACK` pattern.
- `workspace_staff_management.sql` — proves the S4 fix
  (`20261015120000_restrict_workspace_staff_management.sql`): active
  members can read their workspace's staff list; a non-owner member
  cannot add an outsider, delete or deactivate the owner, reactivate a
  deactivated colleague, change commissions, or re-point a row; outsiders
  and `anon` can neither read nor manage it (each refused attempt leaves
  the staff rows byte-for-byte unchanged); the owner can add, update,
  deactivate, reactivate, and remove other staff but cannot delete or
  deactivate their own row or move a row to another workspace; an owner
  whose own staff row is missing can re-add it (active only); onboarding
  and `delete_workspace()` still work; and the policies,
  `is_workspace_owner()`, and the column-level `UPDATE` grants are exactly
  as reviewed. Same always-`ROLLBACK` pattern.

`workspace_deletion_flow.sql`, `service_template_import.sql`,
`storage_objects_access.sql`, and `workspace_staff_management.sql` start
with a local-only guard: they refuse to run unless the session setting
`beautyroute.local_rls_test` is `on`, which only the runner sets.

All seven run via `npm run test:rls:local`. After an approved production
deployment, `scripts/verify-workspace-protected-columns.sql`,
`scripts/verify-workspace-direct-delete.sql`,
`scripts/verify-import-service-templates.sql`,
`scripts/verify-storage-objects-policies.sql`, and
`scripts/verify-workspace-staff-management.sql` are the matching
**read-only** checks of the deployed privileges and policies (see their
headers for how to run them).

## Prerequisites

- Docker Desktop installed and running (`docker info` succeeds).
- Supabase CLI (already an npm dev dependency — `npx supabase ...`).

## Known Windows caveat: local Supabase's default ports may be unusable

Windows/Hyper-V reserves dynamic TCP port-exclusion ranges that can overlap
Supabase's default local ports (`54320`–`54329`, from
`supabase/config.toml`). If `supabase start` fails with something like
`bind: An attempt was made to access a socket in a way forbidden by its
access permissions`, check:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

If `54320`–`54329` falls inside a listed range, **do not edit the committed
`supabase/config.toml`** to work around this — that file is shared by every
contributor and most won't hit this. Instead, temporarily edit your own
local copy to a port block outside every excluded range (e.g. shift to
`55320`–`55329`), run `supabase start`, do your local testing, then run
`git checkout -- supabase/config.toml` to discard the local-only edit
before committing anything.

## Setup

```bash
npx supabase start
npm run test:rls:local
```

That's it — `supabase start` now bootstraps a fresh local database
correctly (fixed during the Phase 14 migration-bootstrap pass; see
"Migration-bootstrap history" below if you're curious what was wrong and
how it was verified fixed). No manual `schema.sql` application step is
needed anymore.

## Running

```bash
npm run test:rls:local
```

Not part of CI — CI (`.github/workflows/ci.yml`) has no local Postgres/
Docker environment provisioned, and per this project's own security
posture (see `.github/workflows/ci.yml`'s own header comment: "no Supabase
production linking... nothing here ever reaches a real Supabase... endpoint"),
adding one was explicitly out of scope for this pass. This test is
locally reproducible and real; it is not wired into CI.

## Migration-bootstrap history (fixed)

Earlier in Phase 14, `supabase start`'s automatic migration replay failed
against a genuinely fresh/empty database — `supabase/migrations/20260722092124_name_of_your_migration.sql`,
the first migration chronologically, was an empty file, so no earlier
migration ever created the base schema a later one
(`20260724100000_add_missing_rls_policies.sql`) assumed already existed.
A deeper audit (the migration-bootstrap fix pass) found the same class of
problem in three more migrations, each referencing a specific profile
(`e59f77cf-...`) that only exists as real data on the linked production
project: `20260724110000_seed_dev_workspace_membership.sql`,
`20260725100000_phase9_test_second_workspace.sql`, and
`20260725150000_phase11_verification_workspaces.sql`.

**Both problems are now fixed:**

- The empty first migration now contains a reconstructed initial baseline
  schema (derived by reversing, via real DDL against a real local
  Postgres instance, exactly the deltas that later migrations
  reintroduce — not hand-typed/guessed).
- The three profile-dependent migrations are now guarded
  (`WHERE EXISTS (...)` / `IF EXISTS (...)`) so they cleanly no-op on an
  environment where that profile doesn't exist, with **zero behavior
  change** on the real linked project (the profile exists there, so the
  guard condition is always true and the insert proceeds exactly as
  before).

Verified: a completely fresh local database (destroyed Docker volume,
`supabase start` from zero) now applies all 15 migrations with zero
errors, and the resulting schema is **byte-for-byte identical** (`diff`,
exit code 0) to applying `schema.sql` directly, compared via
`supabase db dump --local --schema public` on both. This test
(`rls_workspace_isolation.sql`) passes against that genuinely
migration-built database, not just against a `schema.sql`-direct-apply
workaround.
