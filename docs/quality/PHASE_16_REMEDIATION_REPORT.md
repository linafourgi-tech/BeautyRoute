# Phase 16 — Production Issue Remediation: Final Report

**Document type:** Internal quality/verification record. Reports on work already completed and independently verified; does not itself authorize or perform any further change.
**Scope:** Fixing three real, previously-documented production defects surfaced during Phase 11/15 testing work, plus a dependency security assessment — all on `main`.
**Status:** Complete
**Date:** 2026-08-03

---

## 1. Phase objective

Phase 15's testing effort (see `docs/testing/PHASE_15_FINAL_REPORT.md`) found three real production defects during test-writing but explicitly left them unfixed, reported rather than silently patched, pending separate approval:

1. An accessibility-naming defect in `Appointments.jsx`'s Services field.
2. Hardcoded, non-real revenue and rating figures on the Stylist Dashboard.
3. A native-vs-application email-validation inconsistency on the Login page.

Phase 16's objective was to remediate each of these three defects individually — one step at a time, with tests updated and full validation run after each — and to separately assess a dependency security advisory flagged against `react-router`/`react-router-dom`. No Security Review, Performance Optimization, or Production Launch work was in scope.

---

## 2. Step 1 — Appointments service-control accessibility fix

**Defect:** The Services field wrapped multiple independent service-toggle buttons inside a single `<label>`. Per the browser accessible-name algorithm, a wrapping `<label>` overrides a labelable element's own text content as its accessible name — so every service button was announced to assistive technology as "Services" instead of its own service name, making the buttons indistinguishable from one another.

**Fix (`src/pages/Appointments.jsx`, commit `7a326e9`):** Replaced the single-control `Field` wrapper around the Services group with a new `FieldGroup` component using a native `<fieldset>` + `<legend>` — the correct HTML pattern for a group of independent controls sharing one group-level label. The group itself now has an accessible name of "Services" (exposed as `role="group"`), while each service toggle button keeps its own distinct accessible name (e.g. "Haircut · 45min"). Added `aria-pressed` to each toggle button to expose selection state. `Field` (unchanged) continues to wrap genuinely single-control fields (Client, Date, Start time, Status, Location). `toggleService`, `validate`, and `handleSubmit` were not touched — this was a markup/semantics fix only, no business logic changed.

**Tests (`src/pages/Appointments.test.jsx`):** Updated two existing tests to query buttons by their real accessible names instead of the previous text-content workaround. Added a new regression test asserting: three services each get a distinct accessible name, none of them is named "Services," the group itself is reachable via `getByRole("group", { name: "Services" })`, and `aria-pressed` toggles independently per button.

---

## 3. Step 2 — Dashboard business metrics now derived from live data

**Defect:** `StylistDashboard.jsx` displayed a hardcoded "SAR 5,600" revenue figure and a hardcoded "4.9 ★" rating — neither reflected any real workspace data.

**Revenue fix:** Added a new service-layer function `getMonthlyRevenue(workspaceId, referenceDate)` (`src/services/revenue.ts`) that queries the real, RLS-enforced `revenues` table, scoped to the given workspace and to the calendar month of the reference date (defaulting to now), and sums the generated `net_total` column. `StylistDashboard.jsx` calls this alongside the existing `getAppointments`/`getClients` calls and renders the real total as `SAR {total.toLocaleString("en-US")}` under the label "revenue this month." No component queries Supabase directly — the service-layer boundary is preserved.

**Rating finding:** The schema (`schema.sql`) was inspected table-by-table; no reviews/ratings table exists anywhere in the database. Rather than fabricate a number or add new schema unprompted, the dashboard now shows an honest "Not available" state under "average client rating." Building a real ratings/reviews data model remains future product scope, not implemented here.

