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
