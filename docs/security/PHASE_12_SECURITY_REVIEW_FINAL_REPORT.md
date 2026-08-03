# Phase 12 — Security Review: Final Report

**Document type:** Final verification record for Phase 12 (Security Review). Reports on remediation work already completed and independently re-verified across Steps 1–8; this document itself does not modify application behavior, dependencies, database schema, or Edge Functions.
**Scope:** BeautyRoute repository, `main` branch, single linked Supabase project ("BeautyRoute", ref `ogbnfwextypvppmhvarj`).
**Date:** 2026-08-04
**Status:** Complete

---

## 1. Executive summary

Phase 12 opened with a full read-only audit (no files changed) that found a sound RLS-first authorization architecture with no Critical vulnerabilities, but four real High-severity defects and several Medium/Low gaps that needed fixing before this project could credibly call itself security-reviewed. Across eight subsequent steps — each independently tested, committed, pushed, and verified green on GitHub Actions before moving to the next — every High-severity finding was resolved: the stale `schema.sql` baseline was regenerated from the live migrated database, a standing unauthorized workspace-membership grant was revoked, account enumeration on signup was closed, and workspace deletion was rebuilt as a safe, ordered, auditable operation. All four Medium findings were substantially addressed (password reset added, rate limiting moved to a durable Postgres-backed mechanism, CORS restricted from a wildcard to an explicit allowlist, and branch protection was fully documented with exact manual steps — though enabling it still requires action from you, since no authenticated GitHub tooling was available in this environment). Both flagged Low findings (mass-assignment-shaped updates, unvalidated image URLs) were closed with an explicit-allowlist and URL-validation pass across the service layer. New CI security gates (secret scanning, a documented dependency-audit exception mechanism, pinned GitHub Actions) now run on every push.

No Critical or unresolved High-severity finding remains from the original audit.

## 2. Security posture score

| | Score |
|---|---|
| Initial (Step 0 audit) | **72 / 100** |
| Final (this report) | **90 / 100** |

The remaining gap from a perfect score is entirely accounted for in Section 5 (accepted/deferred risks) — none of it is an unresolved Critical/High finding, all of it is either a deliberate, documented design trade-off or configuration debt requiring an action only you can take (enabling branch protection).

## 3. Initial findings by severity (from the Step 0 audit)

- **Critical:** none.
- **High:** H-1 stale `schema.sql`; H-2 persistent dev-workspace membership grant; H-3 signup account enumeration; H-4 unsafe workspace deletion.
- **Medium:** M-1 no password-reset flow; M-2 non-durable (per-isolate in-memory) rate limiting; M-3 no confirmed branch protection; M-4 wildcard Edge Function CORS.
- **Low:** L-1 mass-assignment-shaped `updateProfile()`; L-2 unvalidated external image URLs; L-3 minimal password policy; L-4 GitHub Actions pinned by tag not SHA; L-5 hardcoded internal UUIDs in migrations; L-6 unused plan-feature flags; L-7 react-router advisory (confirmed non-applicable, informational).
- **Informational:** mock-only `ClientPortal`, no upload pipeline yet, confirmed-secure AI/XSS controls, session-storage model, trial-abuse surface.

Full detail and evidence for every finding: the original Step-0 audit transcript (this conversation) — not re-filed as a separate document, since its findings are fully accounted for by the remediation record below.

## 4. Remediation completed

