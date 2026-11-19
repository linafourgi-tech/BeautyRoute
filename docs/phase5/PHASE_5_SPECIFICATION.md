# BeautyRoute — Phase 5 Specification: Appointment System

**Status:** Revision 11d, awaiting owner approval. Revision 10 was approved at
SHA-256 `d8404f600c4d17934724012867aa084c6b42ffa999812a7514c5d7712c9908a7`. Not
implemented. The product decisions it records (Section 2) are approved. **This
is the single authoritative Phase 5 specification.** It supersedes every
earlier draft of the plan. Nothing here is implemented until each PR in
Section 12 is separately approved.

**Revision 11d:** the revision 11c candidate with two corrections from the
final verification. No product decision, security boundary, PR scope or
dependency changed.

- **F1 (3.1 invariant 2):** removes the inaccurate claim that exactly six
  existing SECURITY DEFINER functions deviate. Existing functions aren't
  held to the list; those failing C5 are in its register, and their other
  grants are pinned by the inventory (C2).
- **F2 (3.4, C5 register):** Part B `public_grants` is authoritative for
  PUBLIC EXECUTE; `acl_is_default = false` is the expected, still unverified
  state.

**Revision 11c:** the revision 11b candidate with C5 made self-contained. No
product decision, other security boundary, PR scope or dependency changed.

- **C5 exception register (3.4):** exactly six existing SECURITY DEFINER
  functions, each with its exact signature, conditions, reason and evidence.
  `anon_explicit` and `public_default` are separate conditions, checked
  independently. Expected PUBLIC privileges are marked as expected, to be
  confirmed by the authorized database pre-checks.
- **3.1 invariant 2** applies strictly to SECURITY DEFINER functions that
  Phase 5 adds or modifies. The six existing functions stay unchanged (D1)
  and are monitored through the register.
- **Fixtures (14):** new negative and positive C5 fixtures.

**Revision 11b:** the revision 11 candidate plus three review corrections. No
product decision, other security boundary or PR dependency changed.

- **Baseline (header):** `main` is now `d1c4977`, after GitHub's history
  rewrite; its tree is identical to the earlier baseline `d9c0102`.
- **C5 exceptions (3.4, 14):** a C5 condition may be excused only by a
  narrow, individually reviewed exception on that one function's entry. The
  only `search_path` exception is the existing `rls_auto_enable()` (`pg_catalog`).
  There's no blanket exception, and an owner other than `postgres` is never
  excused.
