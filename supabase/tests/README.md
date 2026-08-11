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

## Known repository issue: the migration chain cannot bootstrap a fresh database

`supabase/migrations/20260722092124_name_of_your_migration.sql` — the
first migration, chronologically — is an **empty file** (this was already
flagged generically in `docs/PROJECT_ROADMAP.md`'s Risks section: "at
least one migration file was left empty with an unedited default name").
Its practical consequence, confirmed while building this test: replaying
`supabase/migrations/*.sql` in order against a genuinely empty local
database fails partway through (a later migration references a table,
`appointment_services`, that no earlier migration ever created), because
the migration history only ever ran incrementally against the one real,
already-existing linked project — there was never an initial
"create the whole schema" migration.

**This test works around that by applying `schema.sql` (the repository's
own baseline snapshot, regenerated from the live database during the
Phase 12 security review) directly**, instead of relying on
`supabase start`'s automatic migration replay:

```bash
# 1. Start local Supabase with migration auto-apply disabled, so it comes
#    up with an empty database instead of failing partway through the
#    broken chain. In your own LOCAL copy of supabase/config.toml only
#    (see the port caveat above for why not to commit this):
#      [db.migrations]
#      enabled = false
npx supabase start

# 2. Apply the real, current schema directly (tables + RLS policies),
#    bypassing the broken incremental chain:
docker exec -i supabase_db_platform_salma psql -U postgres -d postgres < schema.sql

# 3. Run the test:
npm run test:rls:local
# or directly:
bash scripts/test-rls-local.sh
```

This is not a fix for the empty-migration issue — that's a separate,
pre-existing repository defect (tracked in `docs/PROJECT_ROADMAP.md`'s
Risks section) that this closure pass deliberately did not attempt to fix
unprompted, given its scope (effectively reconstructing an initial-schema
migration) and the project's own documented caution around migration
history changes (`docs/quality/DATABASE_MIGRATION_POLICY.md`).

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