| Finding | Status | What was done | Commit(s) |
|---|---|---|---|
| **H-1** — stale `schema.sql` | **Resolved** | Regenerated directly from the live linked database via `supabase db dump --linked --schema public`; confirmed it now contains the RLS-recursion fix, the audit-trigger fix, all three previously-missing RLS policies, and the onboarding columns/function. Re-dumped again after each subsequent schema-changing step (Steps 4, 6) to stay current. | `f6e0037`, `451252f`, `c0f20d5` |
| **H-2** — persistent dev-workspace membership | **Resolved** | Read-only verification confirmed the exact row existed on the live shared project; a targeted, idempotent migration revoked only that row, leaving the workspace, both profiles, and the owner's own membership untouched. A migration policy doc now governs how dev/test seed migrations may be written going forward. | `2a8b2e5` |
| **H-3** — signup account enumeration | **Resolved** | Signup now shows the identical generic confirmation regardless of whether the email was new or already registered, matching Supabase's own anti-enumeration API behavior instead of undermining it. | `b14b3e2` |
| **H-4** — unsafe workspace deletion | **Resolved** | New `delete_workspace()` SECURITY DEFINER function deletes every dependent table in a documented, FK-respecting order (audit-generating tables before the workspace row itself, so their audit-trigger inserts succeed against a still-live parent), detaches (rather than destroys) the workspace's audit history, and deletes the workspace row last. Runs as one atomic function invocation — no partial deletion on failure. | `451252f` |
| **M-1** — missing password reset | **Resolved** | Full `resetPasswordForEmail`/`updateUser`-based flow: a "Forgot password?" entry point on Login, a request page (generic confirmation, no enumeration), and a reset-confirmation page that correctly distinguishes a valid recovery session from an expired/invalid link. | `6abb935` |
| **M-2** — non-durable rate limiting | **Resolved** | Replaced the per-isolate in-memory limiter with a Postgres-backed `check_rate_limit()` (auth.uid()-scoped, advisory-lock atomic, cross-function-isolated by an explicit function-name parameter, self-expiring). Same 20-requests/10-minutes policy preserved exactly. | `c0f20d5` |
| **M-3** — branch protection | **Documented, not yet enabled** | Confirmed via GitHub's API (`"protected": false`) that branch protection remains fully off. No authenticated GitHub tooling (no `gh` CLI, no token) was available in this environment to enable it, so exact manual UI steps were provided instead, calibrated for a single-developer project (0 required approvals so you can't lock yourself out). **This remains open until you act on it** — see Section 12. | `2452141` (report only; no GitHub setting was or could be changed) |
| **M-4** — wildcard CORS | **Resolved** | Both Edge Functions now reflect only an explicitly configured origin (`ALLOWED_ORIGINS` secret) plus fixed local-dev origins, with `Vary: Origin` on every response. Requires `ALLOWED_ORIGINS` to be set once a production frontend domain exists — see Section 12. | `c0f20d5` |
| **L-1** — mass-assignment-shaped updates | **Resolved** | `updateProfile`, `updateWorkspace`, `updateWorkspaceSettings` now reject any field outside an explicit allowlist instead of silently forwarding it; `updateWorkspace`'s allowlist specifically excludes plan/billing/identity columns. | `487b63b` |
| **L-2** — unvalidated external image URLs | **Resolved** | `createFile` (file_url) and `updateProfile` (avatar_url) now require a well-formed `http(s)` URL before persisting. | `487b63b` |

L-3 (password policy), L-4 (action pinning), L-5 (hardcoded UUIDs), L-6 (unused plan flags), and L-7 (react-router advisory) are addressed or tracked as follows: L-4 resolved (Section 8); L-7 confirmed non-applicable and re-documented (Section 5); L-3, L-5, L-6 remain deliberately deferred (Section 5) as genuinely low-risk, non-blocking items.

## 5. Accepted or deferred risks