- **Currency acceptance criterion (15, new #13)** for
  `workspaces_currency_format_check`.

**Revision 11:** two changes, from the PR 1 planning decisions. No product
decision, other security boundary or PR dependency changed.

- **Workspace currency format (5.2, 12, 13, 14, 16, 17):** a CHECK constraint
  `workspaces_currency_format_check` requires `workspaces.currency` to match
  `^[A-Z]{3}$`, the same format `revenues.currency` already requires. It's
  added in PR 1, after a blocking pre-check that finds no workspace that
  fails it. Existing values are never converted.
- **Wording correction (8.2):** `updateWorkspace()` does have a caller, the
  Sidebar language switch, which sends only `locale`. The conclusion is
  unchanged: no UI edits the timezone.

**Revision 10:** two ID-immutability rules.
**`appointments.id` is immutable after INSERT** for every role and every
application-accessible path, enforced by `trg_appointments_a_lifecycle` from
PR 2, next to `workspace_id` (new 4.6). **`visits.id` gets the same rule**,
enforced by the new `trg_visits_a_id_immutable` from PR 2 (new 4.7), because
revenue references visits the same way.

- Repository evidence: nothing protected it. The foreign keys that
  reference it (`appointment_services`, `visits`, and from PR 1
  `revenues.appointment_id`) are `ON UPDATE NO ACTION`. That refuses an
  update that leaves a referencing row dangling. It does **not** refuse a
  multi-row statement that swaps two IDs, which would silently move lines,
  visits and revenue to the other appointment. `revenues.visit_id` (to
  `visits.id`) is also `NO ACTION`, so a swap of two visit IDs would
  silently attach each revenue row to the other visit.
  `audit_logs.record_id` has no foreign key at all.
- Both are recorded as protected operations with **no** writer (3.2),
  checked by the inventory (C11, C12 (g), with fixtures; 3.4), and tested
  for `authenticated`, `anon`, `service_role`, `postgres` and a SECURITY
  DEFINER function: single-row and multi-row changes, swaps and upserts,
  with linked lines, visits, revenue and audit rows checked by ID (14).
- R-d (3.3) now states that an ID change is refused, not an allowed
  appointment write. A statement that names `id` stays an R-d cycle partner
  while it passes rows whose `id` doesn't change (RD6 (a) and (d)); it's
  refused at its first changed row and never commits an ID change.
- No product decision, other security boundary or PR dependency changed.

**Revision 9:** a final, documentation-only consistency pass. No product
decision, security boundary or PR dependency changed.

- **R-d verified** against the schema, grants, RLS and triggers (3.3). It's
  real, and stays a residual case outside R1, with tests RD1–RD5 (14.2).
- **Lock-order defect fixed (3.3):** `save_appointment` for a member of
  several workspaces could have waited for a lower workspace key while
  holding a higher one and a row lock. The helper now locks all of the
  caller's workspaces in order, and a transaction that already holds a
  workspace lock never waits for another one; it fails closed instead.
- **Control experiments corrected (14.2):** with the row-level try-lock in
  place, disabling only the statement locks can't reproduce the original
  deadlock. There are now two controls, C-A and C-B, each with a required
  result.
- **Cascade documented (3.2, 4.4):** a member's permitted appointment
  DELETE removes its lines through ON DELETE CASCADE, run as `postgres`.
  This is now an explicit, tested path, so the earlier claim that only
  `delete_workspace()` deletes those lines is corrected.
- **One residual protocol (14.2):** RA, RB, RC1–RC5 and RD1–RD5 all have
  exact outcomes, post-states (by ID and reference) and failure conditions.
  M8 now covers `mark_appointment_noshow`, and M10 covers line upserts.

**Revision 8** made `delete_workspace()` the single reviewed exception to
R1, with an exact inventory form that C12 accepts for that one function
only (3.2, 3.3, 3.4). It narrowed the no-deadlock guarantee to R1-compliant
writers, added RC1–RC5, and identified R-d.

**Revision 7** fixed the multi-row locking blocker. Multi-row appointment
and line writes stay supported under lock rule R1 (3.3). Overlaps are
rechecked against the final state of each statement (7.1). Mandatory
concurrency tests M1–M13 are added (14.2).

**Revision 6:**

- It adds an **RLS policy inventory**, with policy-drift detection, to the
  catalog check (3.1, 3.4, C13–C18).
- It splits the completion row of the role table into the direct write
  (refused at depth 1) and the nested maintenance trigger (allowed at
  depth ≥ 2 with the value check) (3.2).

**Revision 5** made the trust boundary between application-accessible
access and trusted operator access explicit (3.2), and fixed the historical
`last_visit_at` case (3.2, 9; tests L1–L8 in 14).

**Revision 4** was an earlier correction pass:

- The privileged-write inventory now covers **protected columns and
  operations**, separately from normal authorized writes (3.2).
- The timezone allowlist source is **`zone.tab`** (U4; 8.2).
- The CI inventory contract is catalog-based (new 3.4).
- Trigger-depth behavior is a **mandatory, tested prerequisite**, not an
  assumption (14.1).
- `delete_workspace()` is an explicit inventory entry (3.2).

Approved product decisions are unchanged. Revision 3 incorporated U1
(workspace moves rejected), U2 (compatibility links rejected) and U3
(service-role restrictions) and removed the `beautyroute.trusted_operation`
marker. Section 18 lists all changes.

**Baseline:** `main` at `d1c497733dc37e6f3e9036a858c746732d1d00fd` (merge of
PR #34). Its Git tree (`37fc835c64cc750da869f7b59e6fc7cf5a2e1109`) is identical
to the pre-rewrite baseline `d9c0102`, so every file and line cited below is
unchanged; only the commit history was rewritten. The production database is
at migration `20261029120000`, with 22 migrations, none pending. Every
statement about the current system below was checked against that code, not
against older documentation (`docs/PROJECT_ROADMAP.md` and `HANDOVER.md` are
out of date; see PR 0).

---

## 1. Purpose and scope

Phase 5 completes the core booking loop (roadmap milestone M2):

- appointments with an enforced lifecycle and editing rules;
- per-appointment pricing;
- atomic, idempotent completion that records a visit and a revenue record;
- no-show fee collection;
- overlap prevention;
- expense entry;
- dashboards that report real figures, per currency, in the workspace
  timezone.

### 1.1 Out of scope (explicit)

- **Deposits:** the `deposit_amount` and `is_deposit_paid` columns are neither
  read nor written, and existing behavior is unchanged.
- **Photo upload and "S3 Phase 2" Storage policies:** photos stay pasted URLs
  in `files.file_url`, and Storage stays default-deny for clients.
- **Refunds, voids and financial corrections:** these need a future dedicated
  workflow. Financial records are never silently modified or deleted.
- **Real payment processing** (roadmap Phase 7). Phase 5 *records* payments
  taken outside the app.
- **Staff invitations or any new way to add members.** Membership consent
  (`20261029120000`) is unchanged.
- **Moving appointments between workspaces (U1, rejected):**
  `appointments.workspace_id` is immutable after creation.
- **Timezone conversion outside the approved screens (Section 8.4).**
  Unchanged: the trial banner, AI history and AI Engine, Client Portal, Clients
  page, Pricing, onboarding, and every other screen.
- **Scheduled jobs and new extensions:** no `pg_cron`, no `btree_gist`.
- **New database roles:** none are created. The trust model (3.2) uses only
  existing roles.

### 1.2 Current-state findings that Phase 5 resolves

| Finding | Evidence |
| --- | --- |
| No lifecycle rules; free status select | `appointment_status` enum (baseline migration, line 75); `src/pages/Appointments.jsx:22, 403-406` |
| Editing an appointment erases its notes | `Appointments.jsx:156` |
| Services are saved in two non-atomic requests | `src/services/appointments.ts:166-182`; `Appointments.jsx:204-208` |
| `custom_price` is never written | `appointments.ts` |
| **Nothing writes `revenues` or `expenses`**, so the dashboards always show 0 | Repository-wide search; `src/services/revenue.ts`, `src/services/expenses.ts` |
| `net_total` = G + tip − D + T would charge VAT twice for tax-inclusive prices | `revenues` table (baseline migration, line 517) |
| Currency hardcoded as "SAR" | `revenue.ts:6, 46`; `StylistDashboard.jsx:274`; `BusinessEngine.jsx:166-168` |
| Mixed browser-local and UTC dates | `Appointments.jsx:32, 188`; `appointmentView.js:6-7`; `RouteEngine.jsx:29`; `BeautyPassport.jsx:31`; `appointments.ts:74`; `monthSeries.js` |
| `visit_date` and `incurred_at` default to `CURRENT_DATE` (server UTC date) | Baseline migration, lines 595 and 461 |
| `assigned_staff_id` references `profiles` and is never validated | Foreign key `appointments_assigned_staff_id_fkey`; S5 trigger fires only on `client_id`/`workspace_id` |
| Several visits can link to one appointment | `BeautyPassport.jsx:32, 208`; no uniqueness rule |
| Clients can write `last_visit_at` and `next_appointment_at` directly | `GRANT ALL ON clients TO authenticated` (baseline, line 1179); `clients.ts` updates have no field allowlist. The Clients page payload never includes them (`Clients.jsx:125-136`). |
| Members (and `service_role`) could insert revenue directly | `revenues_access` FOR ALL for members; `GRANT ALL` on `revenues` |
| Other members' names are unreadable (`profiles` is own-row only) | Baseline migration, line 991 |
| No app or Edge Function code uses the service-role key | Repository search (`src/`, `supabase/functions/`) |
| Among existing SECURITY DEFINER functions, only `delete_workspace()` writes `appointments`, `appointment_services`, `revenues` or `clients`, and it only deletes. No existing trigger updates `clients`. (Migration search; the PR 1 catalog inventory, Section 3.4, re-establishes this from the catalog instead of relying on the search.) | Migration search |

---

## 2. Approved decisions (consolidated)

| # | Decision |
| --- | --- |
| Lifecycle | New appointments always start as **`pending`**. Transitions: pending→confirmed or cancelled; confirmed→completed, cancelled or no-show. **Completed, cancelled and no-show are terminal.** Enforced in the database. The UI shows actions, not a free select. |
| Editing | **Pending:** every detail except the workspace. **Confirmed:** start and end time, location, assigned staff, services, agreed prices and notes; **client locked**. **Terminal:** notes only. **`workspace_id` is immutable in every state (U1).** |
| Pricing | The catalog price is the default agreed price. Overridable per appointment. The catalog price is never changed. |
| Tax | Prices **include VAT** by default. The VAT amount is **entered manually** at checkout. No workspace VAT-rate setting. Tax-exclusive pricing is reserved for later, with no extra tax rules. |
| Revenue | **Service revenue = G − D − T** (no tips, no tax). **Collected** is reported separately. |
| Payment methods | Fixed list: cash, card, bank transfer, other. |
| Completion | Creates exactly **one visit and one revenue record, atomically**. **Idempotent.** |
| Visit staff | `assigned_staff_id` when set, **even if that member has since become inactive**; otherwise the user completing the appointment. |
| Deletion | Completed appointments, and ones with financial records or a linked visit, can't be deleted (except by the unchanged `delete_workspace()`). Financial history is preserved. |
| No-show fee | Recorded **only when collected**. **T = 0.** Counts toward collected only, never service revenue. At most one per appointment. |
| Overlap | Pending and confirmed block a slot. Unassigned conflicts with every active appointment in the workspace. Assigned conflicts with unassigned appointments and the same staff member. Different staff members may overlap. Assigned staff must be **active** members. |
| Inactive assigned staff | Confirm, cancel, no-show and complete are allowed **without reassignment**. New assignments and detail edits require an active member (or clearing the staff field). |
| Currency | Snapshotted on every revenue and expense row; never changed afterwards; **totals per currency, never added across currencies**. |
| Timezone history | `timezone_snapshot` on revenue and expense rows, immutable. Revenue months use **each row's own snapshot**. |
| Expenses | Add, edit and delete by members under the existing rules. Free-text category. Currency and timezone snapshot fixed at creation. |
| Business Engine | Per currency: service revenue, collected, expenses, **service revenue − expenses** and **collected − expenses**. |
| Timezone | Appointment entry, display, daily views, visit dates and monthly reporting use the workspace timezone. Nonexistent local times are **rejected**; ambiguous ones resolve to the **earliest UTC instant**. |
| Timezone identifiers (U2, U4) | **`UTC` plus the region identifiers listed in IANA `zone.tab`** (the per-country identifiers IANA designates; this is the product's definition of "canonical"), enforced with a checked-in allowlist (Section 8.2). Backward-compatibility names not in `zone.tab` (for example `Asia/Calcutta`), abbreviations, numeric offsets, `Etc/*` other than `UTC`, `US/*` and `posix/*` are rejected. Existing workspace timezones are never converted automatically. |
| Other dates | Dates derived from timestamps use the workspace timezone on the approved screens only. Date columns stay dates. |
| Staff names | `list_workspace_staff(ws)` returns `profile_id` and `full_name` of **active** members, **only to active members of that workspace**. Profile RLS unchanged. |
| `last_visit_at` | Set by the database **on successful completion only**, to the **appointment's `start_time`**. Never overwritten by an older value. **Manual Beauty Passport visits don't update it.** |
| `next_appointment_at` | Stored value maintained on writes. Readers use the **effective value** with a read-time fallback that never writes (Section 10). Qualifying statuses: **pending, confirmed**. |
| `service_role` (U3) | Direct `service_role` writes are refused for system-managed fields, snapshots, financial records (revenue and expenses), appointment status and protected deletions. From PR 2, direct `service_role` writes to `appointments` and `appointment_services` are also refused at statement start, because the 3.3 lock strategy can't bound its workspaces (no code uses the key). Any future authorized backend workflow must use a dedicated, explicitly scoped, hardened database function. **There is no general service-role bypass.** |
| Existing production data | Read-only pre-checks only detect problems. **Any** blocker found stops the PR for manual review. Never backfill, recompute, overwrite or delete existing records automatically. |

---

## 3. Security invariants and trust model (apply to every PR)

### 3.1 General invariants

1. **No RLS policy is loosened.** S1 (protected `workspaces` columns), S1-b,
   S2, S3 (Storage default-deny), S4 (owner-only staff management), S5
   (cross-workspace references), and membership consent stay intact, and
   their suites stay green.
   - From PR 1 on, this is also enforced by the **RLS policy inventory**
     (3.4, C13–C18). Any added, removed or changed policy, or changed table
     RLS state, fails the catalog check until it's reviewed.
   - Phase 5 itself adds **no** policy and changes none.
2. **SECURITY DEFINER functions** must:
   - set `SET search_path = public`;
   - schema-qualify every object;
   - check `public.is_workspace_member(ws)` themselves before touching data;
   - re-derive every value they write from the database instead of trusting
     the arguments (amounts are validated, IDs checked against the
     workspace);
   - revoke EXECUTE from PUBLIC and `anon` and grant it to `authenticated`
     only;
   - be owned by `postgres`.

   These requirements apply strictly to every SECURITY DEFINER function that
   Phase 5 adds or modifies. Existing SECURITY DEFINER functions that Phase 5
   doesn't add or modify aren't held to this list; Phase 5 doesn't change
   them, and PR 1 changes none of their grants (decision D1). The ones that
   fail C5 (3.4) are listed in its exception register and monitored there;
   their other existing grants are recorded and pinned by the inventory (C2).
   Ownership by `postgres` has no exception for any function.

   The Phase 5 SECURITY DEFINER functions are `confirm_appointment`,
   `cancel_appointment`, `mark_appointment_noshow`, `complete_appointment`,
   `collect_noshow_fee` and `list_workspace_staff`, plus the trigger function
   `maintain_client_fields()`. A trigger function has no client EXECUTE grant,
   because EXECUTE on a trigger function is checked when the trigger is
   created, not when it fires.
3. **Guards in two layers:**
   - **Migration-text tests** (a Vitest test per migration, as today) give
     fast feedback when a migration re-grants a revoked privilege, drops or
     disables a required trigger, changes a guard to SECURITY DEFINER, or
     changes the qualifying-status constant in only one place.
   - **The catalog inventory check** (Section 3.4) is the **authoritative**
     gate. It runs against a database built from all migrations and fails on
     any function, trigger, rule, privilege or ownership that doesn't match
     the reviewed inventory.

   Text tests are an early warning only. **They aren't relied on to prove
   coverage.**

### 3.2 Trust model (no session marker)

**Why the marker was removed.** Revision 2 trusted a transaction-local custom
setting (`beautyroute.trusted_operation`) together with `current_user =
'postgres'`. A custom setting isn't protected from modification: any code
that can call `set_config` can set it, and it persists for the rest of the
transaction (it isn't cleared if a function errors out before resetting it).
Its safety would therefore have depended on every SECURITY DEFINER function
in the database never writing protected fields while a stale or client-set
value was present. That can't be proven locally, so **the marker is removed
completely**. The replacement keeps no session state at all. Every decision
uses facts the client can't influence: the **active role**, the **trigger
nesting depth**, the **table privileges**, and an **inventory of the code
allowed to write**, enforced in CI.

**Trust boundary.** Two kinds of database access are distinguished
throughout this specification.

1. **Application-accessible access (the security boundary).**
   - Who: every request that reaches the database as `authenticated`,
     `anon` or `service_role`. That covers the app through PostgREST, Edge
     Functions, and anyone holding a client key or the service-role key.
   - What applies: every restriction in this specification.
   - What's reachable: only the database objects those roles can use,
     meaning tables under their privileges and RLS, and the functions
     granted to them. The SECURITY DEFINER functions and triggers that
     these calls can reach are the **privileged-function inventory** below.
   - When this specification says a protected write is made "only by"
     certain functions, it means **only by those functions, among all
     application-accessible paths**.
2. **Trusted database-owner and operator access (outside the boundary).**
   - Who: whoever connects as `postgres` (the table owner) or a
     Supabase-managed platform role. That covers the dashboard SQL editor,
     a direct database connection with the database password, the Supabase
     CLI, and migrations.
   - What it can do: the table owner isn't limited by the privileges
     revoked here. It can disable triggers (`ALTER TABLE … DISABLE
     TRIGGER`) or skip them (`session_replication_role`), and it can change
     functions and policies. So **no client-role restriction in this
     specification can prevent an operator from inserting, updating or
     deleting revenue, deleting protected appointments, visits or lines,
     editing lines without the staff check, or changing any protected
     column.**
   - The guards that also fire for `postgres` are **safeguards against
     operator mistakes**, not a security boundary. Examples: snapshot
     immutability, `workspace_id`, `appointments.id` and `visits.id`
     immutability, refusal of client system columns at depth 1, and
     "completed requires service revenue". They stop an accidental plain
     `UPDATE`, but not a deliberate bypass.
   - Operator access is controlled **outside the database**: by who holds
     Supabase dashboard access and the database password, and by the
     approval-gated runbooks. Production changes are detected afterwards by
     the read-only catalog comparison (3.4, 13).

Phase 5 adds no operator capability and removes none. The approval process
for production changes is unchanged.

**Building blocks (application-accessible boundary):**

1. **Privileges (first line).** These are revoked from `authenticated`,
   `anon` **and** `service_role`:
   - `UPDATE (status)` on `appointments`;
   - INSERT, UPDATE and DELETE on `revenues`;
   - INSERT, UPDATE and DELETE on `expenses` for `service_role` only (members
     keep add, edit and delete, as approved).

   On application-accessible paths, only the `postgres`-owned SECURITY
   DEFINER functions in the inventory can then create revenue rows or
   change status.
2. **Guard triggers are SECURITY INVOKER** (enforced structurally). Inside a
   guard, `current_user` is the role that issued the statement:
   - `authenticated` / `anon` / `service_role` for direct PostgREST writes;
   - `postgres` for statements executed inside a `postgres`-owned SECURITY
     DEFINER function or trigger;
   - `postgres` for the statements of a foreign-key referential action
     (ON DELETE CASCADE / SET NULL), which PostgreSQL runs as the owner of
     the referencing table. The only actions Phase 5 relies on are the
     lines' cascade and the visits' SET NULL, both fired by an appointment
     DELETE that has already passed its own guard (3.2 table; 4.4).

   A client can never become `postgres` (the `authenticator` role isn't a
   member of it).
3. **Trigger depth (system-managed client fields).**
   - `pg_trigger_depth()` is a server function, so no client can set its
     value.
   - **Expected** PostgreSQL behavior: a guard fired by a statement issued
     directly (by a client, or in the body of an RPC function) sees depth 1;
     a guard fired by a statement inside another trigger sees depth ≥ 2.
   - That behavior is **not treated as established** until the mandatory
     PostgreSQL tests D1–D8 (Section 14.1) pass locally. They're the first
     step of PR 3a. If any of them fails, PR 3a stops and this trust model
     returns for review.
   - **Depth alone doesn't say which trigger is running.** Any trigger that
     runs as `postgres` and updates `clients` would also reach depth ≥ 2.
     Two things close that gap: the catalog inventory (3.4), which fails CI
     on any trigger function not reviewed and pinned; and the value check
     (building block 5).
4. **Privileged-write inventory (protected columns and operations only).**
   - Protection is defined per **column or operation**, not per table.
   - Normal authorized application writes to the same tables are **not**
     privileged and stay unchanged (see "Normal authorized writes" below).
   - The table below lists every protected column or operation and its only
     **application-accessible** writers. Operator access is outside this
     table (trust boundary above).
5. **Value check (defense in depth for client system fields).** Even in the
   allowed context, `trg_clients_a_system_fields` checks each system column
   **only when its value changes** (`NEW IS DISTINCT FROM OLD`). An
   unchanged column always passes.
   - **`next_appointment_at`:** a changed value must equal the earliest
     qualifying future `start_time` (10.1).
   - **`last_visit_at`, which may only advance:** a changed value is
     accepted only if:
     - it's non-NULL;
     - it's **greater than** the old value (or the old value is NULL);
     - **and** it equals the `start_time` of a `completed` appointment of
       that client that has a `kind='service'` revenue row.

     A lower value, a NULL, or any value that doesn't match such an
     appointment is refused.
   - **Historical values are preserved, not re-validated.** An existing
     `last_visit_at` with no matching Phase 5 revenue row stays as it is.
     Completing an **older** appointment leaves it unchanged, so the guard
     has nothing to check and the completion succeeds.
     `maintain_client_fields()` only issues the `last_visit_at` update when
     the value would advance (Section 9), so guard and maintenance agree.
   - This keeps the approved rules: the value is set from the completed
     appointment's `start_time`, never decreases, and is never overwritten
     by an older value.

   An application-accessible write path the inventory missed could
   therefore only ever write the correct value.

**Protected columns and operations (application-accessible paths):**

| Protected column / operation | Only application-accessible writer(s) | Enforcement |
| --- | --- | --- |
| `clients.last_visit_at`, `clients.next_appointment_at` (columns only) | `maintain_client_fields()`: the AFTER trigger function on `appointments` (SECURITY DEFINER, owned by `postgres`) | `trg_clients_a_system_fields` (SECURITY INVOKER) refuses any change unless `current_user = 'postgres'` **and** `pg_trigger_depth() >= 2` **and** the value check passes. On INSERT both columns must be NULL. |
| `revenues` INSERT | `complete_appointment`, `collect_noshow_fee` | Privilege: INSERT revoked from `authenticated`, `anon` and `service_role`, so only owner contexts can insert. The catalog inventory shows that no other application-accessible definer function or trigger inserts revenue. |
| `revenues` UPDATE | none | Privilege revoked from all client roles. The snapshot columns are also protected by a trigger that fires for every role, including `postgres` (for the operator, a safeguard only). |
| `revenues` DELETE | `delete_workspace()` | Privilege revoked from all client roles; the inventory |
| `appointments.status` change | `confirm_appointment`, `cancel_appointment`, `mark_appointment_noshow`, `complete_appointment` | Column privilege revoked from all client roles; `trg_appointments_a_lifecycle` transition rules; `completed` additionally requires a `kind='service'` revenue row for the appointment |
| `appointments.workspace_id` change | **none** | `trg_appointments_a_lifecycle` refuses it for every role (4.5) |
| `appointments.id` change (any UPDATE, including an upsert's conflict update, where `NEW.id IS DISTINCT FROM OLD.id`) | **none**: no function, trigger or direct write may change it | `trg_appointments_a_lifecycle` refuses it for every role, including `postgres` and SECURITY DEFINER functions (4.6). The referencing foreign keys are `ON UPDATE NO ACTION` and are **not** relied on: they don't stop a swap of two IDs. The inventory refuses any entry that declares it (C12 (g)) and flags any body that may write it (C11). |
| `visits.id` change (any UPDATE, including an upsert's conflict update and a referential action's UPDATE, where `NEW.id IS DISTINCT FROM OLD.id`) | **none**: no function, trigger or direct write may change it | `trg_visits_a_id_immutable` (BEFORE UPDATE, SECURITY INVOKER) refuses it for every role, including `postgres` and SECURITY DEFINER functions (4.7). `revenues.visit_id` is `ON UPDATE NO ACTION` and is **not** relied on: it doesn't stop a swap of two visit IDs. Inventory: C12 (g), C11. |
| `appointment_services` INSERT/UPDATE **while the parent's assigned staff member is inactive** (the staff-check exemption) | `complete_appointment` (final checkout prices) | `trg_appointment_services_a_editable` skips **only** the staff check, and only when `current_user = 'postgres'`; the status rule still applies. The inventory shows `complete_appointment` is the only application-accessible definer function or trigger that inserts or updates this table. |
| `appointment_services` DELETE **on a terminal appointment** | `delete_workspace()`; and the `appointment_services` **ON DELETE CASCADE** of a permitted appointment DELETE, which removes only the lines of an appointment that is itself being deleted (a member deleting a cancelled or no-show appointment with no visit and no revenue, 4.4) | `trg_appointment_services_a_editable` allows a terminal-parent DELETE only when `current_user = 'postgres'`. PostgreSQL runs the cascade as the owner of `appointment_services` (`postgres`); that's **expected** behavior, confirmed by the cascade test (14, Lifecycle and editing). A direct line DELETE by any client role is refused. The inventory covers the rest. |
| DELETE of a completed or financially linked appointment, or of a visit referenced by revenue | `delete_workspace()` | `trg_appointments_a_delete_guard` and `trg_visits_a_delete_guard` allow such a DELETE only when `current_user = 'postgres'`; the inventory |
| Snapshot columns (`currency`, `timezone_snapshot`) on `revenues` and `expenses` | Set only by the BEFORE INSERT snapshot triggers | Immutable for every application-accessible role. The trigger also fires for `postgres`, as an operator safeguard. |

**Trusted operator capability (outside the boundary, documented, not
prevented):** using owner access, an operator can make any of the writes
above directly. That includes inserting, updating or deleting revenue;
deleting protected appointments, visits and lines; editing lines without the
staff check; and, by disabling or skipping triggers, changing protected
columns. Section 17 records this.

**Normal authorized writes (unchanged, not privileged):**

| Table | Normal write | Rules that still apply |
| --- | --- | --- |
| `clients` | Members insert, update and delete client profiles (name, contact, notes and every other non-system column) through the Clients page and the API | Existing RLS and S5. The guard only checks that the two system columns are unchanged (UPDATE) or NULL (INSERT); the app never sends them (`Clients.jsx:125-136`). |
| `appointment_services` | Members insert, update and delete services and agreed prices on **pending and confirmed** appointments, through `save_appointment` or the API | Editing matrix (4.2), staff validation (4.3), RLS and S5 |
| `appointments` | Members create appointments (always `pending`) and edit details and notes as the editing matrix allows, single-row or multi-row through the API | 4.1–4.6, overlap (7.1), lock rule R1 (3.3), RLS and S5 |
| `visits` | Members add and edit manual Beauty Passport visits | 6.3, RLS and S5 |
| `expenses` | Members add, edit and delete expenses | 5.2, RLS and S5; snapshots fixed |

**Privileged-function entries** (part of the inventory in 3.4; every other
function is inventoried too, with an empty protected-write set):

| Function | Kind | Protected writes it's allowed to make |
| --- | --- | --- |
| `maintain_client_fields()` | trigger function, SECURITY DEFINER | the two client system columns |
| `complete_appointment(...)` | RPC, SECURITY DEFINER | status → `completed`; revenue INSERT (`service`); `appointment_services` final prices (staff-check exemption) |
| `collect_noshow_fee(...)` | RPC, SECURITY DEFINER | revenue INSERT (`no_show_fee`) |
| `confirm_appointment`, `cancel_appointment`, `mark_appointment_noshow` | RPC, SECURITY DEFINER | status change only |
| `list_workspace_staff(ws)` | RPC, SECURITY DEFINER | none (read-only) |
| `delete_workspace(p_workspace_id uuid)` | RPC, SECURITY DEFINER (existing, **unchanged**) | the **narrow deletion exception**, below; also the only reviewed exception to lock rule R1 (3.3) |

**`delete_workspace()`: the narrow deletion exception.**

- It's existing code (`20260803120000_safe_workspace_deletion.sql`) and Phase 5
  doesn't change it.
- It keeps its own authorization checks, deletes revenue first (line 73),
  then the workspace's other rows.
- Its exception covers **DELETE only**, of:
  - revenue rows;
  - completed or financially linked appointments;
  - visits referenced by revenue;
  - lines of terminal appointments.

  It covers no INSERT or UPDATE of any protected column.
- **It doesn't write client system columns itself.** Deleting appointments
  fires `maintain_client_fields()` (AFTER DELETE). That trigger:
  - recomputes `next_appointment_at`, through the value-checked path;
  - updates zero rows when the client is already deleted;
  - never touches `last_visit_at` on deletion.
- The guard condition `current_user = 'postgres'` isn't unique to
  `delete_workspace()`. The catalog inventory (3.4) shows it's the only
  **application-accessible** function that performs these deletes. Operator
  SQL keeps the same delete capability: that's a trusted capability outside
  the boundary (trust boundary above; Section 17), not an application path.
- **It doesn't take the workspace advisory lock.** That makes it the single
  reviewed exception to lock rule R1. The reason, its inventory form
  (`locks_workspace_first: "reviewed_exception"`, 3.4) and the residual
  deadlock R-c are in 3.3. Its deletion flow and authorization are not
  changed.
- `supabase/tests/workspace_deletion_flow.sql` must keep passing
  **unchanged**, together with the new Phase 5 deletion tests (14) and the
  R-c race tests RC1–RC5 (14.2).

**Argument for the required properties.** Each property is backed by the
tests named below; the tests marked as prerequisites must pass before the
property is relied on.

1. **Each exposed SECURITY DEFINER function that makes protected writes
   establishes its own context safely.**
   - Authority comes from being a `postgres`-owned definer function whose
     reviewed, hash-pinned inventory entry allows that write (3.4). No
     caller-supplied state is involved.
   - Every such function re-checks membership and re-derives the values it
     writes. `last_visit_at` comes from the appointment's own `start_time`,
     and `next_appointment_at` is recomputed from `appointments`; the value
     check verifies both.
2. **A client can't pre-set anything to exploit another function.** No
   decision reads any session setting. The decisions read only:
   - `current_user`, which a client can't change to `postgres`;
   - `pg_trigger_depth()`, which is server-computed;
   - table and column privileges;
   - recomputed values.

   Spoofing tests (14, Trust model, item 3) set arbitrary custom settings
   and show they change nothing.
3. **Nested calls can't inherit an unauthorized context.**
   - `current_user` switches to the owner only for the body of a definer
     function and is restored when it returns.
   - **Expected:** an exposed definer function called directly runs its
     statements outside any trigger, so their guards see depth 1 and
     **can't** change client system columns, even as `postgres`.
   - A definer function called *from inside a trigger* would run at depth
     ≥ 2. This is why every trigger function and every function it can call
     is in the inventory (3.4), and why the value check exists.
   - Tests D3–D5 (14.1) are prerequisites.
4. **Nothing needs clearing or restoring.** There's no state: role and depth
   revert automatically when a function or trigger returns. Tested by D6–D7.
5. **Errors and rollback can't leave an authorization context behind.** With
   no session state, an aborted transaction or rolled-back savepoint leaves
   nothing a later statement could use. Tested by D6 and the Trust model
   item 5.
6. **Direct writes stay refused** for `authenticated`, `anon` and
   `service_role`, through privileges and guards (role table below; Trust
   model item 1).
7. **Coverage:**
   - the catalog inventory check and its negative fixtures (3.4; 14,
     Inventory contract);
   - the trigger-depth prerequisites (14.1);
   - RLS tests for spoofing, every privileged path and every preserved
     normal write (14).

**Behavior by role:**

| Role / context | Client system fields | Revenue INSERT/UPDATE/DELETE | Appointment `status` change | Protected deletes | Snapshot fields | Expenses |
| --- | --- | --- | --- | --- | --- | --- |
| `authenticated` | **Refused** (42501); every other client column editable as before | **Refused** (privilege); only via `complete_appointment` / `collect_noshow_fee` | **Refused** (privilege); only via the lifecycle functions | **Refused** | Set by trigger; changes **refused** | Add, edit, delete under RLS and S5 (approved) |
| `anon` | **Refused** | **Refused** | **Refused** | **Refused** | **Refused** | **Refused** (no RLS access) |
| `service_role` (U3) | **Refused** | **Refused** | **Refused** | **Refused** | **Refused** | **Refused** (privilege) |
| `postgres` in the **body** of an inventory function (`complete_appointment`, `collect_noshow_fee`, lifecycle functions): statements the function issues itself | **Refused**: a direct client-system-field write from the function body (for example an `UPDATE public.clients SET last_visit_at = …` inside `complete_appointment`) fires the guard at depth 1 | **Allowed** (insert only, as its inventory entry permits) | **Allowed** (transition rules still apply) | n/a | Set by trigger | n/a |
| `postgres` in the **nested** `maintain_client_fields()` trigger, fired by that function's appointment write (for example `complete_appointment`'s status update to `completed`) | **Allowed**: the guard sees depth ≥ 2 and `postgres`, **and the value check passes** (otherwise refused). It's the only application-accessible writer of these columns. | n/a | n/a | n/a | n/a | n/a |
| `postgres` in `delete_workspace()` (also the R1 exception: no workspace lock, 3.3) | **Refused** (depth 1); trigger-driven recompute only | DELETE (narrow exception) | n/a | **Allowed** (narrow exception) | Changes **refused** | Deletes the workspace's rows (unchanged) |
| **Trusted operator** (`postgres` in dashboard SQL, a direct connection, the CLI or migrations), **outside the application boundary** | A plain UPDATE is refused (depth 1): a **safeguard**, which a deliberate bypass (disabling or skipping triggers) defeats | **Possible** (table owner; the revoked privileges don't apply) | **Possible**. A plain UPDATE still goes through the transition trigger and "completed requires revenue" (safeguards). | **Possible** | A plain UPDATE is refused (safeguard); a deliberate bypass defeats it | Owner privileges (unchanged) |

The first rows, down to `delete_workspace()`, are the **security boundary**,
and every restriction there is enforced and tested. The operator row
describes trusted access that's controlled outside the database (trust
boundary above).

Guards **raise** instead of silently ignoring writes. The app never sends the
system fields (`Clients.jsx:125-136`), so raising can't break existing flows.

**Authorized backend workflows (U3):**

- No Edge Function uses the service-role key today (both use the caller's
  token).
- If a future backend workflow needs a protected write, it must add a
  dedicated SECURITY DEFINER function, hardened per 3.1, listed in the
  inventory, granted to the narrowest role, and covered by tests.
- No general-purpose bypass is created.

### 3.3 Lock order (all write paths)

**Why revision 6's argument was wrong.** It assumed each PostgREST request
writes one appointment. That's false:

- `PATCH /appointments?<filter>` is a single `UPDATE` that can match many
  rows;
- `POST /appointments` with a JSON array is a single multi-row `INSERT`;
- an upsert (`Prefer: resolution=merge-duplicates`) is a multi-row `INSERT …
  ON CONFLICT DO UPDATE`;
- a `DELETE` with a filter can match many rows.

In an `UPDATE`, PostgreSQL locks each target row **before** that row's
BEFORE ROW triggers run. With the workspace advisory lock taken inside the
row trigger (revision 6), this cycle is possible:

- transaction A locks row r1 and takes workspace W's advisory lock, then
  moves on to row r2;
- transaction B has already locked r2 and is waiting for W's advisory lock;
- A waits for r2. **Deadlock.**

Statements touching several workspaces could also take advisory locks in
opposite orders. Per-row AFTER triggers take client locks in row-processing
order, not globally sorted. PostgreSQL would detect all of these (40P01),
but the revision 6 claim that they can't happen was wrong.

**Decision (revision 7): multi-row writes stay supported**, with the locking
strategy below. Multi-row writes aren't prohibited, for three reasons:

- they're reachable today through the documented direct-API path
  (Section 3.2, "Normal authorized writes");
- prohibiting them before any row lock is taken isn't possible with
  triggers (a statement trigger can't see the row count before rows are
  locked);
- prohibiting them would mean revoking all direct table writes and moving
  every appointment write behind SECURITY DEFINER functions. That changes
  the trust model and the staff-check exemption (4.3), so it's not a
  minimal fix.

The app itself sends only single-row writes: `src/services/appointments.ts`
filters `.eq('id', id)` on update and delete and inserts one object.
**Nothing relies on that frontend behavior.**

**Lock key.** `k(ws) = hashtextextended('br:overlap:' || ws, 0)`, one key
per workspace. Locks are always taken in **ascending order of the key**,
with duplicates removed. (Sorting by key rather than by workspace ID keeps
the order total even when two workspaces hash to the same key.)

**Rule R1: workspace locks first.** No application-accessible transaction
takes a row lock on `appointments`, `appointment_services` or `clients`
**for an appointment write** before it holds the advisory lock of every
workspace that write can touch. It has **exactly one reviewed exception**,
`delete_workspace()` (below, "R1 exception"); no other function or path
may skip it.

**Scope of R1.** An *appointment write* is an INSERT, UPDATE or DELETE of
`appointments` or `appointment_services`, or a `FOR UPDATE` / `FOR NO KEY
UPDATE` lock on their rows, together with the trigger work that write fires
(including `maintain_client_fields()`'s client locks). Three kinds of path are
**outside** R1, and they aren't exceptions to it:

- writes to **other tables** that only reference appointments or clients,
  such as `visits`. Per row they take `FOR KEY SHARE` on the referenced
  appointment and client: S5's `trg_visits_same_workspace_refs` and the
  foreign-key checks. They never take a write or update lock on those rows;
- writes to `clients` itself (profile edits, and S5's move-side `FOR
  UPDATE`);
- trusted operator access (3.2).

The referential actions an appointment DELETE fires are part of that
appointment write, not separate paths:

- `appointment_services` ON DELETE CASCADE;
- `visits.appointment_id` ON DELETE SET NULL.

PostgreSQL runs them as the owner of the referencing table (`postgres`),
which is why the statement-level lock triggers skip them; the outer
statement already holds the locks.

Their interactions with appointment writers are the residual cases R-a,
R-b and R-d in the deadlock analysis below.

**TRUNCATE** isn't an application path. It isn't reachable through the
Supabase API, and leaving its grants unchanged is the existing reviewed
decision in `20261012120000_restrict_workspace_direct_delete.sql`. The
catalog check records the current grants as they are (C9).

**"Already holds a workspace lock".** The lock triggers and the helper
below both have to know whether the current transaction already holds any
transaction-level advisory lock. They check `pg_locks` for their own backend
(`locktype = 'advisory'`, `pid = pg_backend_pid()`, `granted`). That's
server state a client can't set.

The only other advisory lock in the application is `check_rate_limit()`'s,
and it's always taken in its own RPC transaction. If the two ever met in
one transaction, the effect would only be the fail-closed path below,
never an unordered wait.

Enforced as follows:

1. **Direct API statements: a statement-level lock trigger.**
   `trg_appointments_0_workspace_locks` and
   `trg_appointment_services_0_workspace_locks` are BEFORE INSERT OR UPDATE
   OR DELETE **FOR EACH STATEMENT**, SECURITY INVOKER triggers. They fire
   **before the statement touches any row**, which also covers upserts,
   because both the INSERT and the UPDATE statement triggers fire first.
   - `authenticated`: the trigger computes the set S of **every workspace
     in which the caller is an active member** (`workspace_staff` rows with
     `profile_id = auth.uid()` and `is_active`, readable under
     `workspace_staff_select_own`). RLS limits the rows the statement can
     write to those workspaces. Then:
     - **if the transaction holds no advisory lock yet** (the normal case:
       the first statement of a PostgREST request), it blocks on
       `pg_advisory_xact_lock(k)` for each key of S, in ascending key
       order;
     - **otherwise** (a later statement in a transaction that already took
       R1 locks, for example inside `save_appointment`), it **never
       waits**. It calls `pg_try_advisory_xact_lock(k)` for each key of S,
       ascending. True means the key is already held, or was free and was
       taken without waiting. False raises the lock-order error. That
       covers a membership that became active after the transaction's
       first lock, without ever waiting out of order or while holding row
       locks.
   - `anon` and `service_role`: the trigger **raises 42501**. `anon` has no
     write access anyway. `service_role` bypasses RLS, so its workspace set
     can't be bounded before rows are read; refusing it fails closed.
     This only narrows `service_role` further (U3, no general bypass). No
     code uses the service-role key (1.2).
   - `postgres` contexts are skipped:
     - SECURITY DEFINER functions, which follow rule 2 below;
     - the referential actions above, covered by their outer statement;
     - `delete_workspace()`, the reviewed R1 exception;
     - the operator.
2. **Functions: lock explicitly first, through one helper.**
   `public.lock_appointment_workspace(ws)` is SECURITY INVOKER, with a
   pinned `search_path`, and EXECUTE granted to `authenticated` only.
   - **Called as `authenticated`** (from `save_appointment`, which runs
     with the caller's rights):
     - it raises 42501 unless `ws` is in the caller's active-member set S;
     - it then locks **all of S**, ascending, under the same
       blocking-or-fail-closed rule as rule 1.

     Locking only `k(ws)` would be wrong. A member of W1 and W2 who saves
     in W2 would hold `k(W2)`, and the later statement trigger would ask
     for `k(W1)` while already holding `k(W2)` and an appointment row
     lock. That's an out-of-order wait and a deadlock with a direct writer
     who holds `k(W1)`.
   - **Called as `postgres`** (from the SECURITY DEFINER functions, which
     check `is_workspace_member(ws)` for `auth.uid()` themselves first):
     - it locks only `k(ws)`, blocking if the transaction holds no advisory
       lock yet, otherwise with the try-lock and fail-closed rule;
     - their writes run as `postgres`, so no statement trigger asks for
       another key.
   - Every SECURITY DEFINER function that writes or row-locks an
     appointment does this:
     - first, reads the appointment's `workspace_id` **without a lock**,
       which is safe because `workspace_id` is immutable (U1);
     - then calls the helper;
     - **only then** takes `SELECT … FOR UPDATE` on the appointment.

     These functions are `confirm_appointment`, `cancel_appointment`,
     `mark_appointment_noshow`, `complete_appointment` and
     `collect_noshow_fee`.
   - `save_appointment` calls the helper before its first write or row
     lock. Its later statements then find every key of S already held.
   - The inventory (3.4) records `locks_workspace_first: "explicit"` for
     each of these functions, and C12 checks it. The race tests check it at
     runtime (M7, M8, M12).
3. **Row level: non-blocking, fail closed.** `trg_appointments_b_overlap`
   no longer *waits* for the advisory lock. It calls
   `pg_try_advisory_xact_lock(k(NEW.workspace_id))`:
   - **true** when the transaction already holds the lock (advisory locks
     are re-entrant), or when it's free and is acquired without waiting;
   - **false** when another transaction holds it, and then the trigger
     raises a dedicated "write must lock its workspace first" error.

   A row path that missed R1 can therefore never **wait** for the
   workspace lock while holding row locks. It either proceeds without
   waiting or fails.

   This check is in the INSERT/UPDATE row trigger. DELETEs don't take it,
   so `delete_workspace()`, which only deletes, isn't refused by it, and its
   existing flow is unchanged.

**R1 exception: `delete_workspace()` (the only one).**

- **What it does without the lock.** It runs as `postgres` and takes no
  advisory lock. The statement-level lock triggers skip it (R1.1), and it
  doesn't call `lock_appointment_workspace`. Its only appointment writes are
  two DELETEs: `appointment_services` of the workspace's appointments, then
  `appointments WHERE workspace_id = p_workspace_id`
  (`20260803120000_safe_workspace_deletion.sql`, lines 69 and 84). The
  triggers those DELETEs fire run under the same exception, including
  `maintain_client_fields()`'s client locks. It never inserts, updates or
  `FOR UPDATE`-locks appointments or lines.
- **Why it stays unchanged:**
  - Leaving it unchanged is an approved decision (revision 4, 3.2). It's
    existing, reviewed code, and `workspace_deletion_flow.sql` must keep
    passing unchanged.
  - Adding the lock would change its definition and its tested flow. That
    would be a separate decision (Section 17), not part of fixing the
    multi-row blocker.
  - The risk is bounded. Deletion is rare, owner-initiated and terminal. The
    whole function is one transaction, so a deadlock abort (40P01) rolls
    back **all** of it: the workspace is either fully deleted or left exactly
    as it was, and the owner can retry. The other transaction is either
    committed in full or rolled back in full.
- **What the exception doesn't change:**
  - its existing authorization checks;
  - its narrow DELETE-only protected-write exception (3.2);
  - every guard that fires on its deletes.
- **How it's kept to one function:** the inventory records it as a
  `reviewed_exception` that C12 accepts for this one identity signature
  only, with DELETE-only appointment and line operations, and never for a
  caller of it (3.4).
- **Consequence:** the no-deadlock guarantee below covers R1-compliant
  writers only and excludes `delete_workspace()`. Its interaction with them
  is residual R-c, tested in 14.2 (RC1–RC5).

**Trigger firing order** is fixed by name, because BEFORE triggers fire
alphabetically (statement-level and row-level triggers are ordered
separately). The new appointment triggers are named so that, for each row:

1. `trg_appointments_a_lifecycle`: transitions, the editing matrix,
   **`workspace_id` immutability** and **`id` immutability** (validation
   only, no locks). A later BEFORE ROW trigger that assigned `NEW.id` would
   run after this check, so the inventory refuses any trigger function that
   writes `NEW.id` (C11, C12 (g); 3.4);
2. `trg_appointments_b_overlap`: staff check, then the non-blocking
   `pg_try_advisory_xact_lock` check (rule R1.3), then the per-row overlap
   check (7.1);
3. the existing `trg_appointments_same_workspace_move` (S5; with
   `workspace_id` immutable it never fires for appointments, and stays as
   defense in depth);
4. the existing `trg_appointments_same_workspace_refs` (S5: `FOR KEY SHARE`
   on the referenced client);
5. after the row write, the AFTER trigger `trg_appointments_z_client_fields`
   locks the affected client rows `FOR NO KEY UPDATE`, **in ascending
   `client_id` order** (old and new client of that row, de-duplicated);
6. at the end of the statement, the AFTER **FOR EACH STATEMENT** recheck
   triggers `trg_appointments_c_overlap_recheck_ins` / `_upd` (transition
   tables) re-run the overlap check for every new active row against the
   **final** state (7.1). They take no new locks.

**Per operation** (in every case the workspace lock is taken first):

| Operation | Lock sequence |
| --- | --- |
| Direct INSERT, one or many rows (including an upsert) | statement trigger: advisory locks for the caller's workspaces, ascending → per row: try-lock (already held) → client `FOR KEY SHARE` (S5) → row insert → client `FOR NO KEY UPDATE` → statement-end overlap recheck |
| Direct UPDATE, one or many rows (details, reschedule, client change while pending) | statement trigger: advisory locks, ascending → per row: appointment row lock (taken by UPDATE) → try-lock (held) → S5 `FOR KEY SHARE` (if `client_id` changes) → client(s) `FOR NO KEY UPDATE`, ascending within the row → statement-end recheck |
| Direct DELETE, one or many rows | statement trigger: advisory locks, ascending → per row: appointment row lock (taken before the BEFORE DELETE trigger runs) → delete guard (reads only) → client `FOR NO KEY UPDATE` → at statement end, the referential actions as `postgres`: the lines' ON DELETE CASCADE (line row locks) and `visits.appointment_id` ON DELETE SET NULL (visit row locks; it fires the visits' UPDATE triggers, including `trg_visits_a_id_immutable`, which passes because `id` is unchanged, 4.7; from PR 3b a member's DELETE reaches it only for appointments with no linked visit, so it updates nothing) |
| Direct `appointment_services` INSERT / UPDATE / DELETE, one or many rows | statement trigger: advisory locks, ascending → per row: line row lock and/or parent `FOR KEY SHARE` (FK) → editable and staff checks (reads only) |
| Workspace change | **Refused** by `trg_appointments_a_lifecycle` (U1) |
| `id` change, one or many rows | **Refused** by `trg_appointments_a_lifecycle` at the first row whose `id` changes (4.6). Because `id` is in the SET list, PostgreSQL takes that row's lock in the key-strength mode (`FOR UPDATE`) before the trigger runs, so the statement can wait on that one row; it holds the locks only of the rows it already passed, and then aborts. Nothing is written. |
| `save_appointment` | `lock_appointment_workspace(ws)`: as `authenticated`, all of the caller's active-member workspaces, ascending → appointment `FOR UPDATE` (update) → its writes (the statement triggers find every key already held: try-lock, no wait) |
| Lifecycle transition (confirm/cancel/no-show) | unlocked read of `workspace_id` → `lock_appointment_workspace(ws)` → appointment `FOR UPDATE` → status update → client `FOR NO KEY UPDATE` |
| Completion | unlocked read of `workspace_id` → `lock_appointment_workspace(ws)` → appointment `FOR UPDATE` → `FOR KEY SHARE` on the client, appointment and services (S5, from the visit, revenue and line writes) → status update → client `FOR NO KEY UPDATE` (the AFTER trigger: `last_visit_at` and `next_appointment_at`) |
| No-show fee | unlocked read of `workspace_id` → `lock_appointment_workspace(ws)` → appointment `FOR UPDATE` → `FOR KEY SHARE` on the appointment (revenue insert). No client lock. |
| `delete_workspace()` (unchanged; `postgres`; **the R1 exception**) | no advisory lock; deletes the workspace's rows table by table, each DELETE locking its rows as it goes (residual R-c below) |
| Direct `visits` INSERT, or UPDATE of `client_id` / `appointment_id` / `workspace_id`, one or many rows (**outside R1**) | per row, in the statement's row order: visit row lock (UPDATE) → `trg_visits_same_workspace_refs`: client `FOR KEY SHARE`, then the referenced appointment `FOR KEY SHARE` → at statement end, the foreign-key checks (the same `FOR KEY SHARE` locks, already held). No advisory lock (residual R-d below). An UPDATE that changes `visits.id` is refused by `trg_visits_a_id_immutable` (4.7) at its first changed row, before any S5 lock, and writes nothing |
| Client move to another workspace (S5, unchanged) | client `FOR UPDATE` (S5 move-side). S5 refuses the move while appointments, visits or AI history in the old workspace reference the client, so appointments are never transferred implicitly. |

**Deadlock analysis:**

- **The guarantee and its scope.** No deadlock can form **among
  R1-compliant appointment writers**:
  - direct API statements as `authenticated`;
  - `save_appointment`;
  - the lifecycle functions, `complete_appointment` and
    `collect_noshow_fee`;
  - the triggers their statements fire.

  `delete_workspace()` (the R1 exception) is **explicitly excluded**, and so
  are the out-of-scope paths (R1 scope above). Their interactions with
  R1-compliant writers are R-a to R-d below: detected, never silent.
- **No cycle among R1-compliant appointment writers.**
  - By R1, every R1-compliant transaction that writes appointments or lines
    acquires all of its advisory locks first, in one global (ascending-key)
    order, while holding no relevant row lock.
  - Waiting for an advisory lock therefore never happens while holding an
    appointment, line or client row lock. Ordered acquisition of a single
    lock class can't form a cycle.
  - After that, two writers in the same workspace never run their row
    phases at the same time, because the advisory lock serializes them for
    the rest of their transactions. Row and client lock order **within** a
    statement (including multi-row statements in any row order) is
    therefore irrelevant.
  - Writers in different workspaces touch disjoint rows: appointments,
    lines and clients are workspace-scoped (S5), and `workspace_id` is
    immutable.
- **Multi-workspace members.** A member of several workspaces locks all of
  them, ascending, at the first lock-taking point of the transaction: the
  first statement trigger, or `lock_appointment_workspace` inside
  `save_appointment`. Two such members (A in W1 and W2, B in W2 and W1)
  acquire them in the same order, so there's no cycle.
- **No wait after the first lock.** A transaction that already holds an
  advisory lock never *waits* for another one; the statement trigger and
  the helper use the try-lock and fail closed (R1.1, R1.2). A membership
  that becomes active mid-transaction therefore causes an immediate
  lock-order error, never an out-of-order wait.
- **A row path that skipped R1** (a future function, or a membership
  mismatch) never waits on the advisory lock: `pg_try_advisory_xact_lock`
  either succeeds immediately or the statement fails (R1.3). It can't
  create a wait cycle on that lock.
- `FOR NO KEY UPDATE` **doesn't conflict with `FOR KEY SHARE`**, so S5's
  `FOR KEY SHARE` followed by maintenance's `FOR NO KEY UPDATE` doesn't
  self-block.
- **Remaining possible deadlocks** (all detected by PostgreSQL as 40P01,
  never silent; nothing invalid commits; asserted by the race runner):
  1. **R-a:** a **client move to another workspace** (S5 `FOR UPDATE` on the client)
     concurrent with an appointment write for that client that holds `FOR
     KEY SHARE` and then requests `FOR NO KEY UPDATE`. This existed before
     revision 7.
  2. **R-b:** a **direct multi-row `clients` UPDATE** (which takes no advisory lock)
     locking clients in one order, while an appointment writer's
     maintenance trigger locks two of the same clients in another order.
  3. **R-c: `delete_workspace()`** (the R1 exception: owner-initiated,
     `postgres`, no advisory lock) concurrent with an R1-compliant writer in
     the same workspace. Example:
     - the deletion's `appointment_services` DELETE locks lines;
     - a completion that holds the workspace lock and the appointment `FOR
       UPDATE` then waits to write one of those lines;
     - the deletion's `appointments` DELETE then waits for that appointment.

     Within the appointment DELETE itself, AFTER ROW triggers run only after
     all its rows are locked, which narrows the window but doesn't close it.
  4. **R-d: a multi-row `visits` write that references appointments**,
     concurrent with a statement that takes an update-strength lock on two
     or more of the same appointments in the other order. Verified against
     the schema (revision 9):
     - **The path exists.** Members hold INSERT and UPDATE on `visits`
       (baseline `GRANT ALL`, never revoked). The `visits_access` policy
       (FOR ALL) allows writes in the caller's workspaces. S5's WITH CHECK
       only requires the referenced appointment to be in the same
       workspace. No rule restricts which appointment status a visit may
       reference. So a PostgREST `POST /visits` with a JSON array, or a
       filtered `PATCH /visits` that sets `appointment_id`, is one
       multi-row statement. The app sends single-row writes
       (`src/services/visits.ts`), but nothing relies on that. `service_role`
       visit writes are also allowed: Phase 5 doesn't restrict them (U3
       lists no visit restriction) and no code uses that key.
     - **The locks.** Per row, `trg_visits_same_workspace_refs` (BEFORE
       INSERT OR UPDATE OF `client_id`, `appointment_id`, `workspace_id`)
       takes `FOR KEY SHARE` on the referenced appointment
       (`20261026120000_prevent_cross_workspace_references.sql`), in the
       statement's row order.
     - **The other side.** A DELETE of an appointment locks the row in a mode
       that conflicts with `FOR KEY SHARE`, *before* its BEFORE DELETE
       trigger runs. The candidates are:
       - a member multi-row appointment DELETE, which is R1-compliant;
       - `delete_workspace()`'s appointment DELETE;
       - a multi-row UPDATE that lists `appointments.id` (the only key
         column) in its SET clause.

       **Changing `appointments.id` is refused** (4.6). It's not an allowed
       appointment write on any path, so no R-d cycle can end with a
       committed ID change. What remains is the lock: PostgreSQL takes the
       key-strength row lock for any UPDATE that names `id`, before the BEFORE
       trigger runs, even when the value doesn't change (`SET id = id`, or an
       upsert's conflict update if it lists `id`). A statement that names
       `id` stays an R-d cycle partner while it passes rows whose `id`
       doesn't change (RD6 (a) and (d)); it's refused at its first changed
       row and never commits an ID change. Its outcomes are RD6's:
       - it's refused at its first changed row;
       - or, if the ID remains unchanged, the statement may commit its
         other permitted changes, with every appointment ID unchanged;
       - or it's aborted with 40P01.

       If the visit write holds A1 and waits for A2 while the DELETE holds
       A2 and waits for A1, there's a cycle, and PostgreSQL aborts one side
       with 40P01. The appointment-side writer's advisory lock doesn't help,
       because the visit write never takes one. Before PR 3b, a member
       DELETE's ON DELETE SET NULL can also wait on visit rows that a
       concurrent visit UPDATE holds, which is the same kind of cycle.
     - **What it can't do.** Single-row R1-compliant writers, such as the
       lifecycle functions, completion, the no-show fee and
       `save_appointment`, can't close such a cycle. R1 serializes them per
       workspace, so only one of them is active against the visit write at
       a time. Each update-locks at most one appointment, and every other
       lock it then requests either doesn't conflict with the visit write's
       `FOR KEY SHARE` locks (client `FOR NO KEY UPDATE`, `FOR KEY SHARE`)
       or concerns rows the visit write can't hold first. RD4 checks this.
     - **Never invalid:**
       - A DELETE that waited behind a visit write that then committed
         re-runs its delete guard with a fresh snapshot after the wait, so
         from PR 3b it **refuses** to delete an appointment that now has a
         linked visit.
       - A visit write that waited behind a committed DELETE finds the
         appointment gone and fails: 42501 from the S5 trigger, or 23503
         from the foreign key.
       - No committed visit can point to a deleted appointment.

     This path is outside R1 (scope above) and existed before revision 7.
     Its tests are RD1–RD6 (14.2).

  Whenever a deadlock cycle forms, PostgreSQL aborts one transaction with
  40P01. In non-deadlock cases, the statement may be refused or commit with
  IDs unchanged, as specified above. Each transaction is atomic, so nothing
  partial commits. Making these
  impossible would need the advisory lock on client writes, on writes that
  reference appointments, and inside `delete_workspace()`, which is
  unchanged by decision. That's recorded in Section 17 rather than done
  here.

### 3.4 Privileged-write inventory: CI contract

**Scope.**

- The inventory covers the **application-accessible boundary** (3.2): every
  function, trigger and schema object that a request as `authenticated`,
  `anon` or `service_role` can reach, directly or indirectly, plus every
  other application-schema object, because any of them could become
  reachable.
- It **doesn't** constrain trusted operator access. Ad-hoc operator DML
  (for example inserting revenue in the SQL editor) leaves no catalog trace
  and isn't detectable by this check.
- Ad-hoc operator **DDL** in production is a different case. That covers a
  new or changed function, trigger, grant, RLS policy or table RLS setting,
  or a disabled trigger. It **is** detected afterwards, by the read-only
  comparison of the production catalog with the reviewed inventory (13;
  the verification scripts).
  - Policy and RLS-state drift is detected **only once PR 1's policy
    inventory (below) is in place**.
  - Before that, the existing verification scripts check only the specific
    policies their own suites assert (S1–S5, consent). They're not a
    complete policy comparison.

**What the check can and can't prove.**

- The PostgreSQL catalog enumerates **every** function, trigger, rule, view,
  event trigger, grant and owner, so "is anything unknown?" can be answered
  completely from the catalog.
- *What a plpgsql function writes* can't be derived from the catalog:
  PostgreSQL records no dependencies for plpgsql bodies, and dynamic SQL is
  opaque.
- So the contract is:
  1. **Every** relevant object is enumerated from the catalog.
  2. Each has a **human-reviewed inventory entry** that declares its writes
     and is **pinned by a hash** of its definition.
  3. Anything unlisted, changed, or uninspectable **fails CI** until it's
     reviewed and the inventory is updated in the same PR.
- Source-text searches are used only as **extra tripwires that can add
  failures**. They never establish that something is safe.

**Inventory file** `supabase/security/privileged_writers.json` (new, PR 1).
One entry per function in the application schemas (`public`, plus any schema
a migration creates):

- identity signature;
- kind (`rpc`, `trigger`, `helper`);
- `security` (`definer` / `invoker`);
- owner, language and `search_path` setting;
- **declared protected writes** (from the 3.2 table; usually empty);
- declared table writes (table, operations, columns);
- declared callees (application functions it calls);
- `dynamic_sql` (`none`, or `reviewed` with a written justification);
- `c5_exceptions` (C5 below; usually absent): each item names exactly one C5
  condition (`search_path`, `anon_explicit` or `public_default`), with a
  written reason and repository evidence, and must match a row of the C5
  exception register;
- `locks_workspace_first` (lock rule R1, 3.3; added by PR 2), one of four
  values (below);
- the SHA-256 of `pg_get_functiondef()`.

**`locks_workspace_first` values.** An *R1-relevant* function is one that:

- declares an INSERT, UPDATE or DELETE of `appointments` or
  `appointment_services`, or a `FOR UPDATE` / `FOR NO KEY UPDATE` lock on
  their rows;
- or is a trigger function attached to one of those tables that declares a
  write or update lock on `clients`.

Every R1-relevant function must have one of the first three values:

| Value | Meaning | Allowed only when |
| --- | --- | --- |
| `"explicit"` | calls `lock_appointment_workspace` before its first such write or lock (R1.2) | the entry declares `public.lock_appointment_workspace(uuid)` as a callee, so C11's undeclared-callee and C2's hash rules apply. Used by the lifecycle functions, `complete_appointment`, `collect_noshow_fee` and `save_appointment` |
| `"statement"` | a trigger function that runs inside a statement whose workspace locks R1.1 or R1.2 already took | kind is `trigger`, and **every** trigger in the trigger inventory that calls it is a row-level or AFTER statement trigger on `appointments` or `appointment_services`. Used by `maintain_client_fields()` (client update locks) and S5's `same_workspace_appointment_move()` (`FOR UPDATE` on the appointment; attached only to `appointments`) |
| `"reviewed_exception"` | the reviewed R1 exception (3.3) | all the C12 exception rules below hold |
| `"not_applicable"` | not R1-relevant | the entry declares none of the writes or locks above. Examples: `lock_appointment_workspace` and the statement-level lock and recheck trigger functions (advisory locks and reads only); the S5 reference functions, which take only `FOR KEY SHARE`; the delete guards and editing triggers (reads only); every `visits` trigger function |

**The exception entry, exactly.** `delete_workspace()` is recorded as:

```json
"locks_workspace_first": "reviewed_exception",
"r1_exception": {
  "id": "R1-EX-1",
  "reason": "Existing, unchanged workspace deletion (3.2, 3.3); single transaction, all-or-nothing on 40P01",
  "operations": [
    { "table": "appointment_services", "ops": ["DELETE"] },
    { "table": "appointments", "ops": ["DELETE"] }
  ],
  "residual": "R-c",
  "tests": ["RC1", "RC2", "RC3", "RC4", "RC5"]
}
```

The checker allows exactly one exception. It holds a constant allowlist,
`R1_EXCEPTIONS = ["public.delete_workspace(uuid)"]`. Adding a name to it
means changing both the checker and this section in a reviewed PR; an
inventory edit alone can't add one.

It also lists:

- every non-internal trigger on application tables (table, name, timing,
  events, function, required enabled state);
- the expected privileges on the guarded tables and columns for
  `authenticated`, `anon` and `service_role`;
- the **RLS policy inventory** (below).

**RLS policy inventory** (the `rls` section of the same file, new in PR 1).
It enforces 3.1's invariant 1 ("no RLS policy is loosened") from the
catalog.

- **Tables covered:**
  - every ordinary or partitioned table in the application schemas
    (`public`, plus any schema a migration creates);
  - `storage.objects` and `storage.buckets`, because S3's default-deny
    Storage rule depends on their policies.
- **Per table:**
  - schema and name;
  - `relrowsecurity` (RLS enabled);
  - `relforcerowsecurity` (RLS forced);
  - the complete set of policy names on it. **An empty set is recorded
    explicitly**: a table with no policies is a reviewed state, not an
    absence of data.
- **Per policy** (read from `pg_catalog.pg_policy` joined to `pg_class` and
  `pg_namespace`):
  - table and policy name;
  - **command** (`polcmd`, as `ALL`, `SELECT`, `INSERT`, `UPDATE`,
    `DELETE`);
  - **permissive or restrictive** (`polpermissive`). This is recorded
    because changing a restrictive policy to permissive loosens access.
  - **roles** (`polroles`, resolved to role names, sorted; the zero OID is
    recorded as `PUBLIC`);
  - **`USING` expression** (`pg_get_expr(polqual, polrelid)`, or `null` if
    there isn't one);
  - **`WITH CHECK` expression** (`pg_get_expr(polwithcheck, polrelid)`, or
    `null`);
  - the SHA-256 of the canonical JSON of all of the above.
- **Expression comparison:** expressions are compared **exactly** as
  PostgreSQL deparses them, with no whitespace or formatting
  normalization.
  - A PostgreSQL major-version upgrade can change the deparsed text. That
    shows up as a reviewed diff, never as a silent pass.
  - Functions called inside an expression (for example
    `is_workspace_member()`) are covered separately by C2, so changing such
    a function's body is also caught.

**Catalog check** `scripts/check-privileged-inventory.mjs` (new, PR 1). It
runs read-only catalog queries against a database built from every
migration and compares the results with the inventory file. It's part of the
mandatory local validation for every PR, and **PR 1 adds a CI job** that
starts the local Supabase stack and runs it (see 17). It fails on any of
these:

| # | Condition that fails |
| --- | --- |
| C1 | A function in an application schema with no inventory entry (definer **or** invoker: an invoker function called from definer code runs as `postgres`) |
| C2 | An inventory entry whose function no longer exists, or whose definition hash, owner, security mode, language, `search_path` or EXECUTE grants differ |
| C3 | A function in a language other than `plpgsql` or `sql` (uninspectable) |
| C4 | A non-internal trigger on an application table that isn't in the inventory, is missing, or has a different function, timing, events or enabled state |
| C5 | A SECURITY DEFINER function in an application schema that: (a) isn't owned by `postgres`; (b) has a `search_path` other than `public` (condition `search_path`); (c1) has an explicit EXECUTE grant to `anon` (condition `anon_explicit`); or (c2) is executable by PUBLIC, whether through PostgreSQL's built-in default (a NULL ACL) or an explicit grant (condition `public_default`). A (b), (c1) or (c2) condition passes only if the function's own entry has a `c5_exceptions` item for exactly that condition, **and** that item matches a row of the **C5 exception register** below. **(a) is never excused.** The checker evaluates each condition independently, from the catalog (B1 `acl`, `acl_is_default`, `public_grants`, `config`). It also fails on: an exception that isn't in the register (unregistered); an exception whose condition no longer applies (stale; for example `anon_explicit` after the explicit `anon` grant is removed, or `public_default` after PUBLIC loses EXECUTE); an exception missing its reason or evidence; an exception on a function that isn't SECURITY DEFINER; and a `search_path` exception on any function other than `public.rls_auto_enable()`. Every entry stays hash-pinned (C2), so any change to a function or its grants reopens the review. Adding to the register needs a reviewed change to this section. |
| C6 | Any rewrite rule (`pg_rewrite`, other than view `_RETURN` rules) on an application table |
| C7 | A view over a guarded table (`clients`, `appointments`, `appointment_services`, `revenues`, `visits`, `expenses`) that isn't `security_invoker`, or is auto-updatable, without an inventory entry |
| C8 | An event trigger, or a trigger on an application table whose function lives outside the application schemas (for example in `auth`), that isn't in the inventory |
| C9 | Privileges on guarded tables or columns that differ from the expected set, including any `service_role` write privilege that 3.2 revokes |
| C10 | A guarded table not owned by `postgres`, or any login role (including `authenticator`, `authenticated`, `anon`, `service_role`) that is a member of `postgres` |
| C11 | **Tripwires** (text heuristics; they can only fail, never pass): a function body containing `EXECUTE`, `format(`, `dblink` or `PERFORM`/`SELECT` calls to functions not in its declared callees, or naming a guarded table with an operation not in its declared writes; a body that names `appointments` or `visits` in an UPDATE whose SET list includes `id`; and, for a trigger function that the trigger inventory attaches to `appointments` or `visits`, any statement that can change the row's `id` (4.6, 4.7): an assignment to `NEW.id` (`NEW.id :=`, or a statement beginning `NEW.id =`, since plpgsql accepts `=` for assignment), an assignment to the whole record (`NEW :=` or `NEW =`), a `SELECT … INTO` or `RETURNING … INTO` whose targets include `NEW` or `NEW.id`, or, in a function called by a BEFORE ROW trigger, a `RETURN` of anything other than `NEW`, `OLD` or `NULL` (an AFTER trigger's return value is ignored). The match runs on the function body after removing comments and string literals, ignores case and whitespace, and also matches quoted forms (`"NEW"."id"`). Comparisons such as `NEW.id IS DISTINCT FROM OLD.id` don't match. **Limits:** this is a text heuristic. It can miss an equivalent form it doesn't know, which is why it never counts as coverage; the authoritative controls are the hash-pinned, human-reviewed inventory entry of every trigger function (C1, C2, C4), C12 (g), and the runtime ID immutability tests (14). The real `trg_appointments_a_lifecycle` function and `visits_id_immutable()` are positive fixtures and must pass |
| C12 | (a) A function whose declared protected writes include something not listed for it in 3.2. (b) A declared callee (directly or transitively) whose own declared writes aren't covered by the caller's entry. (c) **Lock rule R1** (3.3; runtime-checked by M12 and RC1–RC5): an R1-relevant function whose `locks_workspace_first` is missing, `"not_applicable"`, or a value whose condition in the values table doesn't hold. (d) A `"reviewed_exception"` entry unless **all** of these hold: its identity signature is in `R1_EXCEPTIONS`; it has an `r1_exception` object with every field present; `r1_exception.operations` equals exactly the entry's declared `appointments` / `appointment_services` operations, and those are DELETE only, with no INSERT, UPDATE or update lock; its definition hash matches (C2). (e) An `r1_exception` object on any other entry. (f) Any function that declares a `"reviewed_exception"` function as a direct or transitive callee: the exception is never inherited. (g) **`appointments.id` and `visits.id` (4.6, 4.7):** any entry whose declared table writes include an UPDATE of column `id` of `appointments` or `visits`, or whose kind is `trigger` and that is called by a trigger that the trigger inventory attaches to either table, and that declares a write of `NEW.id`. The checker takes the table-to-function relationship from the trigger inventory, never from the entry itself. An UPDATE of either table declared without a column list counts as including `id`, so every declared appointment or visit UPDATE must list its columns. No entry may declare it; there's no exception list. |
| C13 | **Added policy:** a policy in the catalog on a covered table that isn't in the RLS inventory |
| C14 | **Removed policy:** an inventoried policy that no longer exists |
| C15 | **Modified policy expression:** the `USING` or `WITH CHECK` expression differs from the inventory, including one being added or removed |
| C16 | **Changed command, roles or mode:** a different command, role set, or permissive/restrictive mode for an inventoried policy (including a drop and re-create under the same name) |
| C17 | **Changed RLS state:** `relrowsecurity` or `relforcerowsecurity` differs for an inventoried table, or a covered table (including a newly created one) has no entry in the RLS inventory |
| C18 | **Fails closed (uninspectable):** the check fails, and never passes, if any of these happen: a policy or table catalog query errors or is denied; `pg_get_expr` returns NULL for a non-NULL `polqual` or `polwithcheck`; a role OID in `polroles` can't be resolved; `polcmd` has an unknown value; an inventory entry is malformed or missing a required field; the catalog returns no policies or tables while the inventory lists some |

**C5 exception register.** These are the **only** permitted C5 exceptions.
All six are existing functions that Phase 5 doesn't modify, and their grants
are preserved by decision D1. All are owned by `postgres`, so none needs an
ownership exception.

The explicit `anon` grants are established by the migrations cited. The
PUBLIC grants are **expected** from repository evidence: no migration revokes
PUBLIC's built-in default EXECUTE on these functions, and the baseline was
produced by `supabase db dump`, which would record such a revoke. They are
**not yet verified**. The authorized database pre-checks confirm them through
Part B `public_grants`, which is **authoritative** for whether PUBLIC holds
EXECUTE. Because each of these functions has explicit grants, the **expected**
state is `acl_is_default = false`, with PUBLIC's EXECUTE carried in the
explicit ACL (PostgreSQL keeps it there when the first explicit grant is
made). That expectation is also subject to the same authorized verification;
`acl_is_default` alone never decides the condition. If the catalog differs,
for example PUBLIC doesn't hold EXECUTE, the corresponding `public_default`
exception is stale, the check fails, and PR 1 stops for review. The register
isn't edited to match without that review.

| Function (exact signature) | Conditions excused | Reason | Repository evidence |
| --- | --- | --- | --- |
| `public.is_workspace_member(uuid)` | `anon_explicit`; `public_default` (expected) | **Required.** RLS policies call it as the querying role, `anon` included (`anon` holds table grants and the policies have no role clause). Revoking EXECUTE would turn `anon`'s empty results into permission errors. | `20260724120000_fix_is_workspace_member_recursion.sql`: definition (lines 20–22), owner (33), `GRANT ALL … TO anon` (35); baseline policies `… USING ("public"."is_workspace_member"(…))` |
| `public.delete_workspace(uuid)` | `anon_explicit`; `public_default` (expected) | **Preserved, not required.** It refuses unless `owner_id = auth.uid()`, which is NULL for `anon`. The only caller is the signed-in owner, through `deleteWorkspace()`. | `20260803120000_safe_workspace_deletion.sql`: definition (49–51), owner check (59–62), owner (115), `GRANT ALL … TO anon` (117); `src/services/workspaces.ts:123` |
| `public.check_rate_limit(text, integer, integer)` | `anon_explicit`; `public_default` (expected) | **Preserved, not required.** It raises 28000 when `auth.uid()` is NULL. It's called only by Edge Functions after they verify the user's token. | `20260803140000_durable_rate_limiting.sql`: definition (67–80), owner (104), `GRANT ALL … TO anon` (106); `supabase/functions/_shared/rateLimit.ts:37`; `supabase/functions/ai-assistant/index.ts:352, 373, 379` |
| `public.audit_trigger()` | `anon_explicit`; `public_default` (expected) | **No effect.** A trigger function: it can't be called directly, and EXECUTE isn't checked when a trigger fires. | `20260724140000_fix_audit_trigger_rls.sql`: definition (22–24), owner (100), `GRANT ALL … TO anon` (102); baseline triggers `trg_*_audit` (lines 801, 809, 821, 825) |
| `public.handle_new_user()` | `anon_explicit`; `public_default` (expected) | **No effect.** A trigger function that can't be called directly. No migration attaches it to a trigger; any production trigger using it is captured by the catalog comparison (C4, C8). | Baseline `20260722092124_name_of_your_migration.sql`: definition (215–217), owner (236), `GRANT ALL … TO anon` (1118) |
| `public.rls_auto_enable()` | `search_path` (`pg_catalog`); `anon_explicit`; `public_default` (expected) | **`search_path`:** the body uses only `pg_catalog` objects plus one reviewed dynamic statement (`EXECUTE format('alter table if exists %s enable row level security', …)`), recorded as `dynamic_sql: reviewed`. **Grants: no effect.** An event-trigger function that can't be called directly. No migration creates an event trigger for it; any production event trigger is captured by C8. | Baseline: definition (305–307), body (308–332), owner (334), `GRANT ALL … TO anon` (1136) |

"Preserved, not required" exceptions are candidates for a later, separately
approved revoke. Phase 5 doesn't change them.

**Dynamic SQL:**

- Functions that make protected writes, and every function they can call,
  must have `dynamic_sql: none`; C11 enforces it.
- Existing functions that use dynamic SQL (if any) are recorded as `reviewed`,
  with the reason, in PR 1 and are hash-pinned. Any later change re-opens
  the review.

**Indirect calls:**

- Declared callees are checked transitively (C12).
- Because **every** application function is inventoried and hash-pinned,
  changing any callee also fails C2 until it's reviewed.

**Out of scope of the check (documented assumption, Section 17):**
functions in Supabase-managed schemas (`auth`, `storage`, `realtime`,
`extensions`, `graphql`, `vault` and similar) owned by Supabase roles are
assumed not to write application tables. C8 still catches any of their
triggers attached to application tables.

**Negative fixtures:** the check's own tests (14, Inventory contract) create,
inside a rolled-back transaction, one object or change for each condition
C1–C18 and assert that the check fails for each. Conditions that can't be
produced in a real catalog (parts of C18) are tested in Vitest against
injected catalog rows and inventory files.

**Production comparison:** the same check runs read-only against
production in every PR's pre-check (13) and verification script. It
compares functions, triggers, privileges, ownership, **RLS policies and
table RLS state** (C1–C18). Any difference is a blocker for manual review;
nothing is changed automatically.

---

## 4. Lifecycle and editing rules

### 4.1 Transitions

| From \ To | pending | confirmed | completed | cancelled | noshow |
| --- | --- | --- | --- | --- | --- |
| *(insert)* | **only** | — | — | — | — |
| pending | — | ✔ (`confirm_appointment`) | ✘ | ✔ (`cancel_appointment`) | ✘ |
| confirmed | ✘ | — | ✔ (`complete_appointment` only) | ✔ (`cancel_appointment`) | ✔ (`mark_appointment_noshow`) |
| completed / cancelled / noshow | ✘ | ✘ | ✘ | ✘ | ✘ |

- `UPDATE (status)` is revoked from `authenticated`, `anon` and
  `service_role`. Status changes only through the functions.
- `trg_appointments_a_lifecycle` enforces the table above on every path.
- **Moving to `completed` additionally requires** an existing `revenues` row
  with `kind='service'` for the appointment. Only `complete_appointment` can
  create that row, so no other path can reach `completed`.
- Calling the function for a state the appointment is already in is a no-op.

### 4.2 Editing matrix

Enforced by `trg_appointments_a_lifecycle` (appointment columns) and
`trg_appointment_services_a_editable` (lines), whatever the path:
`save_appointment`, a direct PostgREST write, or a SECURITY DEFINER function.

| Field | pending | confirmed | completed / cancelled / noshow |
| --- | --- | --- | --- |
| `id` (primary key) | **✘ immutable after INSERT (4.6)** | **✘** | **✘** |
| `workspace_id` | **✘ immutable (U1)** | **✘** | **✘** |
| `client_id` | ✔ | **✘ locked** | ✘ |
| `start_time` / `end_time` | ✔ | ✔ (overlap check) | ✘ |
| `location_address` | ✔ | ✔ | ✘ |
| `assigned_staff_id` | ✔ (active member) | ✔ (active member, overlap check) | ✘ |
| services and agreed prices (`appointment_services` INSERT/UPDATE/DELETE) | ✔ (normal member write) | ✔ (normal member write) | ✘ (privileged exceptions only: completion's final-price write while still confirmed, 6.1; `delete_workspace()` DELETE, 3.2; the cascade DELETE of a permitted appointment deletion, 4.4) |
| `notes` | ✔ | ✔ | ✔ |
| `deposit_amount`, `is_deposit_paid` | unchanged behavior (deferred) | unchanged | unchanged |

### 4.3 Staff validation: one rule, every path

**Detail edits** are changes to any of: `client_id`, `start_time`,
`end_time`, `location_address`, `assigned_staff_id` (on `appointments`), or
**any INSERT, UPDATE or DELETE on `appointment_services`** (services and
agreed prices). (`workspace_id` and `id` can't change at all; see 4.5 and
4.6.)

**Rule:** a detail edit, or an INSERT with `assigned_staff_id` set, is allowed
only if the resulting `assigned_staff_id` is NULL **or** is an **active**
member of the appointment's workspace (`public.workspace_staff` with
`is_active = true`).

- **Implemented once,** as `public.assert_assigned_staff_active(...)`
  (SECURITY INVOKER; members can read their workspace's staff rows under S4's
  select policy). It's called by:
  - `trg_appointments_b_overlap`, on INSERT, and on UPDATE when any detail
    column is distinct from its old value;
  - `trg_appointment_services_a_editable`, on every line change, checking the
    **parent** appointment.
- **The same rule applies to every path,** because both checks are triggers.
  `save_appointment` adds no separate logic.

**Exempt:**

- **Status-only transitions** (confirm, cancel, no-show, complete): only
  `status` changes, so no detail column differs.
- **Notes-only edits:** `notes` isn't a detail edit, so notes stay editable on
  terminal appointments and on appointments whose staff is now inactive.
- **Completion's final line-price write** (6.1, step 5):
  `trg_appointment_services_a_editable` skips the staff check **only** when
  `current_user = 'postgres'`. The catalog inventory (3.4) shows
  `complete_appointment` is the only application-accessible definer
  function or trigger that inserts or updates `appointment_services`.
  Trusted operator SQL is outside this boundary (3.2). Members' normal line
  edits are unaffected and still get the staff check. The status rule still
  applies, since the parent is still `confirmed` at that point.

**Consequence (approved Decision C):** a detail edit of an appointment whose
assigned staff member is now inactive is refused until the staff field is
reassigned to an active member or cleared. Both of those are themselves detail
edits, validated against the *new* value.

### 4.4 Deletion

`trg_appointments_a_delete_guard` (BEFORE DELETE, SECURITY INVOKER) refuses
deletes by `authenticated`, `anon` and `service_role` when the appointment:

- is `completed`;
- has any `revenues` row (by `appointment_id`, or through a linked visit with
  revenue);
- or has a linked visit.

`postgres` contexts are allowed, so the unchanged `delete_workspace()` keeps
working under its narrow deletion exception (Section 3.2). The same
condition means trusted operator SQL can also delete these rows; that's a
documented operator capability, not an application path.
`delete_workspace()` deletes revenue first (line 73 of
`20260803120000_safe_workspace_deletion.sql`) and runs as `postgres`. `revenues.appointment_id` is ON DELETE RESTRICT. Members can still
delete pending, cancelled and no-show appointments that have no visit and no
revenue (normal write).

When they do, the appointment's lines go with it through
`appointment_services` ON DELETE CASCADE. PostgreSQL runs the cascade as
`postgres`, the table owner, so `trg_appointment_services_a_editable` allows
the terminal-parent line DELETE of a cancelled or no-show appointment. That
is the documented second path in the 3.2 table, not a new capability: it
deletes only lines whose appointment is itself being deleted under this
guard.

This is **expected** behavior, and the cascade test (14, Lifecycle and
editing) must confirm it. If a cascade's triggers turned out to see the
member's role instead, members could no longer delete a cancelled
appointment with lines, and the approved deletion rule would break. PR 3b
then stops for review; nothing is weakened to make it pass.

### 4.5 `workspace_id` is immutable (U1)

- `trg_appointments_a_lifecycle` refuses any UPDATE where `NEW.workspace_id
  IS DISTINCT FROM OLD.workspace_id`, for **every role**, including
  `postgres` and SECURITY DEFINER functions. No Phase 5 function updates
  `workspace_id`.
  - For application-accessible roles this is enforced.
  - For a trusted operator it's a safeguard that a deliberate trigger bypass
    defeats (3.2).
- `save_appointment` takes the workspace only on **create**. On update it
  never changes it.
- **Client and staff workspace changes never transfer appointments:**
  - an appointment's `client_id` keeps pointing to the same client row;
  - S5's client move-side check (unchanged) refuses moving a client while
    appointments, visits or AI history in the old workspace reference it;
  - `workspace_staff.workspace_id` isn't client-updatable (S4 column grants);
  - no cascade or trigger rewrites `appointments.workspace_id`.
- S5's cross-workspace protections are unchanged.

### 4.6 `appointments.id` is immutable after INSERT

**Rule.** An appointment's `id` is set once, at INSERT (by its default or by
the inserting statement), and never changes afterwards.

- `trg_appointments_a_lifecycle` refuses any UPDATE where `NEW.id IS
  DISTINCT FROM OLD.id` with 42501, for **every role**: `authenticated`,
  `anon`, `service_role`, and `postgres`, including statements inside
  SECURITY DEFINER functions and triggers. It's the same check and the same
  trigger as `workspace_id` (4.5), from PR 2.
  - For application-accessible roles this is enforced.
  - For a trusted operator it's a safeguard that a deliberate trigger bypass
    defeats (3.2).
- **Every application-accessible path is covered,** because the check is a
  row trigger: a PostgREST `PATCH`, an upsert's conflict update
  (`INSERT … ON CONFLICT … DO UPDATE`), a multi-row UPDATE, `save_appointment`
  and every other SECURITY DEFINER function. A multi-row statement is
  refused at its first changed row and writes nothing.
- **No writer exists.** No Phase 5 function changes `id`; the protected-
  operations table (3.2) lists none, and the inventory refuses any entry that
  declares an `id` write or any appointment trigger that assigns `NEW.id`
  (C11, C12 (g); 3.4). `save_appointment` uses `id` only to find the row it
  updates.
- **INSERT is unchanged.** A member may still supply `id` when creating an
  appointment; the primary key and S5 apply as before.
- **Why the foreign keys aren't enough** (repository evidence):
  - `appointment_services.appointment_id` (ON DELETE CASCADE) and
    `visits.appointment_id` (ON DELETE SET NULL) have no ON UPDATE action
    (baseline migration, lines 848 and 948), so they're `NO ACTION`. From
    PR 1, `revenues.appointment_id` (ON DELETE RESTRICT) is the same.
  - `NO ACTION` is checked at the end of the statement. It refuses an `id`
    change that leaves a line, visit or revenue row pointing at an ID that
    no longer exists. It **doesn't** refuse one statement that swaps the
    IDs of two appointments: every reference still resolves, but now to the
    other appointment, possibly of another client.
  - `audit_logs.record_id` (written by `trg_appointments_audit`) has no
    foreign key, so a changed `id` would orphan the appointment's audit
    history. `files.entity_id` is polymorphic and has no foreign key either.
  - So integrity rests on this rule, not on foreign-key side effects or on
    the frontend (which never sends `id` in an update:
    `src/services/appointments.ts` uses it only as the `eq` filter).
- **Locks.** A refused attempt still row-locks the rows it reaches, in the
  key-strength mode, before the trigger runs (3.3, R-d; RD6).

### 4.7 `visits.id` is immutable after INSERT

**Rule.** A visit's `id` is set once, at INSERT, and never changes
afterwards. Same standard as `appointments.id` (4.6).

- **New trigger `trg_visits_a_id_immutable`** (BEFORE UPDATE, FOR EACH ROW,
  SECURITY INVOKER; function `public.visits_id_immutable()`, PR 2). It
  refuses any UPDATE where `NEW.id IS DISTINCT FROM OLD.id` with 42501, for
  **every role**: `authenticated`, `anon`, `service_role` and `postgres`,
  including statements inside SECURITY DEFINER functions and triggers and
  the UPDATE of a referential action. It reads nothing and takes no locks.
  - For application-accessible roles this is enforced.
  - For a trusted operator it's a safeguard that a deliberate trigger bypass
    defeats (3.2).
  - It fires on every UPDATE, not only `UPDATE OF id`, so it doesn't depend
    on the SET list. An unchanged `id` always passes, so normal visit edits
    are unaffected.
  - **Interaction with ON DELETE SET NULL.** `visits.appointment_id` is ON
    DELETE SET NULL (baseline migration, line 948). Deleting an appointment
    makes PostgreSQL run `UPDATE visits SET appointment_id = NULL` on its
    linked visits, as the owner of `visits` (`postgres`, 3.2). That UPDATE
    fires `trg_visits_a_id_immutable` (it passes: `id` is unchanged), S5's
    `trg_visits_same_workspace_refs` (it passes: it checks only a non-NULL
    `appointment_id`), and `trg_visits_audit`, which writes one UPDATE
    audit row for the visit. The SET NULL runs inside the DELETE statement,
    so the deletion and the SET NULL commit or roll back together. These are
    **expected** behaviors; the blocking SET NULL integration test (14)
    must confirm each. If the trigger refused the SET NULL, appointment
    deletion would break, and so would `delete_workspace()`. The PR running
    the test (PR 2 first) then stops for review; the rule isn't weakened to
    make it pass.
  - **Where the SET NULL is reached:**
    - **`delete_workspace()`, in every PR.** It deletes the workspace's
      appointments (line 84 of
      `20260803120000_safe_workspace_deletion.sql`) **before** its visits
      (line 85). The appointment DELETE therefore sets the visits'
      `appointment_id` to NULL, and the next DELETE removes those visits.
      Revenue is deleted first (line 73), so `revenues.appointment_id` (ON
      DELETE RESTRICT) doesn't block it.
    - **A member's appointment DELETE, in PR 2 only.** From PR 3b,
      `trg_appointments_a_delete_guard` refuses a member's DELETE of an
      appointment with a linked visit (4.4), so members no longer reach the
      SET NULL.
    - **`postgres` SQL, in every PR.** The delete guard allows `postgres`.
      That's the trusted operator path; the test uses it to exercise the
      SET NULL directly from PR 3b on.
  - Firing order: BEFORE ROW triggers fire alphabetically, so it runs before
    S5's `trg_visits_same_workspace_refs` and `trg_visits_same_workspace_move`.
    A later BEFORE trigger that assigned `NEW.id` would escape it, so the
    inventory refuses any trigger function on `visits` that writes `NEW.id`
    (C11, C12 (g); 3.4).
- **Every application-accessible path is covered:** a PostgREST `PATCH`, an
  upsert's conflict update, a multi-row UPDATE, and every SECURITY DEFINER
  function. `anon` sees no visit row (RLS), so its UPDATE matches nothing
  and the trigger never fires. A multi-row statement is refused at its first
  changed row and writes nothing.
- **No writer exists.** No existing or Phase 5 function updates `visits.id`;
  `complete_appointment` only inserts its visit. The protected-operations
  table (3.2) lists no writer. The app never sends `id` in a visit update:
  `updateVisitLog` uses it only as the `eq` filter
  (`src/services/visits.ts`), and the Beauty Passport payload has no `id`
  (`src/pages/BeautyPassport.jsx:205-214`).
- **INSERT is unchanged.**
- **Why the foreign key isn't enough** (repository evidence):
  - `revenues.visit_id` (to `visits.id`) is ON DELETE SET NULL with no ON
    UPDATE action (baseline migration, line 928), so it's `NO ACTION`. It's
    the only foreign key that references `visits.id`.
  - `NO ACTION` refuses an `id` change that leaves a revenue row pointing at
    a missing visit. It **doesn't** refuse one statement that swaps the IDs
    of two visits: every revenue row still resolves, but to the wrong visit,
    with no referential error. That's a silent financial-integrity failure.
  - `audit_logs.record_id` (written by `trg_visits_audit`) has no foreign
    key, so a changed `id` would orphan the visit's audit history.
- **Locks.** An UPDATE that names `visits.id` takes key-strength locks on the
  visit rows it reaches before the trigger runs. The only statements that
  take `FOR KEY SHARE` on visits are revenue writes (S5's
  `trg_revenues_same_workspace_refs` and the foreign-key check). No client
  role can write revenue (privilege, PR 1), and `complete_appointment`
  references only the visit it inserted in the same transaction, which no
  other transaction can see. So this adds no residual deadlock case
  (expected; checked by the visit ID concurrency test in 14).

---

## 5. Financial model

### 5.1 Calculations (per revenue row)

| Symbol | Meaning |
| --- | --- |
| *Pᵢ* | Final agreed line price for each service (VAT included in tax-inclusive mode) |
| **G** (`gross_amount`) | ΣPᵢ |
| **D** (`discount_amount`) | 0 ≤ D ≤ G |
| **T** (`tax_amount`) | VAT contained in the price, entered manually: 0 ≤ T ≤ G − D |
| **tip** (`tip_amount`) | ≥ 0 |
| **`service_revenue`** (computed) | `kind='service'`: **G − D − T**. `kind='no_show_fee'`: **0** |
| **`net_total`** = collected (computed, redefined) | `tax_inclusive`: **G − D + tip**. `tax_exclusive` (reserved): G − D + T + tip |

No-show fee rows: G = fee, **D = T = tip = 0** (CHECK).

### 5.2 Revenue and expense schema additions

| Table | Column / rule |
| --- | --- |
| `revenues` | `currency text NOT NULL` CHECK `^[A-Z]{3}$`; `timezone_snapshot text NOT NULL`; `pricing_mode text NOT NULL DEFAULT 'tax_inclusive'` CHECK in (`tax_inclusive`, `tax_exclusive`); `kind text NOT NULL DEFAULT 'service'` CHECK in (`service`, `no_show_fee`); `appointment_id uuid` references `appointments`, ON DELETE RESTRICT |
| `revenues` | CHECK `payment_method IN ('cash','card','bank_transfer','other')`; D ≤ G; T ≤ G − D; no-show rows D = T = tip = 0 |
| `revenues` | `net_total` redefined with `ALTER COLUMN … SET EXPRESSION` (Postgres 17; production and local run 17.6); new computed `service_revenue` |
| `revenues` | Unique `visit_id` WHERE NOT NULL; unique (`appointment_id`, `kind`) WHERE `appointment_id` IS NOT NULL |
| `revenues` | `trg_revenues_a_snapshot` (BEFORE INSERT, SECURITY INVOKER) sets `currency` and `timezone_snapshot` from the workspace (any supplied value is overwritten) and refuses if the workspace timezone fails the runtime check (8.2). `trg_revenues_b_immutable` (BEFORE UPDATE, **every role**) refuses changes to `currency` and `timezone_snapshot` |
| `revenues` | **INSERT, UPDATE and DELETE revoked from `authenticated`, `anon` and `service_role`** (U3; append-only). On application-accessible paths, rows are created only by `complete_appointment` and `collect_noshow_fee` (trusted operator access is outside this boundary, 3.2). SELECT under RLS is unchanged. |
| `workspaces` | CHECK `workspaces_currency_format_check`: `currency ~ '^[A-Z]{3}$'`, validated when the constraint is added (the PR 1 pre-check must first find zero rows that fail it; nothing is converted). It applies to every INSERT and UPDATE by **every role**, including `postgres`, because a CHECK constraint isn't a trigger and can't be skipped by disabling triggers. The default `'SAR'` passes. Members may still set the currency (an S1-allowed column), but only to a value in this format. |
| `expenses` | `currency text NOT NULL`, `timezone_snapshot text NOT NULL`: snapshotted on insert, immutable for **every role** (enforced for application-accessible roles; an operator safeguard for `postgres`, 3.2). `incurred_at` stays a **date**; its `CURRENT_DATE` default is replaced by a BEFORE INSERT fill of the workspace-local today when no value is supplied (a supplied date is kept). Members keep add, edit and delete under `expenses_access` and S5; **INSERT, UPDATE and DELETE revoked from `service_role`** (U3) |

The snapshot triggers read the workspace row as the caller. Members can read
their own workspace (`workspace_access`), and the S5 reference check already
guarantees the row's workspace is the caller's. SECURITY DEFINER inserts read
it as the owner.

### 5.3 Reporting

- `public.revenue_monthly_summary(ws uuid, months int)` (caller's rights, so
  RLS applies) returns `(month, currency, service_revenue, collected)`,
  grouped by `date_trunc('month', processed_at AT TIME ZONE
  timezone_snapshot)` and `currency`. It uses **the row's own snapshot**, not
  the workspace's current timezone, so historical rows never move between
  months.
- `public.expense_monthly_summary(ws uuid, months int)` returns `(month,
  currency, total)`, grouped by `date_trunc('month', incurred_at)` and
  `currency`.
  - `incurred_at` is the business's local date as entered.
  - It's never converted, so changing the workspace timezone never moves an
    expense between months.
  - The expense `timezone_snapshot` records the timezone that date was
    entered under; it doesn't affect grouping.
- **Business Engine (per currency, never across currencies):** service
  revenue, collected, expenses, **service revenue − expenses**, and
  **collected − expenses** over the same window. A currency with expenses but
  no revenue shows 0 revenue. The chart has a currency selector.
- **Stylist Dashboard:** this month's service revenue and collected, per
  currency.

---

## 6. Completion and no-show fees

### 6.1 `public.complete_appointment(p_id, p_lines, p_discount, p_tax, p_tip, p_payment_method)`

SECURITY DEFINER, hardened per Section 3.1, in the privileged write inventory.
In **one transaction**:

1. read the appointment's `workspace_id` without a lock (safe, U1),
   require `is_workspace_member(workspace_id)`, call
   `lock_appointment_workspace(workspace_id)` (3.3, R1), and only then lock
   the appointment `FOR UPDATE`;
2. **if it's already `completed`, return the existing `(visit_id,
   revenue_id)` unchanged** (idempotent; different amounts in a repeat call
   are ignored and this is documented);
3. require `confirmed`;
4. validate the amounts (Section 5.1). Each line must be one of the
   appointment's existing services;
5. write the final line prices to `appointment_services`. As `postgres` the
   staff check is skipped (4.3); the status rule still applies;
6. insert the **visit**:
   - `client_id` and `appointment_id` from the appointment;
   - `visit_date = (start_time AT TIME ZONE workspace timezone)::date`;
   - **`staff_id = COALESCE(assigned_staff_id, auth.uid())`**, with no
     active-membership recheck (approved Decisions Q2 and C);
7. insert the **revenue**: `kind='service'`, `appointment_id`, `visit_id`, G
   from the lines, D, T, tip, method; `currency` and `timezone_snapshot` set
   by trigger;
8. set the status to `completed` (status-only, so no staff check). The
   lifecycle trigger confirms the service revenue row exists.
9. The AFTER trigger `maintain_client_fields()` then (Sections 9 and 10):
   - because this transition is confirmed→completed, **advances**
     `last_visit_at` to the appointment's `start_time` only if that's later
     than the current value (or the current value is NULL). Otherwise it
     leaves the value untouched, including a historical value with no
     matching revenue row (Section 9);
   - recomputes `next_appointment_at`.

`complete_appointment` **never writes `clients` itself.** Backstops: unique
`visits(appointment_id)` WHERE NOT NULL; unique `revenues(visit_id)`. Any
failure rolls back everything.

### 6.2 `public.collect_noshow_fee(p_id, p_amount, p_payment_method)`

- SECURITY DEFINER, hardened, in the inventory.
- Same lock order as 6.1 step 1: unlocked `workspace_id` read, membership
  check, `lock_appointment_workspace`, then appointment `FOR UPDATE`. The
  lifecycle functions (`confirm_appointment`, `cancel_appointment`,
  `mark_appointment_noshow`) do the same.
- Only on `noshow` appointments; requires `amount > 0`.
- Inserts `kind='no_show_fee'`, `appointment_id`, G = amount, **D = T = tip =
  0**, with snapshots set by trigger.
- At most one fee per appointment (unique (`appointment_id`, `kind`)).
- Nothing is stored before collection.
- No client-field writes; no staff check.

### 6.3 Visit and Beauty Passport (Phase 4 closure)

- Unique `visits(appointment_id)` WHERE NOT NULL.
- `visits.id` is immutable after INSERT (4.7, from PR 2).
- `trg_visits_a_delete_guard` (SECURITY INVOKER) refuses deletes by
  `authenticated`, `anon` and `service_role` of a visit that revenue refers
  to.
- The `visit_date` default is replaced by the workspace-local today fill.
- The manual visit form keeps working, sends an explicit local date, and
  excludes appointments that already have a visit.
- **Manual visits never touch `last_visit_at`:** no trigger on `visits`
  writes `clients` (enforced by the catalog inventory, 3.4). The client-field
  guard would also refuse such a write: at depth 1, or as a non-`postgres`
  role, or through the value check.

---

## 7. Overlap prevention and staff listing

### 7.1 Overlap prevention: row-level trigger and statement-level recheck

The row-level trigger is `trg_appointments_b_overlap` (BEFORE INSERT OR
UPDATE, FOR EACH ROW, SECURITY INVOKER). It does the following:

1. **Staff check (Section 4.3):** on INSERT, and on UPDATE when any detail
   column changed.
2. **Workspace lock check (3.3, R1.3):** on every INSERT and UPDATE,
   `pg_try_advisory_xact_lock(k(NEW.workspace_id))`. It never waits; if it
   returns false, the trigger raises the dedicated lock-order error. (A
   hash collision between two workspaces only serializes them, harmlessly.)
3. **Per-row overlap check (early refusal):** when the **resulting** status
   is `pending` or `confirmed`, **and** (INSERT, or `start_time`,
   `end_time`, `assigned_staff_id` or `status` changed): refuse with a
   dedicated error code if another pending or confirmed appointment in
   `NEW.workspace_id` (excluding this row) overlaps on half-open `[start,
   end)` ranges **and** (either side is unassigned **or** both have the
   same `assigned_staff_id`).

**The statement-level recheck: the authoritative check.** PostgreSQL
doesn't allow transition tables on a trigger with more than one event, so
there are two SECURITY INVOKER triggers:

- `trg_appointments_c_overlap_recheck_ins`: AFTER INSERT FOR EACH
  STATEMENT, with `NEW TABLE`;
- `trg_appointments_c_overlap_recheck_upd`: AFTER UPDATE FOR EACH
  STATEMENT, with `OLD TABLE` and `NEW TABLE`.

An upsert fires both. Together they're called
`trg_appointments_c_overlap_recheck` below.

- It runs the same overlap rule for **every** active row in the transition
  table against the table's **final** state after the whole statement,
  including the other rows the same statement wrote.
- If any pair overlaps, it raises the same error and the whole statement
  rolls back.
- This makes multi-row correctness independent of how PostgreSQL shows a
  row trigger the changes from earlier rows of the same statement.
- The UPDATE trigger has no `UPDATE OF` column list, because PostgreSQL
  doesn't allow one with transition tables. It filters to rows whose
  `start_time`, `end_time`, `assigned_staff_id` or `status` changed by
  joining `OLD TABLE` to `NEW TABLE` on `id`.

**Why concurrent bookings can't both succeed:**

- The workspace advisory lock is held from before the first row is touched
  (3.3) until the transaction ends.
- Each check query in a VOLATILE trigger function takes a fresh READ
  COMMITTED snapshot after the lock is held, so it sees every committed
  competing booking.
- Two statements that would overlap each other, single-row or multi-row,
  are serialized, and the second one's checks see the first one's committed
  rows.

**Multi-row behavior (documented):**

- A multi-row INSERT or UPDATE whose rows overlap **each other** is refused
  as a whole.
- A multi-row UPDATE that's only valid in its *final* state (for example,
  swapping two same-staff appointments' times) may be refused by the
  per-row check, which can see the other row's old time. That's a safe
  false refusal: such a change must be made as separate requests. No
  overlapping state can ever commit.

**Changes made only through `appointment_services`** (adding or removing a
service) don't change the appointment's times by themselves. Recalculating
`end_time` is `save_appointment`'s job, and that update re-runs the overlap
check. A direct line change without a time change can't create a new overlap.

### 7.2 `public.list_workspace_staff(ws uuid) → TABLE(profile_id uuid, full_name text)`

- STABLE, **SECURITY DEFINER** (needed because profile RLS is own-row only;
  the policy is unchanged), `SET search_path = public`, schema-qualified.
- EXECUTE revoked from PUBLIC and `anon`, granted to `authenticated` only.
- If `NOT public.is_workspace_member(ws)` (which requires an **active**
  caller), raise 42501. The error is the same for a non-member and for a
  nonexistent workspace, so it can't be used to probe workspace IDs.
- Returns `p.id, p.full_name` from `public.workspace_staff s JOIN
  public.profiles p ON p.id = s.profile_id WHERE s.workspace_id = ws AND
  s.is_active`, ordered by `full_name`, then `id`.
- Read-only.
- **No other fields and no other workspaces.** The frontend staff selector
  uses only this function and isn't a security boundary: the triggers in 4.3
  and 7.1 validate every write.

---

## 8. Timezone and daylight-saving behavior

### 8.1 Storage

- All instants are `timestamptz` (UTC). This doesn't change.
- `visit_date` and `incurred_at` stay plain dates, meaning workspace-local
  dates.

### 8.2 Accepted timezone identifiers: `zone.tab` allowlist (U2, U4)

**Why a pattern match isn't enough.** The pattern match and
`pg_timezone_names` together prove only that a name **exists** in the
database's timezone data. Postgres lists primary zones and
backward-compatibility links alike (for example `Asia/Kolkata` and
`Asia/Calcutta`) and records no difference between them. Which names count
as canonical therefore needs an explicit source.

**Source (U4, decided in revision 4): IANA `zone.tab`.**

- `zone.tab` lists one or more identifiers per country (ISO 3166 code,
  coordinates, identifier, comment). It includes the familiar regional names
  people expect, for example `Europe/Amsterdam`, `Asia/Kuwait`,
  `Europe/Oslo` and `Asia/Kolkata`.
- Since tzdata 2022b, some of these names are links in IANA's main data, but
  IANA still lists them in `zone.tab` as the designated per-country
  identifiers.
- For this product, **"canonical" means "listed in `zone.tab`"**.
- Backward-compatibility names that `zone.tab` doesn't list (for example
  `Asia/Calcutta`, `America/Buenos_Aires`, and `Europe/Kiev` from the
  pinned release on) are **rejected**.

**Final policy.** A workspace timezone may be set only to:

1. `UTC`; or
2. an identifier listed in column 3 of `zone.tab` from the **pinned IANA
   release** (2022b or later, so `Europe/Kyiv` replaces `Europe/Kiev`) that
   **also** exists in the server's `pg_timezone_names`.

Everything else is rejected:

- names not in `zone.tab` (backward links such as `Asia/Calcutta`,
  `America/Buenos_Aires`, `Europe/Kiev`);
- abbreviations (`EST`, `CET`, `MST`, `HST`, `EET` …);
- `Etc/*`, including `Etc/UTC` and `Etc/GMT+3` (only the exact string `UTC`
  is accepted);
- `US/*`, `posix/*`, `right/*`;
- numeric offsets (`+03:00`, `UTC+3`);
- unknown names, differently cased names (`asia/riyadh`) and the empty
  string.

**Generation (reproducible, checked in, PR 1):**

1. The pinned release's `zone.tab` is copied, unmodified, to
   `supabase/timezone/zone.tab`. Next to it, `supabase/timezone/VERSION`
   records the release name (for example `2025b`), the source URL and the
   file's SHA-256.
   - The file is obtained by a person from the official IANA distribution
     and its signature is checked manually.
   - Nothing downloads it automatically in CI.
2. `scripts/generate-timezone-allowlist.mjs` (new):
   - reads that file;
   - skips comment and blank lines;
   - takes column 3 of each line;
   - keeps only names matching
     `^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)/[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$`
     (every `zone.tab` entry is expected to match; a non-match **fails**
     generation instead of being dropped silently);
   - adds `UTC`;
   - removes duplicates;
   - sorts by byte order;
   - prints the SQL array literal for the function below.
3. `public.canonical_timezone_names() → text[]` (IMMUTABLE, pinned
   `search_path`) returns exactly that literal, with the release name in a
   comment.

**Enforced rule:**

- `public.is_valid_workspace_timezone(tz text) → boolean` (STABLE, pinned
  `search_path`) is **true only if**:
  - `tz = ANY (public.canonical_timezone_names())`;
  - **and** `EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name =
    tz)` (convertible by this server).
- It's enforced by the `workspaces` BEFORE INSERT / BEFORE UPDATE OF
  `timezone` trigger (SECURITY INVOKER).
  - On UPDATE it checks **only when `NEW.timezone IS DISTINCT FROM
    OLD.timezone`**, so editing other columns of a workspace with an older
    value is never refused.
  - Members may still set the timezone (an S1-allowed column), but only to
    an allowlisted value.
- The `workspaces.timezone` column default must itself be on the allowlist
  (tested).

**Runtime check (keeps operations working):**

- The snapshot triggers and `save_appointment` require only that the stored
  workspace timezone **exists** in `pg_timezone_names`.
- Allowlist changes therefore never break appointment creation or financial
  inserts for a workspace whose zone still exists.
- The allowlist governs **setting** the timezone.

**Validation against PostgreSQL:**

- Local tests: every allowlisted name exists in `pg_timezone_names`.
- The PR 1 production pre-check (read-only):
  - every allowlisted name exists in production `pg_timezone_names`;
  - every current workspace timezone is on the allowlist;
  - the column default is on the allowlist.

  Any failure is a **blocker that stops PR 1 for manual review**.

**Tests:** Section 14, "Timezone allowlist" (examples consistent with
`zone.tab`).

**Updating when IANA data changes:**

1. **Trigger for a review:** a new IANA release, a Postgres upgrade, or a
   change in the server's tzdata. The allowlist test fails whenever an
   allowlisted name disappears from `pg_timezone_names`.
2. **Update:** a person replaces `supabase/timezone/zone.tab` and `VERSION`,
   runs the generator, and adds a **new migration** that replaces
   `canonical_timezone_names()`. The Vitest test fails if the migration's
   literal differs from the generator output for the checked-in file.
3. **Review the diff:**
   - added names need no action;
   - for each **removed** name, a read-only check counts workspaces that use
     it.
4. **Existing workspaces are never converted automatically.** A workspace
   whose name left the allowlist:
   - keeps its value and keeps working (runtime check);
   - can't be set to that value again;
   - is changed only through an explicitly approved, separate step.

   If a removed name also disappears from the server's `pg_timezone_names`,
   that workspace can no longer convert times. That's a **blocker** for the
   upgrade and needs a manual decision.
5. **Production pre-check for that migration (read-only):**
   - every name on the **new** list must exist in production
     `pg_timezone_names` (blocker);
   - every current workspace timezone must still exist there (blocker);
   - workspaces whose value isn't on the new list are **reported**, not
     blocked and not converted.

There's **no frontend copy of this rule**: there's no timezone-editing UI.
`updateWorkspace()`'s only caller is the Sidebar language switch, which sends
only `locale` (`src/components/Sidebar.jsx:154`). Any future settings UI must
rely on the database.

### 8.3 Local time entry: explicit resolution algorithm

`public.resolve_local_time(local timestamp, tz text) → timestamptz` (caller's
rights, pinned `search_path`). Plain `local AT TIME ZONE tz` (local time to
instant) is **not** used. Only instant-to-local conversion, which is never
ambiguous, is relied on:

1. `u₀ = local AT TIME ZONE 'UTC'`.
2. Offsets: `off(t) = (t AT TIME ZONE tz) − (t AT TIME ZONE 'UTC')` for `t ∈
   {u₀ − 48h, u₀, u₀ + 48h}`.
3. For each distinct offset *o*, the candidate is `cₒ = (local − o) AT TIME
   ZONE 'UTC'`.
4. Keep the candidates where `(cₒ AT TIME ZONE tz) = local`.
5. **None left:** raise `nonexistent_local_time`. **Otherwise:** return the
   **minimum** candidate (the earliest UTC instant, the first chronological
   occurrence).

- **Documented assumption:** at most one offset change within ±48 hours,
  true of current tz data and tested.
- **End time** = start instant + the services' durations.

### 8.4 Display, daily views and approved screens

- Display: `src/lib/workspaceTime.js` formats instants with
  `Intl.DateTimeFormat(…, { timeZone })`, converting **instant to local
  only**.
- A day key is the local date of the instant. "Today" is the workspace-local
  date of now.
- Daily views load a coarse UTC window and filter by local date. No local
  midnight is ever converted to an instant, so days with a skipped midnight
  are handled.

**Approved screens and fields (the only ones converted):**

| Screen | Fields |
| --- | --- |
| Appointments | entry, display, day tabs |
| Beauty Passport | appointment and visit dates, "client since" (`clients.created_at`), last visit (`clients.last_visit_at`) |
| Stylist Dashboard | "today", this month, last visit |
| Business Engine | months |
| RouteEngine | default date and display only (`route-planner` unchanged) |

### 8.5 Date classification

| Field | Kind | Handling |
| --- | --- | --- |
| `appointments.start_time` / `end_time` | instant | Entry via `resolve_local_time`; workspace-timezone display |
| `revenues.processed_at` | instant | Month by `timezone_snapshot` |
| `clients.created_at`, `clients.last_visit_at` | instant | Workspace-timezone display on the approved screens |
| `clients.next_appointment_at` | instant | Effective value (Section 10) |
| `visits.visit_date` | **date** | Never converted; set by completion from `start_time`; default replaced |
| `expenses.incurred_at` | **date** | Never converted; default replaced |
| `clients.date_of_birth` | **date** | Unchanged |
| Other timestamps and screens | — | **Unchanged in Phase 5** (Section 1.1) |

---

## 9. `clients.last_visit_at`

- **Sole application-accessible writer:** `maintain_client_fields()` (the
  AFTER trigger on `appointments`; SECURITY DEFINER, owned by `postgres`).
  Trusted operator access is outside this rule (3.2). Only on a
  **confirmed→completed** transition, it runs:

  ```sql
  UPDATE public.clients
     SET last_visit_at = NEW.start_time
   WHERE id = NEW.client_id
     AND (last_visit_at IS NULL OR last_visit_at < NEW.start_time)
  ```

  That's the **appointment's `start_time`** (when the service happened), not
  the completion time.
  - The `WHERE` clause matches the result of the earlier `GREATEST` form,
    but **issues no update at all** when the value wouldn't advance.
  - Completing an older appointment, or one with the same `start_time`,
    therefore leaves the row untouched.
  - That also covers a client whose **historical** `last_visit_at` (set
    before Phase 5) has no matching Phase 5 service revenue row: the
    historical value is kept, and the guard sees no change to check.
- **Historical values:** existing `last_visit_at` values are never
  re-validated, rewritten or cleared. They're only ever replaced by a later
  completed appointment's `start_time`.
- **Only reachable through successful completion:** the transition to
  `completed` requires the service revenue row (4.1). On
  application-accessible paths, only `complete_appointment` creates that
  row, in the same transaction.
- **Never decreases:** completed appointments are terminal and can't be
  deleted or rescheduled, so no decrease is ever needed.
- **Concurrency:** concurrent completions for one client serialize on the
  client row (`FOR NO KEY UPDATE`). Each update re-reads the current value
  after the lock and advances only if it's later, so the final value is the
  maximum whatever the order.
- **Guard:** `trg_clients_a_system_fields` (BEFORE INSERT/UPDATE, **SECURITY
  INVOKER**).
  - It raises 42501 if `last_visit_at` or `next_appointment_at` would
    differ from the old value (UPDATE), or be non-NULL (INSERT), **unless**
    `current_user = 'postgres'` **and** `pg_trigger_depth() >= 2` **and**
    the value check passes (Section 3.2, building block 5).
  - For `last_visit_at` the value check accepts only an advance to the
    `start_time` of a completed appointment of that client with service
    revenue. An unchanged value always passes, so a historical value is
    never refused.
  - Updates of every other client column are normal member writes and are
    unaffected.
- **Limitation (documented):** manual Beauty Passport visits **don't** update
  `last_visit_at`, because they have a date but no service instant.
- **Consumers:**
  - Beauty Passport and Stylist Dashboard: workspace-timezone display.
  - The AI assistant's "clients not seen recently" tool
    (`ai-assistant/index.ts:258-293`) reads it with **no code change** and
    starts seeing real data.

---

## 10. `clients.next_appointment_at`: stored value vs effective value

### 10.1 Definitions

| Term | Meaning |
| --- | --- |
| **Qualifying statuses** | `pending`, `confirmed`, defined once in SQL (`public.appointment_qualifying_statuses()`) and once in the frontend (`ACTIVE_APPOINTMENT_STATUSES` in `src/lib/appointmentView.js`). A structural test asserts they match. The overlap trigger and `route-planner` (`index.ts:431`) use the same set. |
| **Stored value** (`clients.next_appointment_at` column) | The earliest qualifying appointment with `start_time > now()` **as of the last relevant write**. Maintained only by the database. |
| **Effective value** | What readers use: the stored value if it's still `> now()`, otherwise derived live (10.3). |

### 10.2 Maintenance on writes

- `trg_appointments_z_client_fields`: AFTER INSERT / UPDATE OF (`start_time`,
  `end_time`, `status`, `client_id`) / DELETE row trigger.
- It runs `maintain_client_fields()`: **SECURITY DEFINER**, owned by
  `postgres`, pinned `search_path`, the only application-accessible writer of
  both fields.
- For the affected clients (`OLD.client_id`, `NEW.client_id`, de-duplicated,
  **in ascending ID order**):
  1. lock the client row **`FOR NO KEY UPDATE`**;
  2. on a confirmed→completed transition, advance `last_visit_at` only if
     the appointment's `start_time` is later (Section 9);
  3. compute `MIN(start_time)` over that client's qualifying appointments
     with `start_time > now()`, as a fresh statement after the lock;
  4. `UPDATE` only if the value differs, so no empty audit entries.
- These updates run as `postgres` inside a trigger. That's **expected** to be
  depth ≥ 2 for the guard, which tests D1–D8 (14.1) must confirm. The guard
  also value-checks the result (3.2, building block 5).
- Covers create, reschedule, confirm, cancel, no-show, complete, the client
  changing (pending only) and delete. Staff changes don't affect a client's
  next appointment, and workspace changes are impossible.

### 10.3 Read-time fallback (no writes)

`public.client_effective_next_appointment(p_client_ids uuid[]) →
TABLE(client_id uuid, effective_next_appointment_at timestamptz,
stored_value_was_stale boolean)`:

- caller's rights (**RLS applies**), STABLE, read-only (no INSERT, UPDATE or
  DELETE; asserted structurally);
- for each client: if the stored value is NULL or `> now()`, return it.
  Otherwise return the live `MIN(start_time)` over qualifying appointments
  with `start_time > now()`, and set `stored_value_was_stale = true`.
- **Correctness argument:**
  - A stored value `> now()` is still the earliest future qualifying
    appointment: any earlier future one would have existed at the last write
    (and been chosen), or was created later (which triggers a recompute).
  - A NULL stored value means none existed at the last write, and any new one
    triggers a recompute.
  - Only a stored value that has slipped into the past is stale.
- **All readers use only this function** (`src/services/clients.ts` →
  `getEffectiveNextAppointments`). The column is never selected directly for
  display. A Vitest/structural test fails if `next_appointment_at` is read
  anywhere else in `src/`.
- **No current UI consumer exists**: the column is excluded from client
  queries (`clients.ts:10`). Phase 5 adds no new display of it, and any later
  display must use this function.
- **The fallback never writes:** stored values are corrected only by the next
  relevant write.

---

## 11. Frontend changes

| File | Change |
| --- | --- |
| `src/lib/workspaceTime.js` (new) | Instant→local formatting, local day keys, workspace "today" |
| `src/lib/money.js` (new) | Display copies of the database formulas (Section 5.1), tested against the database |
| `src/lib/appointmentView.js` | Agreed prices, allowed actions, `ACTIVE_APPOINTMENT_STATUSES` |
| `src/services/appointments.ts` | Calls the new functions; workspace-local "today"; `setAppointmentServices` removed; never sends `workspace_id` on update |
| `src/services/clients.ts` | `getEffectiveNextAppointments` (only path to the effective value); `last_visit_at` read-only; never sends system fields |
| `src/services/{revenue,expenses,workspaces,visits}.ts` | Per-currency summaries; expense add/edit/delete; `getWorkspaces` also selects `timezone` and `currency`; visit form rules |
| `src/pages/Appointments.jsx` | Action buttons per status; editing matrix (client locked once confirmed; no workspace field); **staff selector via `list_workspace_staff`** (PR 3c); agreed prices; notes kept on edit; delete rules; overlap, staff and nonexistent-time errors; workspace-timezone entry and display |
| `src/components/appointments/CheckoutDialog.jsx` (new) | G, D, VAT amount, tip, 4 payment methods, live breakdown (gross / discount / VAT / service revenue / tip / collected), disabled while submitting |
| no-show fee dialog (new) | Amount and method only (T = 0) |
| `src/components/business/ExpenseForm.jsx` (new) | Amount, free-text category, description, local date (default workspace today), optional receipt URL |
| `src/pages/BeautyPassport.jsx` | Auto-created visits shown and editable; manual form rules; workspace-timezone dates; photo URLs unchanged |
| `src/pages/StylistDashboard.jsx` | Local "today"; per-currency service revenue and collected |
| `src/pages/BusinessEngine.jsx` | Per-currency metrics including both nets; currency selector |
| `src/pages/RouteEngine.jsx` | Local default date and display |
| `src/lib/i18n.js`; `src/lib/supabase-types.ts` | Labels; types regenerated **from the local database only** |
| `src/lib/monthSeries.js` | Retired (monthly reporting is server-side) |

---

## 12. PR plan and dependencies

| PR | Scope | Depends on |
| --- | --- | --- |
| **0** (optional) | Documentation refresh (`PROJECT_ROADMAP.md`, `HANDOVER.md`) | — |
| **1** | **Inventory and CI contract first (3.4):** `supabase/security/privileged_writers.json` seeded from the catalog with **every** existing application function and trigger (each reviewed, hash-pinned, with declared writes; `delete_workspace()` recorded with its narrow deletion exception) and the `rls` section (every covered table's RLS state and every existing policy, recorded as-is, with no policy change), `scripts/check-privileged-inventory.mjs` with its negative fixtures (C1–C18), and a CI job that runs it plus the local RLS suites against the local Supabase stack. **Financial and timezone foundations:** `supabase/timezone/zone.tab` + `VERSION`, `scripts/generate-timezone-allowlist.mjs`, `canonical_timezone_names()`, `is_valid_workspace_timezone()` and the `workspaces` trigger; revenue and expense columns (`currency`, `timezone_snapshot`, `pricing_mode`, `kind`, `appointment_id`); snapshot and immutability triggers; CHECKs, including the `workspaces.currency` format CHECK (5.2); `net_total` / `service_revenue`; uniqueness rules; `incurred_at` default; revenue INSERT/UPDATE/DELETE revoked from `authenticated`, `anon` and `service_role`; expense writes revoked from `service_role`; S5 extension (`same_workspace_revenue_refs` checks `appointment_id`; `same_workspace_appointment_move` refuses moving an appointment referenced by revenue elsewhere); inventory entries for every new object. Database, scripts and CI only. | — |
| **2** | `trg_appointments_b_overlap` (staff check 4.3, the non-blocking workspace-lock check and per-row overlap check, 7.1); **the lock strategy of 3.3:** `lock_appointment_workspace(ws)`, the statement-level lock triggers `trg_appointments_0_workspace_locks` and `trg_appointment_services_0_workspace_locks` (which also refuse direct `anon` / `service_role` appointment and line writes), and the statement-level recheck triggers `trg_appointments_c_overlap_recheck_ins` / `_upd`; **`workspace_id` and `appointments.id` immutability** (4.5, 4.6, in an early version of `trg_appointments_a_lifecycle`) and **`visits.id` immutability** (4.7, `trg_visits_a_id_immutable`), with their tests (14), including the blocking visit ON DELETE SET NULL integration test; the inventory's `locks_workspace_first` values, `delete_workspace()`'s `r1_exception` entry (the inventory only; the function is unchanged) and C12's R1 rules (c)–(f) and the `id` rule (g) for both tables, and the C11 `id` tripwire, with their fixtures (3.4); the race harness with the controls C-A and C-B, the tests M1–M13 for the writers that exist in PR 2, RC1–RC5 for the direct-write pairings, and RD1–RD6 (14.2); error messages in the current form | 1 |
| **3a** | **First step, before any other PR 3a code: the trigger-depth prerequisite tests D1–D8 (14.1); if any fails, PR 3a stops and the trust model returns for review.** **Client-field integrity:** `trg_clients_a_system_fields` guard (role, depth and value check; other client columns unaffected); `maintain_client_fields()` / `trg_appointments_z_client_fields` (`next_appointment_at`); `client_effective_next_appointment()`; `appointment_qualifying_statuses()`; `ACTIVE_APPOINTMENT_STATUSES` and its structural test; `getEffectiveNextAppointments` in `clients.ts`; inventory entries for every new object; the residual tests RA and RB, and M3 and M9's client-field checks (14.2). Database plus service layer; no UI change. | 2 |
| **3b** | Lifecycle (4.1), the full editing matrix (4.2) including `trg_appointment_services_a_editable` and staff validation for line changes (4.3), delete guards (4.4, 6.3), `appointments.status` UPDATE revoked from all client roles including `service_role`, `resolve_local_time`, `save_appointment`, **workspace-timezone entry, display and daily views** (Section 8), `visit_date` default; Appointments UI; the cascade test (4.4, 14), M7 (b), and the 3b pairings of M8, M10, RC1 and RD4; RD1–RD6 re-run with the delete guard; the ID immutability and SET NULL tests re-run (14) | 3a |
| **3c** | `list_workspace_staff(ws)` and the staff selector | 3b |
| **4** | Completion and checkout (6.1); the `last_visit_at` branch of `maintain_client_fields()` (Section 9); the lifecycle rule "completed requires service revenue"; Beauty Passport closure (6.3); the completion pairings of M8, RC1, RC2 and RD4; RD1–RD6 re-run with the unique `visits(appointment_id)`; the ID immutability and SET NULL tests re-run (14) | 1, 3a, 3b |
| **5** | No-show fee collection (6.2); its pairings in M8, RC1 and RD4; the ID immutability and SET NULL tests re-run (14) | 1, 3b |
| **6** | Reporting functions (5.3), expense UI, dashboards (both nets per currency) | 1, 4 |

### 12.1 Why PR 3 is split three ways

In revision 1, `next_appointment_at` maintenance was in the later half of
PR 3. Approved Decision D requires a pre-check finding **zero** discrepancies
between stored and computed values before maintenance begins.

The conflict: any appointment created while the first half was live, but
before maintenance existed, would leave the stored value (NULL) different
from the computed one. The pre-check would then **fail from normal use**, and
Decision D forbids repairing it automatically.

**Resolution:** client-field integrity moves **first**, to PR 3a, and runs the
Decision D pre-check immediately before it. From the moment it's live, every
appointment write keeps the stored value current. The remaining PR 3 work is
split into 3b (rules and timezone) and 3c (staff listing). The approved scope
is unchanged, and so is every other approved dependency: overlap (PR 2)
before confirmed edits (3b), snapshots (PR 1) before revenue (PR 4), and the
client guard (3a) before `last_visit_at` maintenance (PR 4).

### 12.2 Intermediate states (no bypass windows)

| Between | State | Why nothing can bypass |
| --- | --- | --- |
| PR 1 → 2 | Revenue and expense schema in place; no revenue can be inserted by any client role (privilege). Old UI unchanged. | Privileges are enforced by the database. |
| PR 2 → 3a | Old UI: free status select, notes bug, non-atomic services. **Overlap, active-staff checks, `workspace_id`, `appointments.id` and `visits.id` immutability and the 3.3 lock strategy enforced on every write, single-row or multi-row.** | All of these are triggers, so every path is checked, including the old UI and direct (bulk) API calls. Direct `anon` / `service_role` appointment and line writes are refused from this point. Client fields are still writable directly by members (the gap that existed before Phase 5); nothing maintains them yet. |
| PR 3a → 3b | Old UI still. **Client fields guarded and maintained**, so every appointment write updates `next_appointment_at`; direct writes to either field are refused for every client role. | The guard and maintenance are triggers, independent of the UI. No `last_visit_at` writer exists yet (it arrives in PR 4), so the field stays as it is. |
| PR 3b → 3c | New lifecycle and editing UI with workspace timezone; **no staff selector**. Staff can be set only through `save_appointment` or the API, validated by the triggers. | Staff validation is a trigger (4.3); a missing selector only removes a UI option. |
| PR 3c → 4 | Full appointment UI; status can't reach `completed`, because `complete_appointment` doesn't exist and no client role has `status` UPDATE privilege. | The privilege revoke (3b) and the transition trigger leave no path to `completed` before PR 4. |
| PR 4 → 5 | No-shows can be marked but fees can't be collected. | No client role can insert revenue; `collect_noshow_fee` doesn't exist yet. |
| PR 5 → 6 | Revenue and expense data exist; dashboards still use the pre-Phase-5 queries. | Dashboard totals are read-only. Expenses can't be added through the UI before PR 6; the API path is under the existing RLS and S5 rules and the PR 1 snapshot triggers. |

**Process (every PR):**

1. review;
2. local validation: the migration inside rolled-back transactions, the
   full RLS suite, the race runner, structural tests, **the catalog inventory
   check (3.4) with an updated, reviewed inventory**, the full Vitest suite,
   lint, build, bundle budget, `git diff --check`, and an identical
   deterministic local fingerprint afterwards;
3. the read-only production pre-check;
4. dry run;
5. **explicit approval**;
6. `db push`;
7. verification script;
8. a runbook in `docs/security/phase5-<pr>/` (pre-check plus emergency
   rollback).

---

## 13. Production pre-checks (read-only aggregates; any blocker stops the PR for manual review)

| PR | Check (must hold) |
| --- | --- |
| 1 | `revenues` rows = 0 and `expenses` rows = 0; **workspaces whose `currency` doesn't match `^[A-Z]{3}$` = 0** (no conversion; any hit stops the PR); **workspaces whose timezone isn't on the `zone.tab` allowlist = 0** (no conversion; any hit stops the PR); **allowlisted names missing from production `pg_timezone_names` = 0**; the `workspaces.timezone` default is allowlisted; **the production catalog's application functions and triggers (with definition hashes), and every RLS policy and table RLS enabled/forced state on the covered tables, match the local database built from the same migrations** (read-only catalog queries, which also confirm the inventory seed, including the `rls` section); Postgres ≥ 17; S5 verification 20/20 |
| 2 | Active (pending or confirmed) overlapping pairs under Section 7.1 = 0; assigned staff (on active appointments) who aren't active members = 0; existing statement-level triggers on `appointments` and `appointment_services` (catalog, informational, so the new statement triggers' firing order is known); existing BEFORE ROW triggers on `visits` (catalog, informational, so `trg_visits_a_id_immutable`'s firing order is confirmed) |
| 3a | **Clients whose stored `next_appointment_at` differs from the computed value = 0** (Decision D); clients with non-NULL `last_visit_at` (informational); the production catalog matches the reviewed inventory (functions, triggers, hashes, privileges, **RLS policies and table RLS state**; C1–C18) |
| 3b | Counts by status (informational); verification of PR 3a passes (the maintenance trigger is enabled) |
| 3c | Verification of the previous PRs passes |
| 4 | Appointments with more than one linked visit = 0; completed appointments with no visit (informational; **no backfill**) |
| 5–6 | Verification of the previous PRs passes |

Never backfill, recompute, overwrite or delete existing production records
automatically.

---

## 14. Test plan

All database tests are local RLS SQL tests in rolled-back transactions,
unless marked otherwise. **"Direct API write"** means the statement runs as
`SET LOCAL ROLE authenticated` (or `anon`, or `service_role`) with
`request.jwt.claims` set, which is exactly how PostgREST runs it. Race tests
extend `scripts/test-cross-workspace-races-local.sh`.

| Area | Tests |
| --- | --- |
| **Timezone allowlist (PR 1)** | **Accepted (all listed in `zone.tab`):** `UTC`, `Asia/Riyadh`, `Asia/Kolkata`, `Asia/Kuwait`, `Europe/Kyiv`, `Europe/Amsterdam`, `Europe/London`, `America/Argentina/Buenos_Aires`, `Australia/Lord_Howe`. **Rejected:** names not in `zone.tab` (`Asia/Calcutta`, `America/Buenos_Aires`, `Europe/Kiev`); `EST`, `CET`, `MST`; `Etc/GMT+3`, `Etc/UTC`; `US/Eastern`; `posix/Asia/Riyadh`; `+03:00`, `UTC+3`; `asia/riyadh`; `Asia/Nowhere`; `''`. A direct invalid UPDATE is refused; **an UPDATE of another workspace column on a workspace whose stored timezone isn't allowlisted succeeds and leaves the timezone unchanged** (no conversion). **Every allowlisted name exists in `pg_timezone_names`** (fails on tz-data drift). The `workspaces.timezone` default is allowlisted. **Generator (Vitest):** output from the checked-in `zone.tab` equals the migration literal exactly; the SHA-256 in `VERSION` matches the file; every `zone.tab` entry matches the region pattern (a non-match fails); output is sorted and de-duplicated and contains `UTC`. The runtime check accepts an existing but non-allowlisted zone for operations (snapshots, `save_appointment`), simulated by setting the workspace timezone with the validation trigger disabled inside the rolled-back transaction. |
| **Financial (PR 1)** | Every CHECK; **workspace currency format:** an UPDATE of `workspaces.currency` to `sar`, `SA`, `SARR`, `S4R`, `' SAR'` or `''` is refused (23514) as `authenticated` (direct API), as `service_role` and as `postgres`, and an INSERT with such a value is refused (23514) as `service_role` and as `postgres` (members create workspaces only through `bootstrap_professional_workspace()`, which doesn't set `currency`); an UPDATE to `USD` succeeds for a member; an UPDATE of another workspace column succeeds; `bootstrap_professional_workspace()` still creates a workspace with the default `SAR`; both formulas; no-show rows: service revenue 0; uniqueness rules; snapshots set by trigger (supplied values overwritten), immutable for **every role** (`authenticated`, `service_role`, `postgres`); unchanged after a workspace currency or timezone change; **revenue INSERT, UPDATE and DELETE refused for `authenticated`, `anon` and `service_role`** (direct API); **expense writes refused for `service_role`** and allowed for members; `incurred_at` default = local today (23:30 UTC for Asia/Riyadh → next day); cross-workspace `appointment_id` refused (S5 suite plus a race); S1 and S4 suites unaffected |
| **Workspace immutability (PR 2)** | `UPDATE appointments SET workspace_id = <other>` refused as `authenticated` (direct API), as `service_role`, as `postgres` (SQL), and **inside a SECURITY DEFINER function** (a test-only SECURITY DEFINER function owned by `postgres` and granted to `authenticated` inside the rolled-back transaction, called by a member). `save_appointment` can't change it. A client or staff workspace change (where S5 permits one) leaves every appointment's `workspace_id` unchanged. The S5 suite is unchanged and passing. |
| **Appointment ID immutability (PR 2; re-run in 3b, 4 and 5; mandatory negative tests, 4.6)** | **Fixture:** appointment A with two lines, a visit and a revenue row with `appointment_id` = A and `visit_id` = A's visit (the revenue row is inserted by the test setup as `postgres`, since no client role can insert revenue), its `audit_logs` rows, and appointment B of the same workspace with one line; plus an appointment C with no linked rows. Before each attempt the test records S0: A's, B's and C's IDs, and the ID and reference columns of every line, visit, revenue and audit row that refers to them. **Each of these is refused, and leaves S0 exactly unchanged:** (1) as `authenticated`, a direct API `PATCH` of A's `id`, single-row; a multi-row `PATCH` changing the IDs of A and C; a statement swapping the IDs of A and B (`SET id = CASE …`), which the foreign keys alone would allow; C's `id` changed on its own (no linked rows, so no foreign key would object); and an upsert on A whose conflict update sets a different `id` (`INSERT … ON CONFLICT (id) DO UPDATE SET id = <new uuid>`, run as SQL under `SET LOCAL ROLE authenticated`) — each refused with 42501 and the 4.6 message; (2) as `anon` and as `service_role`, the same statements: refused with 42501 by the statement-level lock trigger (R1.1), before any row is touched; S0 remains unchanged; (3) as `postgres` in plain SQL (no trigger bypass): `UPDATE appointments SET id = …` for A and for C, and the swap — refused (operator safeguard, 4.6); (4) **inside a SECURITY DEFINER function:** a test-only function owned by `postgres` and granted to `authenticated` inside the rolled-back transaction, which calls `lock_appointment_workspace` and then updates A's `id`, called by a member — refused with the 4.6 message, not by the lock rules; (5) from PR 3b, `save_appointment` called with any input can't change `id` (it locates the row by `id` and never writes it). From PR 3b, 4 and 5, the same SECURITY DEFINER attempt is repeated after each lifecycle function, `complete_appointment` and `collect_noshow_fee` is called on its own fixture appointment in the status required by that function. The attempt to change the ID of A and of the respective fixture appointment must still be refused. **After every attempt:** A, B and C exist with their S0 IDs; every line, visit, revenue and audit row that referred to A, B or C still refers to the same ID; no row was added or removed; no new `audit_logs` row records an `id` change. **Allowed:** an UPDATE that names `id` with its unchanged value (`SET id = id, notes = …`) succeeds and changes only `notes`; INSERT with a supplied `id` succeeds as before. |
| **Visit ID immutability (PR 2; re-run in 3b, 4 and 5; mandatory negative tests, 4.7)** | **Fixture:** visits V1 and V2 of one workspace, each referenced by its own revenue row R1 and R2 (`revenues.visit_id`; inserted by the test setup as `postgres`, since no client role can insert revenue), with their `audit_logs` rows; plus visit V3 with no revenue. Before each attempt the test records S0: the IDs of V1–V3 and R1–R2, every `revenues.visit_id`, and the `record_id` of every audit row for V1–V3. **Each of these is refused and leaves S0 exactly unchanged:** (1) as `authenticated` (direct API): a single-row `PATCH` of V1's `id`; V3's `id` changed on its own (no revenue, so no foreign key would object); a multi-row `PATCH` changing the IDs of V1 and V3; a statement swapping the IDs of V1 and V2 (`SET id = CASE …`), which `revenues.visit_id` alone would allow; an upsert on V1 whose conflict update sets a different `id` (`INSERT … ON CONFLICT (id) DO UPDATE SET id = <new uuid>`, as SQL under `SET LOCAL ROLE authenticated`) — each refused with 42501 and the 4.7 message; (2) as `service_role` (bypasses RLS): the same statements, refused with 42501 by the trigger; (3) as `anon`: the same statements match no row (RLS), update nothing and raise no error, and S0 is unchanged; (4) as `postgres` in plain SQL (no trigger bypass): the single-row change, the multi-row change and the swap, refused (operator safeguard, 4.7); (5) **inside a SECURITY DEFINER function:** a test-only function owned by `postgres` and granted to `authenticated` inside the rolled-back transaction, which updates V1's `id` and, separately, swaps V1 and V2, called by a member — refused; from PR 4, the same function called after `complete_appointment` in the same transaction, on the visit it just created, is still refused. **After every attempt:** V1–V3 exist with their S0 IDs; R1 and R2 still reference V1 and V2; every audit row for V1–V3 keeps its `record_id`; no row was added or removed; no new `audit_logs` row records an `id` change. **Allowed:** a visit UPDATE that keeps `id` (including `SET id = id`) succeeds; the visits' ON DELETE SET NULL of an appointment DELETE still succeeds (the SET NULL integration test, next row); INSERT is unchanged. **Concurrency (expected: no new residual, 4.7; from PR 4):** a multi-row `SET id = id, summary_notes = …` visit UPDATE vs `complete_appointment` in the same workspace, at least 200 iterations per start order: zero `40P01`, otherwise the PR stops for review. |
| **Visit ON DELETE SET NULL integration (PR 2; re-run in 3b, 4 and 5; blocking, 4.7)** | **Fixture:** in workspace W, appointment A with linked visit VA (`visits.appointment_id` = A), its audit rows, no revenue referencing A, and a visit VB in W with no appointment. Before each case the test records S0: A's row, VA's full row (every column), VB's full row, and the IDs and contents of every existing `audit_logs` row for A, VA and VB. **Cases:** (1) **member path, PR 2 only:** `DELETE` of A as `authenticated` (direct API), single-row, and in a second run as part of a multi-row DELETE with another appointment that has a linked visit (whose visit must meet the same requirements as VA); (2) **`delete_workspace(W)`, every PR:** called by W's owner; (3) **`postgres` SQL, every PR** (from PR 3b the only direct way to reach the SET NULL, since the delete guard refuses members): `DELETE FROM appointments WHERE id = A`; (4) **from PR 3b, the member DELETE of A is refused** by the delete guard (42501). **Required for (1) and (3), checked in the same transaction after the DELETE:** A no longer exists; VA still exists with **the same `id`** and `appointment_id` IS NULL, and every other column of VA equals S0; VB equals S0; no error from `trg_visits_a_id_immutable` or any other trigger; every `audit_logs` row from S0 is unchanged (same IDs, same `record_id`, same contents); the only new audit rows are **one** `DELETE` row for A and **one** `UPDATE` row for VA whose `record_id` = VA's `id`, whose `old_value` and `new_value` differ only in `appointment_id` (A → NULL) and whose `id` is unchanged. **Required for (2):** the call succeeds; A, VA and VB are deleted (the visits by the function's later visit DELETE); no trigger error at any step, in particular none from `trg_visits_a_id_immutable` during the appointment DELETE's SET NULL; `supabase/tests/workspace_deletion_flow.sql` still passes unchanged. **Required for (4):** A, VA and the audit rows equal S0. **Atomicity (cases (1) and (3)), two injected failures, each in its own transaction with test-only triggers created inside it:** (a) a BEFORE UPDATE trigger on `visits`, named to fire after `trg_visits_a_id_immutable`, that raises when `NEW.appointment_id IS NULL AND OLD.appointment_id IS NOT NULL`. That makes the SET NULL itself fail: the DELETE must fail with that error, and afterwards A exists, VA equals S0 (still referencing A, same `id`), and no audit row was added; (b) an AFTER DELETE trigger on `appointments` that raises. That fails the statement after the row delete: the same post-state as (a) is required. The test fails if any case leaves A deleted while VA still references it, VA with a changed `id`, a partial audit trail, or a refused SET NULL. |
| **Overlap (PR 2)** | The 4 combinations (unassigned/unassigned, unassigned/assigned, same staff, different staff allowed); inactive statuses never block; touching boundaries allowed; concurrent overlapping writes yield one success (race); **all multi-row cases in 14.2** |
| **Staff validation (PR 2, 3b)** | On **every detail edit** (client while pending, start/end, location, assigned staff, and **each `appointment_services` INSERT/UPDATE/DELETE**), via both **`save_appointment` and direct API writes**: refused when the resulting staff member is inactive or a non-member; allowed when active or NULL. **Notes-only edits allowed** with inactive staff. Status-only transitions (confirm, cancel, no-show) **allowed** with inactive staff. Completion's line-price write allowed with inactive staff **only** as `postgres` inside `complete_appointment`; the same write as `authenticated` or `service_role` is refused. |
| **Trust model and spoofing (PR 3a, 3b, 4)** | (1) Direct API writes of `last_visit_at` / `next_appointment_at` (INSERT with values; UPDATE) refused as `authenticated`, `anon` and `service_role`. (2) A `postgres` UPDATE at depth 1 (plain SQL, and inside a test-only SECURITY DEFINER function) refused. (3) **Spoofing:** an `authenticated` session that sets arbitrary custom settings (including the retired `beautyroute.trusted_operation`) and then calls every exposed function (`confirm_appointment`, `cancel_appointment`, `mark_appointment_noshow`, `complete_appointment`, `collect_noshow_fee`, `list_workspace_staff`, `save_appointment`, the reporting and effective-value functions) gains no protected write. (4) **Nested calls:** see D4–D5 (14.1). (5) **Error and rollback:** after a `complete_appointment` that fails part-way (injected), nothing it wrote remains, and the next statement in a new transaction has no elevated ability (also D6–D7). (6) **Authorized paths succeed:** `complete_appointment` (visit, revenue, status, `last_visit_at`, `next_appointment_at`), `collect_noshow_fee`, and the maintenance trigger after create, reschedule and cancel. (7) **Value check:** a `postgres` write at depth ≥ 2 (a test-only trigger) of a **wrong** `next_appointment_at` is refused, and so is a `last_visit_at` that's lower, NULL, or matches no completed appointment with service revenue. An **unchanged** historical value passes (L2). (8) **Protected columns and operations, application-accessible paths only (inventory, 3.2):** reached as `authenticated`, `anon` or `service_role`, through every granted function, the client system columns change only through `maintain_client_fields()`; the staff-check exemption for `appointment_services` applies only inside `complete_appointment`; revenue is inserted only by `complete_appointment` and `collect_noshow_fee`; protected deletes happen only through `delete_workspace()`, apart from the lines' cascade of a permitted appointment DELETE (4.4), which removes only lines of the appointment being deleted; every guard function is SECURITY INVOKER. These tests make **no claim about trusted operator access**. |
| **Operator boundary (PR 1, 2, 3a, 3b; documentation of safeguards, not a security test)** | As `postgres` in plain SQL (no trigger bypass), the safeguards fire: a snapshot change is refused; a `workspace_id` change is refused; an `appointments.id` or `visits.id` change is refused; a client system column change at depth 1 is refused; a status change to `completed` without a service revenue row is refused. The test file states that these are **operator safeguards**, and that the owner can bypass them by disabling triggers. No test asserts that the operator *can't* write revenue, delete protected rows or edit lines. The **production catalog comparison** (13) detects changed functions or triggers and **disabled required triggers** (C2, C4), and is run by every verification script. |
| **Normal authorized writes preserved (PR 3a, 3b, 4)** | As a member (direct API and through the app's service functions): create a client without system fields; **update every non-system client column** (name, phone, notes and the rest), including on a client that has appointments and a non-NULL `last_visit_at`; delete a client under the existing rules. **Insert, update and delete `appointment_services` lines on pending and confirmed appointments** (active or no staff), through `save_appointment` and directly. Create, edit and delete appointments as the editing matrix allows; manual visits; expense add, edit and delete. Each succeeds, and the system columns are unchanged afterwards except through the maintenance trigger. The Clients page's create and update succeed (Vitest plus SQL). |
| **Inventory contract (PR 1, then every PR)** | The check passes on the database built from all migrations. **Negative fixtures**, each created inside a rolled-back transaction, must make it **fail**: C1 an uninventoried invoker function, and an uninventoried definer function; C2 a one-character change to an inventoried function, a changed owner, a changed `search_path` and an added EXECUTE grant; C3 a function in a language other than `plpgsql`/`sql`, if one is available locally (otherwise the check's language rule is unit-tested in Vitest against catalog rows); C4 an extra trigger, a disabled required trigger, and a trigger pointing at a different function; C5 **negative:** a definer function owned by another role (failing even with a `c5_exceptions` item for it); a definer function with an explicit `anon` grant and no exception; a definer function executable by PUBLIC and no exception; a definer function with `search_path` other than `public` and no exception; an **unregistered** exception (an entry not in the C5 exception register, including a seventh function); a **stale `anon_explicit`** exception (the explicit `anon` grant revoked inside the transaction while the exception remains); a **stale `public_default`** exception (EXECUTE revoked from PUBLIC while the exception remains); an exception **missing its reason** and one **missing its evidence**; an exception on a **non-SECURITY DEFINER** function; an **unauthorized `search_path` exception** (on any function other than `rls_auto_enable()`); and an exception for a condition the register doesn't list for that function. C5 **positive:** the six registered functions, each with exactly its registered conditions, pass, and removing any one of their exceptions makes the check fail; C6 a rule on `clients`; C7 a non-`security_invoker` view over `revenues`; C8 a trigger on an application table calling a function in another schema; C9 an INSERT grant on `revenues` to `service_role`, and an UPDATE (`status`) grant to `authenticated`; C10 a guarded table owned by another role; C11 a definer function using `EXECUTE format(...)` that writes `clients`, a function that calls an undeclared callee, and a function naming `revenues` with an undeclared INSERT; C12 a callee whose declared writes exceed its caller's entry; from PR 2 (**`appointments.id`, C11 and C12 (g)**): a definer function whose entry declares an UPDATE of `appointments` column `id`; an entry declaring an `appointments` UPDATE with no column list; a test-only BEFORE UPDATE trigger on `appointments`, named to fire after `trg_appointments_a_lifecycle`, that assigns `NEW.id` (declared: C12 (g); undeclared: C11 and the declared-writes mismatch), in one variant for each assignment form C11 lists (`NEW.id :=`, `NEW.id =`, `NEW :=`, `SELECT … INTO NEW.id`, `SELECT … INTO NEW`, and `RETURN` of another record), each in lower case, upper case and the quoted `"NEW"."id"` form, each of which must fail; the same comparison text inside a comment or string literal must not match; the real `trg_appointments_a_lifecycle` function and `visits_id_immutable()` must pass (positive fixtures, so the tripwire raises no false positive on the guards); a function body updating `appointments` with `id` in its SET list but declaring no such write (C11); and a version of `trg_appointments_a_lifecycle`'s function with the `id` clause removed (C2, hash mismatch); the same four fixtures for `visits` (an entry declaring an UPDATE of `visits` column `id`; a `visits` UPDATE declared with no column list; a test-only BEFORE UPDATE trigger on `visits`, named to fire after `trg_visits_a_id_immutable`, that assigns `NEW.id` (the same assignment-form variants); an undeclared `visits` `id` UPDATE in a body); a changed `visits_id_immutable()` (C2); and `trg_visits_a_id_immutable` removed or disabled (C4); and, from PR 2 (lock rule R1), each of these: an appointment-writing function with `locks_workspace_first` missing or `"not_applicable"`; an `"explicit"` entry that doesn't declare `lock_appointment_workspace` as a callee; a `"statement"` trigger function also attached to `visits`; `"reviewed_exception"` on any function other than `delete_workspace(uuid)`; the `delete_workspace()` entry with its `r1_exception` removed, with a field missing, or with an added appointment UPDATE or `FOR UPDATE` lock; an `r1_exception` object on another entry; and a new function declaring `delete_workspace()` as a callee. The positive case, the real `delete_workspace()` entry, must pass. C4 also covers removing or disabling `trg_appointments_0_workspace_locks`, `trg_appointment_services_0_workspace_locks` or a recheck trigger. **Text tripwires are not counted as coverage:** each fixture is also detected by a catalog rule (C1–C10) or by a mismatch between the hash and the declared writes. |
| **RLS policy inventory (PR 1, then every PR; mandatory negative fixtures)** | The check passes on the database built from all migrations, and the `rls` section lists every covered table (including `storage.objects` and `storage.buckets`) with its enabled/forced state. **Each fixture below, inside a rolled-back transaction, must make the check fail.** **C13 added:** a new permissive `SELECT` policy on `clients`; a new policy on `storage.objects`. **C14 removed:** `DROP POLICY` of an existing policy on `revenues`, and of `workspace_staff_select_own`. **C15 expression:** `ALTER POLICY … USING` on a `clients` policy (one-token change); `ALTER POLICY … WITH CHECK` on `workspace_staff_insert_owner`; adding a `WITH CHECK` to a policy that had none. **C16 command, roles, mode:** `ALTER POLICY … TO authenticated, anon` (roles widened); `ALTER POLICY … TO PUBLIC`; a policy dropped and re-created under the same name with `FOR ALL` instead of `FOR SELECT`; a restrictive policy re-created as permissive, and a permissive one as restrictive. **C17 RLS state:** `ALTER TABLE revenues DISABLE ROW LEVEL SECURITY`; `ALTER TABLE clients FORCE ROW LEVEL SECURITY` and `NO FORCE` on a table recorded as forced (if any); a new table in `public` with RLS disabled and no inventory entry; a new table with RLS enabled and no policies, not inventoried. **C18 fail closed:** the check run as a role denied `SELECT` on `pg_catalog.pg_policy` (revoked by the local superuser inside the transaction) fails rather than passing with zero policies. **Vitest, injected rows:** a NULL `pg_get_expr` result for a non-NULL expression; an unresolvable role OID; an unknown `polcmd`; an inventory entry missing `with_check` or `roles`; an empty catalog result against a non-empty inventory; a malformed inventory file. **Production:** the read-only production comparison reports a policy difference when run against a local database with one injected policy change (proving the production path includes policies). |
| **`delete_workspace()` (every PR from 3b on)** | `supabase/tests/workspace_deletion_flow.sql` passes **unchanged**. New: deleting a workspace that holds completed appointments, revenue (service and no-show fee), visits referenced by revenue, terminal appointments with lines, and expenses succeeds and leaves no rows; the same deletes as `authenticated`, `anon` and `service_role` outside `delete_workspace()` are refused (except the lines' cascade of a permitted appointment DELETE, 4.4); `delete_workspace()` performs no INSERT or UPDATE of a protected column (the maintenance trigger's recompute updates zero client rows, or rows of a client still present, through the value check); a non-owner can't call it to delete another workspace (existing tests). |
| **Lifecycle and editing (PR 3b, 4)** | Every allowed and refused transition; direct `status` UPDATE refused (privilege) for `authenticated`, `anon` and `service_role`; insert ≠ pending refused; **`completed` unreachable without the service revenue row** (attempted by `postgres` SQL without one: refused); the full editing matrix (workspace and `id` immutable; client locked once confirmed); line changes refused on terminal appointments for `authenticated`, `anon` and `service_role` (and allowed only as DELETE inside `delete_workspace()`, or as the cascade of a permitted appointment DELETE); **cascade test (blocking, PR 3b):** a member deletes a cancelled and a no-show appointment that each have lines but no visit or revenue, single-row and multi-row: the deletes succeed and the lines are gone; `current_user` recorded inside `trg_appointment_services_a_editable` during the cascade is `postgres`; a direct DELETE of the same lines as `authenticated` before that is refused. If the recorded role isn't `postgres`, or the delete fails, PR 3b stops for review (4.4); `save_appointment` atomicity (injected failure); catalog price unchanged; delete guard for `authenticated`, `anon` **and `service_role`**; `workspace_deletion_flow.sql` unchanged and passing (`postgres` context allowed) |
| **Timezone and clock changes (PR 3b)** | America/New_York 2026-03-08 02:30 → **rejected**; 2026-11-01 01:30 → **05:30 UTC**, shown to differ from plain `AT TIME ZONE`; Europe/London 2026-03-29 01:30 → **rejected**; 2026-10-25 01:30 → **00:30 UTC**; Asia/Riyadh 00:30 and 23:30; a 30-minute-shift zone (Australia/Lord_Howe) using transition dates read from Postgres's own data in the test; daily views on 23- and 25-hour days list each appointment once; an appointment at 00:30 local appears on its local day (Vitest plus SQL) |
| **Inactive assigned staff (PR 2, 3b, 4)** | Assign an active member, deactivate them: confirm, cancel and no-show succeed without reassignment; **completion succeeds** with visit `staff_id` = the original member and `assigned_staff_id` unchanged; unassigned completion uses the completing user; a detail edit is refused until reassigned to an active member or cleared |
| **`next_appointment_at` (PR 3a, 3b, 4)** | Correct after create, reschedule earlier and later, confirm, cancel, no-show, complete, client change (pending) and delete; races: two creations for one client; create vs cancel; reschedule vs complete; **appointment moved A→B while another moves B→A** (ascending-ID locking, no deadlock); appointment write vs a concurrent **client move to another workspace** (either succeeds or Postgres aborts one with 40P01, and nothing invalid commits); each final stored value equals the recomputed one |
| **Read-time fallback (PR 3a)** | Insert a future appointment, then advance time past it inside the test (`now()` controlled by the transaction start, or a test-only clock helper in `pg_temp`) **without any appointment write**: the stored value is now in the past, and the effective value returns the next future qualifying appointment (or NULL) with `stored_value_was_stale = true`; **the stored column and the audit log are unchanged after the read**; a function body containing INSERT/UPDATE/DELETE fails the structural test; the qualifying-status constants match (structural); no `src/` code reads the column except the service function (Vitest) |
| **`last_visit_at` (PR 4, all mandatory SQL tests)** | **L1, normal advance:** completing an appointment for a client with NULL `last_visit_at`, then a later one, sets it to each appointment's `start_time` in turn (not the completion time). **L2, historical value without matching revenue (mandatory):** set up, inside the rolled-back transaction with the guard disabled for the setup only, a client whose `last_visit_at` = a historical instant H, with **no** completed appointment or service revenue row at H. Then `complete_appointment` on an appointment with `start_time` < H: it **succeeds** (visit, revenue and status written), `last_visit_at` is still exactly H, and no guard error is raised. **L3, historical then newer:** the same client, completing an appointment with `start_time` > H advances the value to that `start_time`. **L4, older after newer:** complete a newer appointment, then an older one; the value stays at the newer `start_time`. The same holds with equal `start_time`s. **L5, concurrent:** two sessions completing two appointments for one client end with the maximum `start_time`, whatever the commit order. **L6, manual visits:** adding and editing a manual Beauty Passport visit leaves `last_visit_at` unchanged. **L7, arbitrary values refused:** as `postgres` at depth ≥ 2 (test-only trigger), each of these is refused: setting the value to an instant matching no completed appointment with service revenue; lowering it (including to an older completed appointment's `start_time`); setting it to NULL. Direct writes by `authenticated`, `anon` and `service_role` are refused (Trust model item 1). **L8, written only by `maintain_client_fields()`** on the completed transition, among application-accessible paths. |
| **Staff listing (PR 3c)** | A member gets only active members of their own workspace, exactly 2 fields; an inactive member caller is refused; an outsider gets **the same error for a real and a random workspace ID**; `anon` and PUBLIC lack EXECUTE; no other profile field returned; profile RLS unchanged; the selector shows only the function's result (Vitest); a forged staff ID is refused by the trigger |
| **Completion (PR 4)** | Correct G, D, T, tip, service revenue, collected, currency and timezone snapshots; `visit_date` local (00:30 and 23:30 local); **atomicity** (injected failure after the visit insert leaves no rows and no client-field change); **duplicates** (a second call returns the same IDs; counts stay 1 and 1); **concurrency** (two sessions yield one visit and one revenue); completion concurrent with a booking for the same client (no deadlock); refused from pending or terminal states, for non-members and `anon`; revenue not insertable, updatable or deletable directly by `authenticated` or `service_role`; linked visit not deletable; S5 and consent green |
| **No-show fee (PR 5)** | Only on no-shows; D = T = tip = 0 enforced; a second collection refused (including two at once); counts toward collected only; direct revenue insert by `service_role` refused |
| **Reporting and expenses (PR 6)** | Revenue months use **each row's own** `timezone_snapshot` (same instant, different snapshots → different months; rows don't move after a workspace timezone change); 2026-10-31 22:00 UTC with an Asia/Riyadh snapshot → November; clock-change months; expenses grouped by `incurred_at` and never shifted; currencies never mixed; both nets per currency, including a currency with expenses only; expense add, edit and delete for members; outsiders, `anon` and `service_role` refused |
| **Structural (every PR)** | The catalog inventory check (3.4) passes: guard functions are SECURITY INVOKER; privileged functions are SECURITY DEFINER with a pinned `search_path` and restricted EXECUTE; every function and trigger matches its reviewed entry; privileges match 3.2; every RLS policy and table RLS state matches the `rls` inventory (C13–C18). Migration-text tests (early warning only): trigger names keep the documented firing order; the allowlist literal matches the generator output |
| **Scope (Vitest)** | The trial banner, AI history and AI Engine, Client Portal, Clients page, Pricing and onboarding render exactly as before |
| **Regression (every PR)** | All existing suites green: the full Vitest suite, every structural migration test, all local RLS files (S1, S1-b, S2, S3, S4, S5, consent, deletion flow), the S5 race runner, and the existing verification scripts |

### 14.1 Mandatory prerequisite tests: trigger depth (D1–D8)

**When they run:**

- They're the **first step of PR 3a** and run against the local database
  only, before any other PR 3a code is written or reviewed.
- They're then kept permanently in `supabase/tests/` and run with every PR.

**What they establish:** what `pg_trigger_depth()` and `current_user` look
like **inside the client-field guard**, in each context. Every test records
both values from inside the guard (a test-only `RAISE NOTICE` or a temporary
log table, inside the rolled-back transaction) as well as the outcome.

**Test fixtures:**

- Test-only functions and triggers are created in a test schema **inside
  the rolled-back transaction**.
- Where a test needs a `postgres`-owned SECURITY DEFINER function, it's
  created by the local superuser inside that transaction.
- Nothing persists.

| # | Context | Expected inside the guard | Expected outcome |
| --- | --- | --- | --- |
| D1 | Direct write: `UPDATE clients SET next_appointment_at = …` as `authenticated` (and as `anon`, `service_role`) | depth 1, role = that role | **refused** (42501) |
| D2 | Direct write as `postgres` (plain SQL) | depth 1, `postgres` | **refused** |
| D3 | Approved maintenance: an appointment INSERT, reschedule, cancel, and (PR 4) completion as `authenticated` → `maintain_client_fields()` | depth 2, `postgres` | **allowed**; the stored value equals the recomputed one |
| D4 | **Unrelated nested trigger:** a test-only trigger on `visits` that updates `clients.next_appointment_at`, fired by (a) an `authenticated` INSERT on `visits` and (b) a `postgres`-run statement (a test-only definer function) | (a) depth 2, `authenticated`; (b) depth 2, `postgres` | (a) **refused** by role. (b) **wrong value refused** by the value check, and a correct value is accepted. This proves depth alone doesn't identify the trigger, which is why the **catalog check must fail** for the same trigger (C4, asserted in the same test run). |
| D5 | **Nested SECURITY DEFINER calls:** (a) a test-only `postgres`-owned definer function that updates the client system columns, called directly as `authenticated`; (b) the same function called from inside a second definer function; (c) the same function called from inside an unrelated trigger | (a) and (b) depth 1, `postgres`; (c) depth 2, `postgres` | (a) and (b) **refused**. (c) **wrong value refused** by the value check, and the catalog check fails for the uninventoried functions and trigger (C1, C4). |
| D6 | **Rollback:** a transaction that runs D3 and then fails, a `SAVEPOINT` rolled back after D3, and an exception caught inside a plpgsql `BEGIN … EXCEPTION` block in a trigger | after each: the next statement sees depth 1 and its own role | the next direct write is **refused**; no system-column change from the failed part remains |
| D7 | **No carry-over:** run D3, then a direct write in the **same** transaction and in a new transaction | depth 1 | **refused** both times |
| D8 | **Spoofing:** set arbitrary custom settings (including `beautyroute.trusted_operation`) and `SET LOCAL` of any setting a client can change, then repeat D1 and D3 | unchanged from D1 and D3 | unchanged outcomes |

**If any observed value or outcome differs from this table, PR 3a stops and
the trust model returns for review.** Until D1–D8 pass, the spec treats the
depth behavior as an expectation, not a guarantee.

### 14.2 Mandatory concurrency tests (M1–M13 and residuals R-a to R-d; PR 2, then every PR)

**Harness.** These extend `scripts/test-cross-workspace-races-local.sh`,
using two (or three) concurrent `psql` sessions against a **disposable local
database** (`supabase start`, then `supabase db reset`).

- **Sessions:** each runs as `authenticated` with `request.jwt.claims` set,
  exactly as PostgREST does, unless a scenario names another role.
- **Forcing row order:** the shared rows are locked in **opposite orders**
  by the two sessions. The order is forced with join-driven statements
  (`UPDATE … FROM (VALUES …)`, `DELETE … USING (VALUES …)`,
  `INSERT … SELECT … ORDER BY`) and local planner settings, and is
  confirmed by a test-only per-row log trigger.
- **Widening the race:** a test-only per-row `pg_sleep` trigger keeps the
  window open. It's named so that it fires after the row lock is taken
  and before `trg_appointments_b_overlap`.
- **Observing waits:** `pg_stat_activity` and `pg_locks` record what each
  session waits on and what it holds while waiting.
- **Fixtures and clean-up:**
  - test-only triggers and functions are installed by the harness only in
    the disposable database;
  - the catalog check (3.4) must **fail** while they're installed (C1, C4),
    proving they can't pass review unnoticed;
  - after the suite, `supabase db reset` rebuilds the database from the
    migrations, and the catalog check must **pass** before any other test.
- **Repetition:** every race runs at least 200 iterations **in each start
  order**.
- **Results:** each iteration is classified only by each session's SQLSTATE
  and their observed completion order. Only `40P01` counts as a deadlock;
  every other error is a normal error. A test that can't run, or can't
  reproduce a required control result, **fails**. It's never skipped.

**Control experiments (they prove the tests exercise the original
problem).** Each runs in the disposable database before the real run:

| Control | Change installed | Required result |
| --- | --- | --- |
| C-A | the two statement-level lock triggers disabled | M9 and M10, which are pure row-order cycles, reproduce `40P01` at least once. M1, M7, M8 and M11 instead get the **R1.3 lock-order error**, with no session waiting on an advisory lock while holding an appointment row lock (`pg_locks`). That proves the fail-closed backstop. |
| C-B | C-A, plus `trg_appointments_b_overlap`'s try-lock replaced by the blocking `pg_advisory_xact_lock`: the revision 6 design | M1, M7, M8 and M11 reproduce `40P01` at least once |

Then the database is reset and the real run follows.

**Zero `40P01` is required only in the real run of M1–M13**, which covers
R1-compliant writers only. The residual cases R-a to R-d are held to the
residual protocol below instead, and are never counted toward the
zero-deadlock guarantee.

**R1-compliant writers (M1–M13).** Every pairing runs in both start orders
on the real (reset) database. A row fails if its required result doesn't
hold, or if any `40P01` occurs.

| # | Scenario | Required result |
| --- | --- | --- |
| M1 | **Opposite row orders, same workspace:** sessions A and B each run one multi-row `UPDATE` over the same appointments r1 and r2 (A locks r1→r2, B r2→r1) | B waits **on the advisory lock** (`locktype = advisory`) before locking any appointment row; no 40P01; both complete in turn, or the second fails only on a business rule (overlap, lifecycle) |
| M2 | **Bulk INSERT whose rows overlap each other** (same staff, or one unassigned) in one statement | refused by the recheck; **no row committed** |
| M3 | **Bulk INSERT, non-overlapping rows** | all rows committed; `next_appointment_at` correct for each client (from PR 3a) |
| M4 | **Two concurrent bulk INSERTs**, each containing a row that overlaps a row of the other | exactly one statement commits; the other fails with the overlap error; no overlap in the final state |
| M5 | **Multi-row UPDATE that moves rows into overlap** with an existing appointment, or with each other | refused; no change committed |
| M6 | **Multi-row swap** of two same-staff appointments' times | refused (documented safe false refusal, 7.1); the same change as two separate single-row requests succeeds |
| M7 | **Multi-workspace member** (k(W1) < k(W2)): (a) A updates rows in W1 and W2 while B (also in both) updates rows in W2 and W1, in opposite row orders; (b) from PR 3b, A runs `save_appointment` in **W2** while B runs a direct multi-row write in W1 and W2 | in both, each session's first advisory wait is for its lowest key, and no session waits on an advisory lock while holding another advisory or row lock (`pg_locks`); no 40P01 |
| M8 | **Multi-row direct write vs single-row functions** in the same workspace, in both start orders, against each function as its PR introduces it: `save_appointment`, `confirm_appointment`, `cancel_appointment`, `mark_appointment_noshow` (3b), `complete_appointment` (4), `collect_noshow_fee` (5) | no 40P01; whichever starts second waits at its first advisory lock; final state valid |
| M9 | **Multi-row DELETE** (deletable pending, cancelled and no-show appointments, with lines) concurrent with a multi-row UPDATE and a bulk INSERT in the same workspace | serialized; no 40P01; the lines' cascade completes; `next_appointment_at` equals the recomputed value afterwards (from PR 3a) |
| M10 | **Multi-row `appointment_services` writes** (INSERT, UPDATE, DELETE and upsert of lines across several appointments, opposite orders), concurrent with each other and with `save_appointment` on one of the parents (from PR 3b) | no 40P01; staff and editable checks still applied per row (from PR 3b) |
| M11 | **Multi-row upsert** (`INSERT … ON CONFLICT DO UPDATE`) concurrent with a multi-row UPDATE over the same rows | no 40P01; overlap rule holds in the final state |
| M12 | **Fail closed and refusals:** (a) a test-only definer function that updates an appointment **without** calling `lock_appointment_workspace` first, run while another session holds that workspace's lock; (b) direct single-row and multi-row appointment and line writes as `anon` and `service_role`; (c) a transaction that already holds `k(W1)` (paused by a sleep trigger) while the caller's membership of W0 is activated and committed by a third session that also holds `k(W0)`, after which the transaction issues its next appointment statement | (a) refused **immediately** with the lock-order error, without waiting (`pg_stat_activity` shows no lock wait); (b) refused at statement start (42501), no row touched; (c) the statement trigger raises the lock-order error immediately and doesn't wait for `k(W0)`. No 40P01 in any case. |
| M13 | **Through the real API:** against the local PostgREST, with a test user's token: `POST /appointments` with a JSON array (overlapping and non-overlapping); `PATCH /appointments?<multi-row filter>`; an upsert with `Prefer: resolution=merge-duplicates`; `DELETE /appointments?<multi-row filter>`; the same for `/appointment_services`; two of these concurrently in opposite orders | same results as M1–M5, M9 and M10; confirms that PostgREST sends each request as one statement and that the statement triggers fire (log trigger) |

**Residual protocol (R-a to R-d).** These cases are **not** covered by the
zero-deadlock guarantee. Each test checks that every outcome is one of the
allowed ones and that nothing invalid commits.

- **Setup, per iteration:**
  - a fresh fixture with known IDs;
  - a snapshot **S0** of every affected table: the IDs, plus each row's
    reference columns (`workspace_id`, `client_id`, `appointment_id`,
    `visit_id`, `service_id`) and the business columns the transactions
    touch;
  - for each transaction T, its exact expected effect **E(T)**: the rows it
    inserts, updates (with final values) and deletes.
- **Execution:** both start orders, at least 200 iterations each, with the
  sleep triggers. Where the row says "forced cycle", a variant places them
  so that each session holds its first row before requesting the other's.
- **Allowed outcomes, with the post-state the runner verifies exactly:**
  1. **Both commit, serialized:** final state = S0 with E applied in the
     observed commit order. E(second) is evaluated against the state the
     first left behind; for example, a filtered UPDATE or DELETE may then
     match zero rows.
  2. **One aborts with `40P01`, and the other commits in full:** final state
     = S0 + E(committed). No row of E(aborted) exists.
  3. **One commits, and the other then fails with a normal error** from the
     row's allowed SQLSTATE set: final state = S0 + E(committed). Nothing of
     the failed transaction exists. This is an ordinary serialization, never
     reported as a deadlock.
- **Invariants checked after every iteration:**
  - I1: no overlapping active appointments (7.1);
  - I2: client system fields equal the recomputed values (from PR 3a);
  - I3: every foreign key and S5 reference is valid: no visit, line or
    revenue references a missing row or another workspace's row;
  - I4: a completed appointment has exactly one visit and one service
    revenue (from PR 4);
  - I5: no appointment with a committed linked visit or revenue was deleted
    by a member (from PR 3b);
  - I6: no transaction's effect is partial; it's all of E(T) or none of it.
- **Fails if:**
  - an outcome isn't one of the three;
  - a SQLSTATE is outside the row's set;
  - both sessions get `40P01`;
  - the final state differs from the expected one by any ID or reference;
  - any of I1–I6 fails;
  - a "forced cycle" variant observes no `40P01` in its iterations. Then
    the PR stops for review; it's never skipped.

| # | Scenario (PR) | Allowed normal errors (outcome 3) |
| --- | --- | --- |
| RA | **R-a:** client move to another workspace (S5) vs an appointment write for that client (single-row and multi-row INSERT, UPDATE and DELETE); forced cycle included (PR 3a) | the S5 move refusal (42501) |
| RB | **R-b:** direct multi-row `clients` UPDATE over clients c1, c2 vs an appointment write whose maintenance locks c2 then c1; forced cycle included (PR 3a) | none |

**R-c: `delete_workspace()` (the R1 exception), RC1–RC5.** Each pairing
runs from the PR that introduces its writer: PR 2 for direct writes; 3b for
`save_appointment` and the lifecycle functions; 4 for completion; 5 for the
no-show fee. Each follows the residual protocol above.

| # | Scenario | Required result |
| --- | --- | --- |
| RC1 | `delete_workspace(W)` vs each R1-compliant writer in W: multi-row direct appointment UPDATE, bulk INSERT, upsert, multi-row DELETE (with lines), multi-row line writes, `save_appointment`, `confirm_appointment`, `cancel_appointment`, `mark_appointment_noshow`, `complete_appointment` and `collect_noshow_fee` | each iteration ends in one of the RC outcomes below; any other outcome fails |
| RC2 | **Forced cycle:** (PR 2) the deletion's `appointment_services` DELETE holds the lines of appointment A while a member's multi-row appointment DELETE holds A and waits on those lines through its cascade; (PR 4) the deletion holds A's lines while `complete_appointment(A)` holds A `FOR UPDATE` and waits to write a line | at least one `40P01` observed in each variant's iterations; otherwise the PR stops for review |
| RC3 | **Deletion aborted** (`40P01`), after each such iteration | the workspace row exists; for every table that `workspace_deletion_flow.sql` checks, the set of IDs and their reference columns equals S0 + E(writer) **exactly**; `audit_logs` rows of W still carry `workspace_id = W`; no partial deletion |
| RC4 | **Deletion committed** (the writer was aborted with `40P01`, failed normally, committed first, or committed affecting zero rows), after each such iteration | the workspace row is gone; zero rows with `workspace_id = W` in every table that `workspace_deletion_flow.sql` checks; no ID from S0 or E(writer) remains in any of those tables; W's `audit_logs` rows remain with `workspace_id` NULL, as the existing flow does (the same assertions as `workspace_deletion_flow.sql`) |
| RC5 | **Unchanged flow:** after the race suite and reset, `workspace_deletion_flow.sql` and the deletion tests in 14 pass unchanged, and the C12 (d)–(f) fixtures pass | as stated |

**RC outcomes (the residual protocol, specialized):**

1. **Both commit, serialized:**
   - writer first, then deletion: final state is RC4;
   - deletion first, then a writer that commits after affecting zero rows
     (a filtered UPDATE or DELETE that no longer matches anything): final
     state is RC4, and E(writer) is empty.
2. **One aborts with `40P01`, the other commits in full:**
   - the deletion aborted: final state is RC3;
   - the writer aborted: final state is RC4.
3. **Deletion first; the writer then fails with a normal error,** before
   any of its writes commit. Final state is RC4. The allowed SQLSTATEs:
   - 42501, from the membership check, RLS `WITH CHECK` or S5, because the
     workspace and its staff rows are gone;
   - 23503, a foreign-key violation;
   - the function's not-found error.

   This is an ordinary serialization, never classified as a deadlock.

**R-d: multi-row `visits` writes vs appointment DELETE or key-locking
UPDATE, RD1–RD6.** These run from PR 2, and again in 3b (the delete guard
changes outcome 1) and 4 (the unique `visits(appointment_id)`). Each follows
the residual protocol above.

The fixture is workspace W with pending appointments A1 and A2 that have no
visit or revenue, plus, for the UPDATE variants, existing visits v1 and v2
of the same client. For RD6, A1 and A2 also each have one line.

| # | Scenario | Required result |
| --- | --- | --- |
| RD1 | **INSERT:** V = one multi-row `visits` INSERT whose rows reference A1 then A2. D = one member multi-row `DELETE` of A2 then A1. As `authenticated`, and once more with V as `service_role`. | the RD outcomes below |
| RD2 | **UPDATE:** V = one multi-row `UPDATE visits SET appointment_id` moving v1 to A1 and v2 to A2, in that row order, vs D as in RD1. Before PR 3b, a variant where v1 and v2 already reference A1 and A2, so D's ON DELETE SET NULL must update rows V holds. | the RD outcomes below |
| RD3 | **Against the R1 exception:** V (the RD1 and RD2 forms) vs `delete_workspace(W)` | outcomes as RC1, with RC3 and RC4 as the post-states, plus the RD invariants |
| RD4 | **Single-row writers can't close the cycle:** V vs `save_appointment`, the lifecycle functions, `complete_appointment` and `collect_noshow_fee`, each on A1 or A2, as their PRs introduce them | **zero `40P01`**. If one occurs, the R-d analysis in 3.3 is wrong: the PR stops for review, and the analysis and tests are revised. |
| RD5 | **Forced cycle:** RD1 and RD2, with V holding A1's `FOR KEY SHARE` and D holding A2 before each requests the other | at least one `40P01` observed in each; otherwise the PR stops for review |
| RD6 | **Key-locking UPDATE (4.6):** V (the RD1 and RD2 forms) vs U, a member multi-row UPDATE of A2 then A1 that names `id` in its SET clause, in four forms: (a) `SET id = id, notes = …` (no change); (b) `SET id = <new uuid>`; (c) one statement that swaps the IDs of A1 and A2; (d) `SET id = CASE WHEN id = A2 THEN A2 ELSE <new uuid> END` in row order A2 then A1. A2 passes unchanged; A1 changes. U must hold A2 before requesting A1. This can form a cycle with V. All forms in both start orders; a forced cycle as in RD5 for (a) and (d) | (a) U commits its notes change with every ID unchanged, or one side aborts with `40P01` and the other commits in full. The forced cycle must observe at least one `40P01`. (b) and (c) U is refused at its first row with 42501 and the 4.6 message. Zero `40P01` is required. (d) U is refused at A1 with 42501 and the 4.6 message, or is aborted with `40P01` if the forced cycle forms. U is never committed. The forced cycle must observe at least one `40P01`. In every form, A1 and A2 retain their original IDs, and every line, visit, revenue and audit row in S0 that referenced either appointment continues to reference the same ID. |

**RD outcomes, with the exact post-state:**

1. **V commits, then D runs:**
   - **before PR 3b**, D deletes A1 and A2. The SET NULL sets V's visits'
     `appointment_id` to NULL, which is the existing behavior. Both commit.
   - **from PR 3b**, D's delete guard, re-run after its lock wait, refuses
     because the appointments now have linked visits. That's a normal
     error from the guard: outcome 3, and A1 and A2 still exist.
2. **One aborts with `40P01`, and the other commits in full,** as in the
   residual protocol.
3. **D commits, then V fails** with 42501 (`trg_visits_same_workspace_refs`:
   "The visit's appointment is not in the visit's workspace") or 23503 (the
   foreign key). No row of V exists. From PR 4, 23505 is allowed only in a
   dedicated variant where a visit already exists for the appointment.

**RD invariants, in addition to I1–I6:**

- no committed visit references a deleted appointment or one in another
  workspace;
- no appointment's `id` differs from S0 (4.6);
- from PR 3b, if V committed, A1 and A2 both still exist;
- from PR 4, at most one visit per appointment.

---

## 15. Acceptance criteria (Phase 5 complete)

1. Appointments follow Section 4 exactly, including the immutable
   `workspace_id` and the immutable `appointments.id` (4.6); `visits.id` is
   immutable too (4.7); every other change is refused by the database,
   through every application-accessible write path (3.2). The appointment
   and visit ID immutability tests (14) pass, and every linked line, visit,
   revenue and audit row keeps its reference.
2. Completion is atomic and idempotent: exactly one visit and one revenue
   record per completed appointment, with correct figures, currency and
   timezone snapshots, and preserved staff attribution. `completed` can't be
   reached any other way.
3. No-show fees are recorded only on collection, with T = 0, and counted in
   collected only.
4. Overlaps are impossible under the Section 7.1 rule, including under
   concurrent requests and **multi-row INSERT, UPDATE, upsert and DELETE
   requests**. Assigned staff are always active members at every assignment
   or detail edit, including line changes.
   - Application appointment and line writes follow lock rule R1 (3.3).
     The only exception is `delete_workspace()`, recorded as the single
     `reviewed_exception` that C12 accepts.
   - M1–M13 (14.2) pass with zero 40P01 errors among R1-compliant writers,
     including multi-workspace members and `save_appointment` (M7). The
     controls C-A and C-B produce their required results: the original
     deadlock is reproduced, and the fail-closed backstop fires.
   - The residual cases R-a to R-d pass the residual protocol (14.2):
     - every outcome is one of the three allowed ones;
     - the post-state matches exactly, by ID and reference;
     - invariants I1–I6 hold;
     - every forced-cycle variant observes a 40P01.

     That covers RA and RB (PR 3a), RC1–RC5 (by writer PR, deletion flow
     unchanged) and RD1–RD6 (PR 2, re-run in 3b and 4).
   - Members' deletion of cancelled and no-show appointments with lines
     works through the lines' cascade (4.4; cascade test, PR 3b).
5. Staff names are visible only to active members of the same workspace,
   limited to `profile_id` and `full_name`.
6. **On every application-accessible path** (`authenticated`, `anon`,
   `service_role`, and every function they can reach):
   - the protected **columns** `clients.last_visit_at` and
     `clients.next_appointment_at` are written only by
     `maintain_client_fields()`, with values that pass the value check;
   - `last_visit_at` only advances, to a completed appointment's
     `start_time`, and historical values are kept (L1–L8);
   - revenue is created only by `complete_appointment` and
     `collect_noshow_fee`;
   - the `appointment_services` staff-check exemption applies only inside
     `complete_appointment`;
   - protected deletes happen only through `delete_workspace()`'s narrow
     deletion exception. The one addition is the lines' ON DELETE CASCADE
     of an appointment DELETE that passed its guard (4.4): it removes only
     the lines of the appointment being deleted.

   Beyond that:
   - No authorization decision depends on session state, and spoofing tests
     prove it.
   - Readers get the correct effective next appointment even after time
     passes without writes, and reads never write.
7. Direct `service_role` writes are refused for system fields, snapshots,
   financial records, status and protected deletions, with no general bypass
   (U3).
8. A workspace timezone can be **set** only to `UTC` or an identifier from
   the pinned `zone.tab` allowlist that exists in the server's
   `pg_timezone_names` (U2, U4). Existing values are never converted
   automatically. All approved screens use the workspace timezone
   consistently; unapproved screens are unchanged.
9. The dashboards show real per-currency figures, including both Business
   Engine nets, and never add different currencies together.
10. **Normal authorized writes are preserved:** members still edit every
    non-system client column and edit `appointment_services` lines on
    pending and confirmed appointments under the editing matrix and staff
    validation. `workspace_deletion_flow.sql` passes unchanged.
11. The catalog inventory check (3.4) passes on every PR and fails on each of
    its negative fixtures.
    - The production catalog matches the reviewed inventory at every
      verification, **including every RLS policy and table RLS
      enabled/forced state** (C13–C18).
    - No RLS policy has been added, removed or changed by Phase 5.
    - Trusted operator access stays as documented in 3.2 and 17: it isn't
      added to, removed or presented as prevented.
12. Every invariant in Section 3 holds, including the lock order and deadlock
    behavior in 3.3. The trigger-depth prerequisites D1–D8 (14.1) and every
    other test in Section 14 pass.
13. **Workspace currency format (PR 1):** `workspaces_currency_format_check`
    exists and is validated (`currency ~ '^[A-Z]{3}$'`, 5.2). It was added
    only after the PR 1 pre-check found zero non-matching workspaces, and no
    existing value was converted (13). The Section 14 Financial tests pass:
    malformed values are refused (23514) on UPDATE as `authenticated`,
    `service_role` and `postgres` and on INSERT as `service_role` and
    `postgres`; a member can set `USD`; other workspace columns stay
    editable; `bootstrap_professional_workspace()` still creates `SAR`. The
    PR 1 verification script confirms the constraint in production.

---

## 16. Rollback notes

| PR | Rollback |
| --- | --- |
| 1 | Allowed **only while no revenue or expense rows exist**: drop the added columns, triggers, constraints (including `workspaces_currency_format_check`), `is_valid_workspace_timezone` and `canonical_timezone_names`; restore the previous `net_total` expression and S5 functions; re-grant the previous privileges exactly. Once rows exist, rollback is a manual decision, because dropping columns would destroy snapshots. Remove the timezone validation and snapshot triggers together. |
| 2 | Drop `trg_appointments_b_overlap`, the statement-level lock and recheck triggers, `lock_appointment_workspace`, the `workspace_id` and `appointments.id` immutability checks, and `trg_visits_a_id_immutable` with its function. Revert the inventory to its PR 1 state: remove the `locks_workspace_first` fields, `delete_workspace()`'s `r1_exception` object, C12's R1 rules (c)–(f), C12 (g) and the C11 `id` tripwire, with their fixtures. `delete_workspace()` itself isn't touched by PR 2 or its rollback. Pre-Phase-5 S5 move rules then apply again. **Not allowed while PR 3b, 4 or 5 is live**, because their functions call `lock_appointment_workspace` (roll them back first). |
| 3a | Drop the client-field guard, `maintain_client_fields()` and its trigger, `client_effective_next_appointment` and `appointment_qualifying_statuses`. Already-written `next_appointment_at` values remain and stop updating (documented). **Not allowed while PR 4 is live**, because `last_visit_at` maintenance depends on it: roll PR 4 back first. |
| 3b | Drop the lifecycle, editing, `appointment_services` and delete-guard triggers, `resolve_local_time` and `save_appointment`; re-grant `appointments.status` UPDATE to `authenticated` only (never to `service_role`). The UI and timezone changes revert in the same PR. **Not allowed while PR 4 or 5 is live.** |
| 3c | Drop `list_workspace_staff`; the selector reverts with the PR |
| 4 | Drop `complete_appointment`, the `last_visit_at` branch, the "completed requires revenue" rule, the visit guard and the visit uniqueness rule. Revenue INSERT/UPDATE/DELETE stays revoked from client roles (that's PR 1's invariant). Revenue rows, visits and `last_visit_at` values are kept. |
| 5 | Drop `collect_noshow_fee`; collected fee rows are kept |
| 6 | Drop the summary functions; the UI reverts with the PR |

Every rollback is an emergency procedure with its own runbook and approval.
No rollback deletes financial records or creates a service-role bypass.
Every rollback updates the privileged-write inventory, including the `rls`
section, in the same change, so the catalog check keeps passing. No
rollback adds, removes or loosens an RLS policy; Phase 5 changes none, so
there's nothing to restore. The inventory, the catalog check and its CI
job **stay in place** in every rollback (removing them would weaken the
contract). Rolling back PR 1 keeps `supabase/timezone/` and the generator
only if `canonical_timezone_names()` is kept; otherwise they're removed
together.

---

## 17. Known limitations, remaining risks and open technical points

- **U4, decided in revision 4: `zone.tab`.** Remaining points to settle at
  implementation:
  - **Which IANA release to pin.** It must be 2022b or later. Ideally it
    matches the tzdata the production Postgres uses, but Postgres doesn't
    report its tzdata version directly, and Supabase may build with system
    tzdata. The existence checks (local and production) are what's relied
    on; the release choice is recorded in `VERSION`.
  - **Primary zones vs links.** Some `zone.tab` names (for example
    `Europe/Amsterdam`) are links in IANA's main data. Their conversions
    since 1970 match the target zone, so this has no effect on appointment
    times.
- **The inventory contract relies on human review.**
  - The catalog check makes the inventory **complete**: nothing can exist
    unlisted or change unnoticed.
  - The **declared writes** of each function are a reviewer's reading of
    its body, pinned by hash. Text tripwires help, but they're incomplete by
    nature (plpgsql isn't parsed).
  - The value check limits the damage of a misread client-field writer;
    revenue and status are limited by privileges.
- **The CI job** needs the local Supabase stack in CI (runtime and cost to be
  confirmed in PR 1). Until it's merged, the catalog check is a mandatory
  local gate before every merge, run and reported like the existing RLS
  suites.
- **Supabase-managed schemas** (`auth`, `storage` and similar) are assumed not
  to write application tables. Their triggers on application tables are
  still caught (C8).
- **RLS policy inventory limits:**
  - **Text comparison.** Expressions are compared exactly as PostgreSQL
    deparses them. A PostgreSQL major-version upgrade, or a Supabase
    platform change to `storage.objects` / `storage.buckets`, can produce a
    diff without any meaning change. That's deliberately a failure needing
    review, never a silent pass.
  - **Equivalent rewrites.** The check detects *any* change, not whether a
    change loosens access. Judging that stays with the reviewer, backed by
    the S1–S5 and consent suites.
  - **Covered tables.** Policies on Supabase-managed tables other than
    `storage.objects` and `storage.buckets` aren't covered.
- **Trusted operator capability (documented, outside the security
  boundary, unchanged by Phase 5):** whoever connects as the table owner
  (`postgres`) or a Supabase platform role can:
  - insert, update or delete revenue (the revoked privileges don't apply
    to the owner);
  - delete protected appointments, visits and lines;
  - edit appointment lines without the staff check;
  - by disabling triggers or setting `session_replication_role`, change
    protected columns, snapshots, `workspace_id`, `appointments.id`,
    `visits.id` or status freely.

  Without such a bypass, a plain statement still hits the safeguards: client
  system columns refused at depth 1; snapshot, `workspace_id`,
  `appointments.id` and `visits.id` changes refused; "completed requires
  revenue". These guard against **mistakes,
  not a deliberate operator**.

  **Mitigations, all outside the database:**
  - restricting who has dashboard access and the database password;
  - the approval-gated runbooks for every production change;
  - the read-only production catalog comparison, which detects changed or
    disabled triggers and functions, changed grants, and (once PR 1's `rls`
    inventory exists) added, removed or changed RLS policies and table RLS
    state, after the fact.

  Ad-hoc operator DML can't be detected by the catalog check (3.4). Phase 5
  adds no audit for it; that would be a separate decision.
- **`pg_trigger_depth()` behavior** is an expectation until D1–D8 pass (14.1).
  If it differs, PR 3a stops and the trust model returns for review.
- **`delete_workspace()` interaction:** `delete_workspace()` deletes
  appointments before clients. The maintenance trigger therefore recomputes
  `next_appointment_at` for affected clients while those client rows still
  exist; the clients are deleted later in the same transaction. The deletion
  tests confirm this order and the atomic behavior.
- **Manual visits** have no service timestamp and don't update
  `last_visit_at` (Section 9).
- **Stored `next_appointment_at`** may be in the past until the next relevant
  write; readers must use the effective value (Section 10). Any future direct
  read of the column would be wrong, and the structural test guards against
  it.
- **Browser and Postgres timezone data** can differ in version. The server is
  authoritative for entry and reporting; the browser only formats instants.
- **The algorithm's ±48-hour assumption** (Section 8.3) is documented and
  tested.
- **The workspace currency CHECK isn't in the catalog inventory**, because
  the inventory covers functions, triggers, privileges and policies, not
  table constraints (3.4). Its presence is checked by the PR 1
  migration-text test and the PR 1 verification script. An operator could
  drop it with DDL; that's trusted access outside the boundary (3.2).
- **Timezone data drift:** a Postgres or OS tzdata upgrade can rename or
  remove zones. The allowlist test and the PR 1 pre-check detect it, and
  existing workspaces keep working through the runtime existence check.
- **Detected (residual) deadlocks** (3.3): one transaction is aborted with
  40P01, and nothing invalid commits (14.2).
  - R-a: a client move to another workspace vs an appointment write.
  - R-b: a direct multi-row `clients` UPDATE vs appointment writes for the
    same clients.
  - R-c: `delete_workspace()`, the single reviewed R1 exception, vs an
    R1-compliant writer (RC1–RC5).
  - R-d: a multi-row `visits` write referencing appointments vs a
    multi-row appointment DELETE, or `delete_workspace()`. It existed
    before revision 7, was identified in revision 8, and was verified
    against the schema in revision 9 (3.3). It's tested by RD1–RD6. From
    revision 10, a statement that changes `appointments.id` is refused
    (4.6). A statement that names `id` stays an R-d cycle partner while it
    passes rows whose `id` doesn't change (RD6 (a) and (d)); it's refused at
    its first changed row and never commits an ID change.

  The no-deadlock guarantee covers R1-compliant writers only. Removing these
  cases would mean taking the workspace lock on client writes, on writes
  that reference appointments, and inside `delete_workspace()`. None of that
  is in scope.

  Adding the lock to `delete_workspace()` (a `lock_appointment_workspace`
  call before its first DELETE) is a possible later change. It would change
  an approved, unchanged function and its tested flow, so it needs its own
  decision.
- **Residual-case assumptions (expected; the named tests must confirm):**
  - a 40P01 abort of `delete_workspace()` rolls back all of its deletes,
    since it's a single function call in one transaction (RC3);
  - the writers' failures after a committed deletion are ordinary errors,
    not partial writes (RC4);
  - an appointment DELETE row lock is taken before its BEFORE DELETE
    trigger runs, and the guard's query after a lock wait sees a visit
    committed during that wait (RD1, RD2 outcome 1);
  - a visit write that waited behind a committed appointment DELETE fails
    with 42501 or 23503, never committing a dangling reference (RD
    outcome 3);
  - single-row writers can't close an R-d cycle (RD4);
  - an UPDATE that names `appointments.id` row-locks each row it reaches in
    the key-strength mode before `trg_appointments_a_lifecycle` runs, and a
    changed `id` is refused at its first changed row with nothing written
    (RD6, and the appointment ID immutability tests in 14);
  - a `visits.id` change is refused the same way, and an UPDATE naming
    `visits.id` adds no residual deadlock, because no concurrent
    transaction can hold `FOR KEY SHARE` on an existing visit through an
    application path (4.7; the visit ID concurrency test in 14);
  - an appointment DELETE's ON DELETE SET NULL on `visits` passes
    `trg_visits_a_id_immutable`, keeps the visit's `id`, writes exactly one
    visit audit row, and is atomic with the DELETE, including inside
    `delete_workspace()` (4.7; the SET NULL integration test in 14).

  If any of these differs, the PR running that test stops for review.
- **Foreign-key cascades run as the table owner** (expected): the lines'
  ON DELETE CASCADE and the visits' ON DELETE SET NULL run as `postgres`
  (4.4). The PR 3b cascade test must confirm it. If it differs, PR 3b stops
  for review rather than weakening the line guard.
- **Multi-row writes (revision 7):**
  - **Supported, with costs:**
    - every direct appointment or line write locks **all** of the caller's
      active workspaces at statement start, so a member of several
      workspaces briefly serializes writes across all of them;
    - completion and no-show fee collection now also take the workspace
      lock, so they queue behind bookings in the same workspace;
    - a multi-row swap of same-staff times is refused (7.1), while separate
      requests work.
  - **Mandatory, not assumed:** the analysis relies on PostgreSQL behavior
    that M1–M13 must confirm locally:
    - statement-level BEFORE triggers fire before any row is locked;
    - `pg_try_advisory_xact_lock` is re-entrant and never waits;
    - `pg_locks` shows the current backend's held advisory locks, so the
      already-holds rule (R1.1, R1.2) can be decided (M12 (c));
    - each PostgREST request is a single statement (M13);
    - the controls C-A and C-B reproduce their required results (14.2).

    If any of these differs, PR 2 stops for review.
- **Expected stops:** PR 1, 2, 3a and 4 deliberately stop on existing revenue
  or expense rows, non-allowlisted workspace timezones, overlaps, inactive
  assigned staff, client-field discrepancies, or duplicate visit links.
- **Out of scope:** refunds and voids; any correction of a completed checkout
  needs a future workflow.

---

## 18. Revision history

- **Revision 1:** consolidated specification (Q1–Q5, A–E).
- **Revision 2:** trust model with a session marker; staff validation
  covering every detail edit including `appointment_services`; full lock
  order; PR 3 split into 3a / 3b / 3c (Decision D pre-check conflict).
- **Revision 3:**
  - **U1:** `workspace_id` immutable in every state, for every role. Workspace
    moves are removed from the editing matrix and the lock order; immutability
    is added in PR 2; tests for direct API writes and definer functions.
  - **U2:** a canonical allowlist (`canonical_timezone_names`) plus
    existence; the regex documented as a filter only; links rejected;
    maintenance implications; allowlist pre-checks; open point U4 (canonical
    source).
  - **U3:** `service_role` direct writes refused for system fields,
    snapshots, revenue, expenses, status and protected deletes; revenue
    INSERT revoked from every client role; no general bypass; tests for
    refused and authorized paths.
  - **Marker removed (security correction):** authority now comes from
    role, trigger depth, privileges and a CI-enforced write inventory, with
    no session state. `last_visit_at` moves into `maintain_client_fields()`
    on the completed transition; `completed` requires the service revenue
    row; proofs for properties 1–7 (3.2); spoofing, nested-call, rollback
    and inventory tests.
- **Revision 4 (documentation-only correction pass; no product decision
  changed):**
  - **Inventory corrected (3.2):** protection is per protected column or
    operation, separate from normal authorized writes (client profile
    edits; member line edits on pending and confirmed appointments). Adds a
    privileged-function table, a "Normal authorized writes" table, and the
    value check for client system columns.
  - **U4 decided:** the source is `zone.tab`, keeping familiar per-country
    identifiers. Adds reproducible generation, validation against
    PostgreSQL, tests, the update procedure, and no automatic conversion of
    existing values (8.2, 13, 14).
  - **CI contract (new 3.4):** catalog enumeration of every application
    function, trigger, rule, view, event trigger, privilege and owner;
    hash-pinned reviewed entries; failure conditions C1–C12, including
    uninspectable languages, dynamic SQL and indirect calls; negative
    fixtures. Source-text search is explicitly not treated as proof.
  - **Trigger depth:** an expectation until the mandatory prerequisite tests
    D1–D8 pass (new 14.1); PR 3a stops if they don't.
  - **`delete_workspace()`:** an explicit inventory entry with a narrow
    DELETE-only exception (3.2, 4.4); deletion-flow tests are preserved and
    extended.
  - Acceptance criteria (15), rollback (16) and risks (17) aligned.
- **Revision 5 (documentation-only correction pass; no product decision or
  scope changed):**
  - **Operator boundary made explicit (3.2, 3.4, 14, 15, 17):**
    - application-accessible access (`authenticated`, `anon`,
      `service_role` and the functions they reach) is the security
      boundary;
    - trusted owner and operator access is outside it, and guards that also
      fire for `postgres` are safeguards against mistakes;
    - "only by" claims are scoped to application-accessible paths;
    - the operator capability is documented as unchanged (insert, update or
      delete revenue; delete protected rows; edit lines; bypass triggers),
      not presented as prevented;
    - the production catalog comparison detects operator DDL and disabled
      triggers, but not ad-hoc DML.
  - **Historical `last_visit_at` fixed (3.2, 6.1, 9, 10.2, 14):**
    - the maintenance update now runs only when the value would advance;
    - the value check applies only to a changed value, and an advanced value
      must match a completed appointment with service revenue;
    - unchanged historical values pass, and lowering or NULL is refused;
    - mandatory tests L1–L8, including L2 (a historical value with no
      matching revenue, then completing an older appointment).
  - New "Operator boundary" test row (safeguards only).
- **Revision 6 (documentation-only; no product decision, scope or PR
  dependency changed):**
  - **RLS policy inventory added (3.1, 3.4):** the `rls` section records each
    covered table's RLS enabled/forced state and complete policy set, and
    for each policy its command, permissive or restrictive mode, roles,
    `USING` and `WITH CHECK` expressions, and hash.
    - Covered tables: the application tables plus `storage.objects` and
      `storage.buckets`.
    - New failure conditions C13–C18, which fail closed.
    - The production comparison now explicitly includes policies and RLS
      state (3.4, 13).
  - Mandatory negative fixtures for every policy condition (14).
  - **Completion role-table entry split (3.2):**
    - a direct client-system-field write from a function body is refused at
      depth 1;
    - the nested `maintain_client_fields()` trigger is allowed at depth ≥ 2
      when the value check passes.

    The security model and D1–D8 are unchanged.
  - Acceptance (15), rollback (16) and risks (17) aligned.
- **Revision 7 (documentation-only; no product decision changed; PR
  dependencies unchanged):**
  - **Blocker fixed (3.3):** the "one appointment per request" assumption
    was wrong, because PostgREST PATCH, DELETE, bulk POST and upsert
    requests can affect many rows. The revision 6 lock order could deadlock.
  - **Decision: multi-row writes stay supported, with lock rule R1:**
    - statement-level lock triggers on `appointments` and
      `appointment_services` take every caller workspace's advisory lock in
      ascending key order before any row is touched;
    - SECURITY DEFINER functions call `lock_appointment_workspace` before
      any row lock;
    - the row trigger only uses the non-blocking `pg_try_advisory_xact_lock`
      and fails closed;
    - direct `anon` / `service_role` appointment and line writes are
      refused at statement start.
  - **Overlap (7.1):** new statement-level recheck triggers validate the
    final state of multi-row statements; multi-row swaps are refused safely.
  - **Other changes:**
    - 6.1 and 6.2 lock order;
    - the inventory field `locks_workspace_first` (C12);
    - the PR 2 scope;
    - new tests M1–M13 with control runs, and residual deadlock tests
      R-a–R-c (14.2);
    - acceptance criterion 4, PR 2 rollback order, and risks.
- **Revision 8 (documentation-only; no product decision, scope or PR
  dependency changed):**
  - **Blocker fixed: R1 and C12 contradicted `delete_workspace()`.**
    - `delete_workspace()` is documented as the **single reviewed exception**
      to R1, with the reason it stays unchanged (3.2, 3.3).
    - `locks_workspace_first` is now one of `"explicit"`, `"statement"`,
      `"reviewed_exception"` or `"not_applicable"`, each with a checkable
      condition.
    - The exception has an exact `r1_exception` entry, and the checker
      allowlists exactly `public.delete_workspace(uuid)`.
    - C12 is split into (a)–(f): DELETE-only operations, never inherited by
      a caller, and no other function may use the exception (3.4). New
      fixtures (14).
  - **The no-deadlock guarantee is narrowed** to R1-compliant appointment
    writers, explicitly excluding `delete_workspace()` (3.3, 14.2, 15).
  - **R-c tests:** RC1–RC5 (14.2):
    - every writer pairing, in both start orders;
    - a forced cycle that must observe 40P01;
    - no partial deletion, and no partial writer state;
    - the deletion flow unchanged.
  - **Other paths checked:**
    - trigger functions on appointment tables are covered by the firing
      statement's locks (`"statement"`);
    - writes that only reference appointments or clients are outside R1's
      scope, not exceptions;
    - this identified one more pre-existing residual, **R-d** (multi-row
      `visits` writes vs a multi-row appointment DELETE), now tested as
      "detected, never invalid".
  - PR 2 scope (12), rollback (16) and risks (17) aligned.
- **Revision 9 (final, documentation-only; no product decision, security
  boundary or PR dependency changed):**
  - **R-d verified from repository evidence (3.3):**
    - members and `service_role` can write `visits` in multi-row
      statements (baseline grants, `visits_access`, the S5 `WITH CHECK`);
    - `trg_visits_same_workspace_refs` takes `FOR KEY SHARE` on each
      referenced appointment;
    - an appointment DELETE locks the row before its guard runs.

    The cycle is therefore possible. Its cycle partners are named (member
    multi-row DELETE, `delete_workspace()`, multi-row key UPDATE), and why
    single-row writers can't close it is explained. New tests RD1–RD5 cover
    the INSERT and UPDATE forms, both start orders, a forced cycle,
    per-PR outcomes and invariants.
  - **Lock-order fix (3.3):**
    - `lock_appointment_workspace` called as `authenticated` locks all of
      the caller's active-member workspaces, ascending;
    - a transaction that already holds an advisory lock (checked in
      `pg_locks`) never waits for another one; it try-locks and fails
      closed;
    - new tests M7 (b) and M12 (c).
  - **Controls corrected (14.2):** C-A (statement locks off) and C-B (plus
    the revision 6 blocking row lock), each with required results. Control
    fixtures make the catalog check fail, and the database is reset before
    the real run.
  - **Cascade (3.2, 4.2, 4.4, 14, 15, 17):** the lines' ON DELETE CASCADE of
    a permitted appointment DELETE, run as `postgres`, is documented as the
    second terminal-line delete path. A blocking test is added in PR 3b.
  - **Residual protocol (14.2):**
    - outcomes 1–3, with exact post-states by ID and reference;
    - invariants I1–I6;
    - allowed SQLSTATEs per case;
    - failure conditions.

    Applied to RA, RB (PR 3a), RC1–RC5 (by writer PR) and RD1–RD5 (PR 2,
    3b, 4). RC3 and RC4 now compare IDs and references, not counts.
  - **Coverage:** M8 adds `mark_appointment_noshow`; M9 and M10 add lines,
    cascade and upsert; M13 adds `/appointment_services`.
  - **Also:**
    - TRUNCATE is recorded as not an application path (existing decision);
    - the status line is corrected to "final, awaiting approval";
    - PR scopes (12), acceptance criterion 4 (15) and risks (17) are
      aligned.
- **Revision 10 (two ID-immutability rules; no product decision, other
  security boundary or PR dependency changed):**
  - **`appointments.id` is immutable after INSERT** (new 4.6), for every
    role and every application-accessible path, enforced by
    `trg_appointments_a_lifecycle` in PR 2, next to `workspace_id`.
  - **`visits.id` is immutable after INSERT** (new 4.7), same standard,
    enforced by the new `trg_visits_a_id_immutable` in PR 2. Evidence:
    `revenues.visit_id` is `NO ACTION`, so a swap of two visit IDs would
    silently re-point revenue; `trg_visits_audit` history has no foreign
    key. Added to 3.2, 3.3, 3.4 (C11, C12 (g)), 6.3, 12, 14 (tests and
    fixtures), 15, 16 and 17.
  - **ON DELETE SET NULL interaction (4.7, 14, 17):** where the SET NULL is
    reached in each PR (including `delete_workspace()`, which deletes
    appointments before visits), and a blocking integration test: the
    visit keeps its `id`, `appointment_id` becomes NULL, the trigger
    doesn't refuse it, existing audit rows are unchanged with exactly one
    new visit UPDATE row, and two injected failures prove the DELETE and
    the SET NULL are atomic.
  - Evidence: no existing rule protected it; the referencing foreign keys
    are `ON UPDATE NO ACTION`, which don't refuse a swap of two IDs;
    `audit_logs.record_id` has no foreign key.
  - Recorded in the protected-operations table with no writer (3.2), the
    editing matrix (4.2), the trigger order and per-operation lock table
    (3.3), and the inventory: C11 tripwire, C12 (g), with negative fixtures
    (3.4, 14).
  - Tests: the appointment ID immutability tests (14) for `authenticated`,
    `anon`, `service_role`, `postgres` and a SECURITY DEFINER function,
    checking linked lines, visits, revenue and audit rows by ID; RD6
    (14.2).
  - R-d (3.3, 17): an ID change is refused, not an allowed appointment
    write. A statement that names `id` stays an R-d cycle partner while it
    passes rows whose `id` doesn't change (RD6 (a) and (d)); it's refused at
    its first changed row and never commits an ID change.
  - PR 2 scope (12, 12.2), rollback (16) and acceptance criterion 1 (15)
    aligned.
  - **Owner review corrections (documentation-only):**
    - the C11 `NEW.id` tripwire, with its forms, limits and positive
      fixtures;
    - C12 (g) takes the table-to-function relationship from the trigger
      inventory;
    - RD6 has four forms, with deadlock expectations per form;
    - §12 lists the ID and SET NULL re-runs, and §13 PR 2 checks the
      existing `visits` triggers;
    - test-plan consistency fixes in §14 (operator boundary in PR 2, fixtures
      for item (5), the refusal point for `anon` and `service_role`, the
      definer-function wording);
    - wording fixes in §3.2, §3.3, §4, §7.1 and §17.
- **Revision 11 (two changes from the PR 1 planning decisions; no product
  decision, other security boundary or PR dependency changed):**
  - **Workspace currency format (decision D4):** CHECK
    `workspaces_currency_format_check` (`^[A-Z]{3}$`) on `workspaces.currency`
    in PR 1, with a blocking PR 1 pre-check, tests for every role, rollback,
    and a note that constraints aren't in the catalog inventory (5.2, 12, 13,
    14, 16, 17). Evidence: `revenues.currency` requires this format and is
    copied from the workspace, but `workspaces.currency` was unvalidated and
    member-editable (S1), so a malformed value would have made every revenue
    insert for that workspace fail from PR 4.
  - **Wording correction (8.2):** `updateWorkspace()` has one caller, the
    Sidebar language switch (`locale` only); there's still no
    timezone-editing UI.
- **Revision 11b (review corrections to the revision 11 candidate; no product
  decision, other security boundary or PR dependency changed):**
  - **Baseline:** `main` at `d1c4977`; tree `37fc835c…` identical to the
    pre-rewrite `d9c0102`.
  - **C5 (3.4, 14):** per-function, per-condition `c5_exceptions` with
    reason and evidence; no exception for a non-`postgres` owner; the single
    `search_path` exception is `rls_auto_enable()`; stale or unexplained
    exceptions fail; new fixtures. Preserves decision D1 (existing grants
    unchanged).
  - **Acceptance (15):** new criterion 13 for the workspace currency CHECK.
- **Revision 11c (C5 made self-contained; no product decision, other
  security boundary, PR scope or dependency changed):**
  - **C5 exception register (3.4):** exactly six existing functions with
    exact signatures, conditions, reasons and evidence;
    `anon_explicit` and `public_default` checked independently; stale,
    unregistered, unexplained and non-definer exceptions fail; ownership
    never excused; the single `search_path` exception stays
    `rls_auto_enable()`.
  - **Evidence status:** explicit `anon` grants established from the
    migrations; PUBLIC grants expected, to be confirmed by the authorized
    database pre-checks.
  - **3.1 invariant 2:** strict for SECURITY DEFINER functions Phase 5 adds
    or modifies; the six existing ones are unchanged (D1) and monitored
    through the register.
  - **Fixtures (14):** negative fixtures for unregistered, stale
    `anon_explicit`, stale `public_default`, missing reason or evidence,
    non-definer and unauthorized `search_path` exceptions; positive fixtures
    for the six registered functions.
- **Revision 11d (final-verification corrections to revision 11c; no product
  decision, security boundary, PR scope or dependency changed):**
  - **F1 (3.1 invariant 2):** existing SECURITY DEFINER functions that
    Phase 5 doesn't add or modify aren't held to the list; those failing C5
    are in its register, and their other existing grants are pinned by the
    inventory (C2). The inaccurate count of six deviating functions is
    removed (`is_workspace_owner`, `bootstrap_professional_workspace` and
    `import_service_templates` also grant `service_role`).
  - **F2 (3.4):** Part B `public_grants` is authoritative for PUBLIC
    EXECUTE; `acl_is_default = false` is the expected state, still subject
    to authorized verification. The register's six functions, conditions
    and reasons are unchanged.