**Tests (`src/services/revenue.test.ts`, new; `src/pages/StylistDashboard.test.jsx`, updated):** 5 new service-layer tests cover query shape/workspace scoping, empty-sum, null/malformed `net_total` treated as 0, error propagation, and differing month boundaries. Dashboard tests were expanded to prove revenue actually changes with the mocked data (not a fixed number), that a zero-revenue month renders an honest `SAR 0` (disambiguated from the also-zero "Est. fuel" stat), that the rating shows "Not available," and a final regression test asserting neither `"SAR 5,600"` nor any `4.9`-pattern rating appears under any mocked value.

---

## 4. Step 3 — Unified accessible login validation

**Defect:** The native browser's built-in `<input type="email">` constraint validation could intercept an invalid-email submission before BeautyRoute's own styled validation message ever appeared, producing an inconsistent, browser-dependent UX.

**Fix:** Added `noValidate` to the login `<form>` (`src/pages/Login.jsx`), making the app's existing `validate()` function (already present, using `EMAIL_RE`) the single, consistent source of truth for all validation — native browser validation no longer runs at all. The shared `Input` component (`src/components/ui/Input.jsx`) was extended to wire `aria-invalid="true"` on an input when it has an active error, and `aria-describedby` linking the input to its error/hint text via a stable `useId()`-derived id; the error `<span>` gets `role="alert"` so it's announced immediately when it appears. This change is purely additive (only activates when `error`/`hint` is already being shown) and is shared by every consumer of `Input` (Login, Signup, Onboarding, Clients, Services, etc.) — verified safe via the full test suite passing afterward.

**Tests (`src/pages/Login.test.jsx`):** Removed the old `fireEvent.submit(...)` artificial-bypass test; replaced it with a real `user.click()` submission test proving the app's own "Enter a valid email address." message is what appears. Added a new regression test asserting the email input has `aria-invalid="true"`, `aria-describedby` pointing at the real error message's id, and that the error element has `role="alert"`. Loading-state and server-error behavior were left unchanged and remain covered by existing tests.

---

## 5. Step 4 — Dependency security assessment (react-router / react-router-dom)

**Installed versions:** Both `react-router` and `react-router-dom` are at `7.18.1`.

**Advisory:** GHSA-qwww-vcr4-c8h2 — "React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response," CWE-352, severity High (CVSS 7.1), affecting `react-router` 7.12.0–8.2.x, fixed in 8.3.0. Per the official GitHub Security Advisory text, the vulnerability "exclusively impacts applications using the unstable RSC APIs in React Router. It does not affect standard implementations."

**Repository-specific finding:** BeautyRoute is a plain client-side Vite SPA using the classic declarative `<BrowserRouter>`/`<Routes>`/`<Route>` API (`src/App.jsx`). A repository-wide search confirmed no `createBrowserRouter`/`RouterProvider` data router, no `loader`/`action` route config, and no `unstable_*` or RSC imports anywhere in `src/`. Both route guards (`ProtectedRoute.jsx`, `OnboardingRoute.jsx`) are plain components using `<Navigate>` and hooks, with no data-router wiring.

**Conclusion: current usage is not affected.** The installed version is nominally inside the advisory's affected range, but the vulnerable code path (unstable RSC APIs) is not present anywhere in this codebase's actual configuration. No dependency change was made or is recommended at this time — a same-major upgrade path within v7 does not exist (the fix requires the major jump to 8.3.0+), and there is no exploitable precondition here to justify that jump's breaking-change risk today.

**Correction to the original Step 4 assessment:** The initial report incorrectly stated that no dedicated tests exist for the route guards. This was wrong — `src/components/routing/ProtectedRoute.test.jsx`, `OnboardingRoute.test.jsx`, and `RouteLoading.test.jsx` already exist (written during Phase 15/11) and are included in the current 32-file, 255-test Vitest suite. This report corrects that record.

This advisory should be revisited only if the app ever adopts React Router's data/RSC APIs, or as part of a routine, independently-planned major-version migration to v8.

---

## 6. Tests added and final counts