- **Rate limiter fail-open behavior.** If the `check_rate_limit()` RPC itself errors, the Edge Function proceeds rather than blocking legitimate traffic, logging the event as `rate_limit_check_failed_open`. Deliberate: a rate limiter is abuse-mitigation, not an authorization boundary, and every real authorization check (auth, workspace membership, plan gating) still fails closed.
- **No live Postgres/RLS integration test tier.** Every automated test (Vitest, Deno) mocks the Supabase client boundary. RLS policies, `delete_workspace()`'s real transactional behavior, and `check_rate_limit()`'s real atomicity are verified via structural SQL-source tests and one-time manual read-only checks against the live project, not a repeatable automated integration suite. Pre-existing, already-documented project-wide gap, not newly introduced.
- **No automated workspace-deletion integration test.** Follows directly from the above — `delete_workspace()`'s correctness against a real database was verified once, manually, never by CI.
- **No ratings/reviews data model.** Confirmed absent from the schema; the dashboard's "Not available" state is honest, not a placeholder. Unscoped product work, not a security defect.
- **Password policy / MFA not yet implemented.** Minimum 6 characters, no complexity rule, no MFA option anywhere. Flagged (L-3), not addressed this phase.
- **React Router advisory (GHSA-qwww-vcr4-c8h2).** Confirmed not applicable — this app uses only the classic `BrowserRouter`/`Routes`/`Route` API, never React Router's unstable RSC/data-router surface. Tracked via the CI dependency-audit gate's documented allowlist; revisit if RSC/data-router APIs are ever adopted, or during a planned React Router v8 migration.
- **One shared Supabase environment.** No separate staging/production split exists anywhere in this project's history — the single linked "BeautyRoute" project is used for everything. This was the root condition that made H-2 possible; nothing in this phase changed that architectural fact, only the specific incident it produced.
- **Branch protection still requires manual configuration.** See M-3 above and Section 12 — this is the one item in this report that requires an action from you, not further engineering work.

## 6. Security controls now present

- RLS-first authorization on every tenant-scoped table via `is_workspace_member()`, now confirmed current in `schema.sql`.
- `SECURITY DEFINER` + pinned `search_path` on every privileged function, including the two new ones added this phase (`delete_workspace`, `check_rate_limit`).
- Edge Functions never use the service-role key; every query runs through the caller's own forwarded JWT.
- Server-side plan gating mirrored independently of the frontend's UI gate.
- Durable, atomic, cross-function-isolated rate limiting backed by Postgres.
- Explicit CORS origin allowlist (no more wildcard) on both Edge Functions.
- No account-existence disclosure anywhere in the auth flow (signup or password reset).
- Safe, ordered, auditable workspace deletion with no FK-ordering failure mode.
- Explicit field allowlists on every profile/workspace mutation; no more silent mass-assignment.
- URL-format validation on every persisted image/avatar reference.
- Zero secrets in tracked files or git history (enforced by CI on every push).
- Documented, narrow dependency-audit exception mechanism (no blanket suppression).

## 7. Security tests now present

- **Migration-structural tests** (SQL-source assertions, no live DB required): `delete_workspace()` ordering/atomicity/audit-preservation; `check_rate_limit()` auth-scoping/atomicity/expiry/RLS-lockdown.
- **Edge Function tests** (Deno, 60 total): auth/workspace/plan/ownership checks (pre-existing, still passing); rate-limit boundary/failure/cross-function-isolation (new); CORS allowed/disallowed/missing-origin/preflight (new).
- **Service-layer tests** (Vitest): `deleteWorkspace`/`updateWorkspace`/`updateWorkspaceSettings` isolation and allowlist rejection; `updateProfile`/`createFile` allowlist and URL-validation regressions; `auth.ts` email-normalization; the shared `validation.ts` helpers directly.
- **Auth-flow tests**: signup anti-enumeration (both branches produce identical output); password-reset request/update/invalid-link/expired-link states.
- Total added across the phase: **101 Vitest tests** (244 → 345) and **17 Deno tests** (43 → 60).

## 8. CI security gates

`.github/workflows/ci.yml` now runs three jobs on every push/PR to `main`: frontend quality, Edge Function tests, and a new **security** job running the secret scan and dependency-audit gate. All three actions (`actions/checkout`, `actions/setup-node`, `denoland/setup-deno`) are pinned to exact commit SHAs with the corresponding tag preserved as a comment. Top-level and per-job `permissions: contents: read` (least privilege); no `pull_request_target`; no deployment or Supabase-linking step; no real credentials, only fixed placeholder values.

