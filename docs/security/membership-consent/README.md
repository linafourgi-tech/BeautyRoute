# Workspace membership consent — operational runbooks

The migration
`supabase/migrations/20261029120000_require_workspace_membership_consent.sql`
makes workspace membership consent-based. It is **not yet deployed**.

These files are **manual, approval-gated procedures**. Nothing runs them
automatically, and they must stay outside `supabase/migrations/`.

## What the migration changes

| Object | Before (S4) | After |
| --- | --- | --- |
| `workspace_staff_insert_owner` (INSERT) | an owner can insert a row for **any** existing user | an owner can insert only their **own** active row (lockout recovery); nobody can add another user |
| `workspace_staff_delete_self` (DELETE, new) | — | a non-owner member can delete their own row (leave) |
| `workspace_staff_select_own` (SELECT, new) | — | a user can see their own rows, active or inactive (needed so a deactivated member can leave); no other member's row, no workspace data |
| `bootstrap_professional_workspace()` | refuses anyone with any staff row | refuses only users who already own a workspace; otherwise byte-identical |
| EXECUTE on `bootstrap_professional_workspace()` | PUBLIC, `anon`, `authenticated`, `service_role` | `authenticated` and `service_role` only |

Unchanged: the member SELECT policy, the owner UPDATE and DELETE policies,
the column-level UPDATE grant (`is_active`, `base_commission_pct`),
owner-controlled deactivation and reactivation, `is_workspace_owner()`,
`is_workspace_member()`, `delete_workspace()`, and every existing row.

## Files

| File | Purpose | Limitations |
| --- | --- | --- |
| `production-precheck.sql` | Read-only check that the database is in the **pre-migration** state (8 checks), plus 2 informational aggregate counts of existing non-owner memberships. | While the migration is deployed it shows **4 failed checks by design**, which is not a deployment failure. The counts cannot tell whether an existing membership was consensual. |
| `forward-rollback.sql` | **Emergency only.** Restores the S4 state in one transaction with `lock_timeout = 5s`: the same policies, the byte-identical original function, and the same EXECUTE grantees (the internal order of the function's ACL entries may differ, which does not affect access). No data change. | Reviewed against `main` at `2f429f6` plus this migration. It is stale if any later migration changes these policies or this function: review it again first. |

## Deploy procedure (each step separately approved)

1. Verify the target project and environment.
2. Run the pre-check:
   `npx supabase db query --linked -f docs/security/membership-consent/production-precheck.sql`.
   Every check row must show `passed = true`. Review the two informational
   counts.
3. Dry run (`npx supabase db push --linked --dry-run`): it must list only
   `20261029120000_require_workspace_membership_consent.sql`.
4. Apply, then verify with `scripts/verify-workspace-staff-management.sql`:
   it must show **28/28**.

## Rollback procedure

This is an **emergency procedure**. Every step needs explicit approval, and
running the rollback needs its own, separate explicit approval.

1. **Verify the target before running anything:** the project (ref/host)
   and the environment (production or local). Confirm the deployed state
   (`scripts/verify-workspace-staff-management.sql` shows 28/28) and that no
   later migration touched these objects.
2. **Get explicit approval**, then run the rollback as one unit with `psql`:

   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/security/membership-consent/forward-rollback.sql
   ```

   - Supply `DATABASE_URL` securely at execution time. The connection
     string must **never** be committed, logged, or written into
     documentation or any file.
   - The file is one transaction. With `ON_ERROR_STOP=1`, psql stops at the
     first error (including a lock not obtained within 5s) and exits
     non-zero, and the transaction is rolled back: nothing changes. Retry at
     a quieter time.
   - Do **not** use `supabase db query -f` for this file: it rejects
     multi-statement files.
   - Validated against a local database only: the same statements inside a
     transaction that ended in `ROLLBACK`, and this exact command's
     lock-timeout failure path. Its successful `COMMIT` path has **not**
     been tested end to end. It has **never** been run against production.
3. **Verify after the rollback:** `production-precheck.sql` **must show every
   check row passed**, and `scripts/verify-workspace-staff-management.sql`
   shows exactly 7 failed rows by design. Successful execution of the
   rollback alone is not sufficient.

## Warnings

- The rollback **intentionally reopens non-consensual membership**: owners
  can again add any existing user without consent. Members can no longer
  leave, and onboarding again refuses anyone with any staff row.
- The rollback **restores EXECUTE on `bootstrap_professional_workspace()`
  for PUBLIC and `anon`** (the pre-migration grantees). Keeping them
  revoked would be a separate, separately approved change.
- Afterwards the migration history still lists `20261029120000` as applied.
  History and database stay diverged until an approved recovery plan
  reconciles them.
- **Never** run the rollback automatically, and **never** place it in
  `supabase/migrations/`. Turning it into a migration deliberately fails the
  consent structural test's regression guard, and the transaction statements
  would need to be reconsidered (see the file header).