| Suite | Before Phase 16 | After Phase 16 |
|---|---|---|
| Vitest test files | 31 | 32 |
| Vitest tests | 244 | 255 |
| Deno tests (Edge Functions + shared plan rules) | 43 | 43 (unchanged — no Edge Function code was touched) |

Net new Vitest tests: +11 (Appointments regression coverage, `revenue.ts` service-layer tests, dashboard revenue/rating tests, Login validation/accessibility regression tests).

**Final validation run (this step):**
- `npm run lint` — 0 findings.
- `npm run test:run` — 32 files, 255 tests, all passing.
- `npm run test:coverage` — 255 tests passing; 83.72% statements / 71.74% branches / 74.39% functions / 85.67% lines overall (full per-file breakdown available in the coverage report; lowest-coverage areas remain a handful of not-yet-exercised `components/ui` primitives such as `Table`, `Toast`, `Tooltip`, `IconButton`, `Pagination`, `Radio` — pre-existing gaps, not introduced by this phase).
- Deno tests (`_shared/planRules.test.ts`, `ai-assistant/index.test.ts`, `route-planner/index.test.ts`, matching the exact CI invocation) — 43 tests, all passing.
- `npm run build` — succeeds; one pre-existing bundle-size warning (`mapbox-gl` chunk >500kB), not a new issue and not a build failure.
- Tracked-secret scan across all git-tracked files (API-key/private-key patterns) — no matches.

---

## 7. Remaining product/technical debt

- **No ratings/reviews data model.** Confirmed no such table exists in `schema.sql`. The dashboard's "Not available" state is honest, not a placeholder for hidden data — building this is unscoped future product work.
- **No Supabase local-dev/RLS integration tier.** All current tests mock the Supabase client boundary; RLS policies themselves are exercised by the real Postgres engine in production but not yet by an automated integration test against a real (local or ephemeral) Postgres instance.
- **No enforced coverage thresholds.** Coverage is measured and reported but nothing in CI currently fails a build for falling below a specific percentage.
- **No end-to-end test suite.** All current automated tests are unit/component-level (Vitest + Testing Library) or Edge-Function-level (Deno); no browser-driven, full-stack end-to-end suite exists yet.
- **Route-level code splitting/performance work still pending.** The production build emits a >500kB warning for the `mapbox-gl` chunk; no dynamic-import/code-splitting work has been done. This is explicitly Phase 13 (Performance Optimization) scope, not touched here.
- **React Router advisory GHSA-qwww-vcr4-c8h2** — confirmed not applicable to current usage; should be revisited only if RSC/data-router APIs are adopted, or during a planned, independently-scoped v8 migration.

---

## 8. Security Review readiness

Phase 16 fixed three real, user-facing/data-integrity defects and closed out one dependency-advisory question, but it was explicitly scoped as issue remediation, not a security review. It does **not** constitute or substitute for Phase 12 (Security Review): RLS policy correctness, Edge Function authorization boundaries, and full secret/token handling have not been formally reviewed end-to-end as a dedicated exercise. Phase 12 (Security Review) remains **Planned** and un-started by this work.

---

## 9. Final Phase 16 status

**Phase 16 (Production Issue Remediation) is complete.** All three documented production defects (accessibility, hardcoded metrics, validation UX) have been fixed, tested, and independently verified; the dependency security question has been assessed and resolved (no action required, with the record corrected regarding existing route-guard test coverage). Every step was committed and pushed individually with a real GitHub Actions run confirmed green. This phase does not advance, and should not be read as advancing, Phase 12 (Security Review), Phase 13 (Performance Optimization), or Phase 16 (Production Launch) in `docs/PROJECT_ROADMAP.md`'s own internal numbering — those remain **Planned**.

**Recommended next priority:** Phase 12 (Security Review), given it is the most critical unstarted phase blocking further launch-track work, followed by closing the technical-debt items listed in Section 7 that a security review would likely also surface (particularly the missing RLS-integration test tier).