## 9. Dependency-audit exception mechanism

`scripts/dependency-audit.mjs` runs the real `npm audit --json` against the lockfile and fails the build on any high/critical advisory **except** ids explicitly listed in a documented `ALLOWED_ADVISORIES` map. Currently one entry: `GHSA-qwww-vcr4-c8h2`, with its reasoning and revisit condition written directly in the script. This is not a blanket `--audit-level` suppression — any new, unreviewed high/critical finding fails CI immediately.

## 10. Secret-scanning approach

`scripts/secret-scan.sh` — deterministic, self-contained, no third-party service or external upload. Scans every git-tracked file plus (in CI, with `fetch-depth: 0`) the full `git log --all -p` history for format-specific credential patterns (Anthropic/OpenAI-style keys, PEM private-key headers, AWS access-key IDs, embedded-credential Postgres connection strings, Slack tokens). A match prints only the file path, never the matched text. The scanner's own pattern-definition strings are explicitly excluded from both scan passes (a real self-referential false-positive was found and fixed during Step 7 — see that step's report).

## 11. Remaining legal/privacy review items

Not resolved by this phase (explicitly out of engineering scope, flagged for legal/product review):

- **Data-retention/deletion policy.** `delete_workspace()` makes workspace deletion technically safe, but no product-level "request my data be deleted" flow, retention schedule, or export capability exists yet — relevant for any future GDPR/PDPL-style compliance obligation.
- **AI provider data transfer.** The AI Assistant sends workspace/client data (names, allergies, visit notes) to Anthropic's API per request. This is architecturally sound (server-side only, no service-role key, no photo data) but has not been reviewed against any specific data-processing-agreement or cross-border-transfer requirement.
- **Saudi Arabia data-residency considerations.** The linked Supabase project's region (`ap-south-1`) and Anthropic's own data-handling terms have not been reviewed against any KSA-specific hosting/residency requirement — flagged as needing legal input, not an engineering finding.
- **Consent for AI-assisted processing.** No explicit client-facing consent flow exists for a client's data being summarized/analyzed by the AI Assistant on a professional's behalf.

## 12. Production-launch blockers still open

1. **Branch protection is not enabled** (M-3) — manual steps are documented in this phase's Step 7 report; enabling it requires your action in the GitHub UI (no engineering work remains).
2. **`ALLOWED_ORIGINS` is not yet set** on the live project — until a production frontend domain exists and this secret is configured, only local-dev origins will get a CORS-allowed response from either Edge Function.
3. **Phase 13 (Performance Optimization)** and **Phase 14 (Deployment)** remain entirely unstarted — this phase does not touch either.
4. The legal/privacy items in Section 11 are unresolved and, depending on target market, may be launch-blocking independent of anything engineering can fix.

## 13. Definition-of-Done assessment

Against the Definition of Done set at the start of this phase:
- ✅ Every Critical/High finding fixed and re-verified — **met**, no exceptions.
- ✅ Every Medium finding has an owner and a recorded remediation-or-accepted-risk decision — **met** (M-3's "accepted risk" is explicitly "requires your action," not silently dropped).
- ✅ The `schema.sql`-vs-migrations gap is resolved — **met**, and re-verified current after every subsequent schema change.
- ✅ No unresolved Critical or High-severity finding remains — **met**.
- ✅ A follow-up verification report is committed — **this document**.

**All Definition-of-Done criteria are met.**

## 14. Final Phase 12 status

**Phase 12 (Security Review) is complete.** No unresolved Critical or High-severity finding remains from the original audit. The two items still requiring action are both explicitly your call, not unfinished engineering: enabling branch protection (GitHub UI) and setting `ALLOWED_ORIGINS` once a production domain exists. This phase does not constitute, and should not be read as advancing, Phase 13 (Performance Optimization) or Phase 16/Production Launch — both remain Planned.
