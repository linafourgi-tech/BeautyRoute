# S5 operational runbooks — cross-workspace references

S5 is migration
`supabase/migrations/20261026120000_prevent_cross_workspace_references.sql`
(PR #31). It was deployed to production on 2026-10-28 and verified with
`scripts/verify-cross-workspace-references.sql` (20/20).

These files are **manual, approval-gated procedures**. Nothing runs them
automatically, and they must stay outside `supabase/migrations/`.

| File | Purpose | Limitations |
| --- | --- | --- |
| `production-precheck.sql` | Read-only check that the database is in the **pre-S5** state (8 checks, aggregate counts only). | While S5 is deployed it shows **5/8 by design**, which is not a deployment failure. It does not compare the USING expressions of the two link-table policies (`appointment_services_access`, `client_tags_access`). |
| `forward-rollback.sql` | **Emergency only.** Removes S5's 13 triggers and 13 functions and restores the 11 pre-S5 `*_access` policies, in one transaction with `lock_timeout = 5s`. No data change. | Reviewed against `main` at `d19cd2e`. It is stale if any later migration changes these policies, functions, or triggers: review it again first. |

## Rollback procedure

This is an **emergency procedure**. Every step needs explicit approval, and
running the rollback needs its own, separate explicit approval.

1. **Verify the target before running anything:** the project (ref/host)
   and the environment (production or local). Then inspect the current
   state: the migration history, and whether any migration after
   `20261026120000` touched the affected objects.
2. **Run the pre-check:** `npx supabase db query --linked -f docs/security/s5/production-precheck.sql`.
   On the deployed S5 state it shows 5/8.
3. **Get explicit approval**, then run the rollback as one unit with `psql`:

   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/security/s5/forward-rollback.sql
   ```

   - Supply `DATABASE_URL` securely at execution time. The connection
     string must **never** be committed, logged, or written into
     documentation or any file.
   - The file is one transaction. With `ON_ERROR_STOP=1`, psql stops at the
     first error (including a lock not obtained within 5s) and exits
     non-zero, and the transaction is rolled back: nothing changes.
   - Do **not** use `supabase db query -f` for this file: it rejects
     multi-statement files.
   - This command has been validated against a local database only, and
     only its failure path end to end (a lock timeout: exit code 3, nothing
     changed). Its successful `COMMIT` path has **not** been tested end to
     end: the same statements were tested locally inside a transaction that
     ended in `ROLLBACK`. It has **never** been run against production.
4. **Run the pre-check again.** It **must show 8/8.** Successful execution
   of the rollback alone is not sufficient.

## Warnings

- The rollback **intentionally reopens the cross-workspace-reference
  vulnerability** that S5 fixed.
- Afterwards the migration history still lists `20261026120000` as applied.
  History and database stay diverged until an approved recovery plan
  reconciles them.
- **Never** run the rollback automatically, and **never** place it in
  `supabase/migrations/`. Turning it into a migration deliberately fails the
  S5 structural test's regression guards, and the transaction statements
  would need to be reconsidered (see the file header).
