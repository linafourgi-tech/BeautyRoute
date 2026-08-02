# Phase 15 — Automated Testing Foundation: Final Report

**Document type:** Phase completion report. Records what was actually built,
tested, and verified during Phase 15 — not a design document, not a claim
about work outside this phase's scope.
**Date completed:** 2026-08-02
**Corresponds to roadmap item:** `docs/PROJECT_ROADMAP.md` → **Phase 11 —
Testing**.

---

## 1. Phase objective

Create a practical automated test foundation — frontend (Vitest + React
Testing Library) and backend (Deno tests for both Supabase Edge Functions
and the shared plan-gating module) — that protects the application's
already-built, already-live-verified behavior before visual redesign and
further feature development, and wire a CI workflow that runs it on every
push/PR.

## 2. Completed steps and commit hashes

| Step | Description | Commit |
|---|---|---|
| 1 | Test architecture and strategy (`docs/testing/TEST_STRATEGY.md`) | `62e6705` |
| 2 | Vitest + React Testing Library foundation | `47202ba` |
| 3 | Core utility/service unit tests (plans, appointment mapping, route optimizer) | `42a2be4` |
| 4 | Auth, workspace, and subscription component tests | `994de54` |
| 5 | Domain UI tests (Clients, Services, Appointments, Beauty Passport, Dashboard) | `541fed0` |
| 6 | Deno Edge Function tests (ai-assistant, route-planner, planRules) | `6082dc2` |
| 7 | Lint cleanup (`npm run lint` → exit 0) | `aba81f8` |
| 8 | GitHub Actions CI workflow | `22ad6f1` |
| 9 | This final report | *(this commit)* |

One unrelated commit (`cf8c807`, "docs(ai): use vendor-neutral assistant
wording") landed on `design-integration` between Steps 3 and 4, made outside
this Phase 15 work. It is not one of the 9 steps above and is noted here
only so the commit range isn't mistaken for a Phase 15 change.

## 3. Test infrastructure added

- **Frontend:** Vitest 4, `@testing-library/react` 16, `@testing-library/
  jest-dom` 7, `@testing-library/user-event` 14, `jsdom` 30, `@vitest/
  coverage-v8` 4. Config lives in `vite.config.js`'s `test` block; setup
  file `src/test/setup.js` (jest-dom matchers + a `window.matchMedia`
  polyfill for `AuthShell`'s mobile-breakpoint detection).
- **Backend:** the Deno CLI (2.9.4) was installed in this environment
  specifically for this phase (flagged as a gap in the Step 1 strategy
  doc, closed in Step 6). `supabase/functions/_shared/edgeTestUtils.ts`
  (test-only, not imported by any production function) provides the two
  boundaries needed to test `Deno.serve`-based handlers: capturing the
  handler function instead of letting it bind a real network listener,
  and a `fetch` stub routed by URL substring — verified empirically
  against the real `npm:@supabase/supabase-js@2` package's actual
  request/response shapes before being relied upon.
- **CI:** `.github/workflows/ci.yml` — two jobs (`frontend`, `edge-
  functions`), triggered on push/PR to `design-integration` plus manual
  `workflow_dispatch`.

## 4. Vitest / React Testing Library results

```
Test Files  31 passed (31)
     Tests  244 passed (244)
```

Covers: `src/lib/{plans,appointmentView,routeOptimizer}.js`, `src/services/
{subscription,ai,route}.ts`, `useSession`/`useSubscription`/
`useCurrentWorkspace`, `WorkspaceContext`, `ProtectedRoute`/`OnboardingRoute`/
`RouteLoading`, `Login`/`Signup`, all 5 onboarding step components plus the
full `Onboarding` page flow, `TrialBanner`/`FeatureGate`/`UpgradeRequired`/
`Pricing`, and the five domain pages (`Clients`, `Services`, `Appointments`,
`BeautyPassport`, `StylistDashboard`).

## 5. Deno Edge Function test results

```
ok | 43 passed | 0 failed
```

- `planRules.test.ts` — 8 tests (every tier × every feature, unknown-tier
  fallback, expiry handling, frontend-consistency cross-check).
- `ai-assistant/index.test.ts` — 19 tests (auth, action/workspace
  validation, workspace membership, client/visit ownership, plan-gate,
  rate-limiting, no-service-role-key, provider error mapping, log
  redaction, no-real-Anthropic-calls).
- `route-planner/index.test.ts` — 16 tests (auth, action/date validation,
  workspace membership, plan-gate, `route_too_large`, missing-address
  separation, low-confidence-geocode-as-unresolved, secret-token
  containment, cancelled-exclusion, timezone-aware boundaries, reroute
  foreign-id/duplicate-id/empty-order rejection, valid subset acceptance).

Stability: both suites were run multiple times back-to-back during
development with identical results each time (no observed flakiness once
authoring issues were fixed).

## 6. Coverage summary

```
Statements   : 83.51% ( 1054/1262 )
Branches     : 71.32% ( 786/1102 )
Functions    : 74.2%  ( 305/411 )
Lines        : 85.58% ( 926/1082 )
```

No coverage threshold is configured or enforced (see Section 10). Notable
per-module figures:

| Module | Line % | Note |
|---|---|---|
| `services/{ai,route,subscription}.ts` | 100/100/100 | fully covered |
| `_shared/planRules.ts` (Deno) | 95.2% | — |
| `lib/routeOptimizer.js` | 94.4% | one 2-opt branch never triggered by test fixtures |
| `Onboarding.jsx` | 73.2% | the "services were selected" branch of Finish is untested (every test walked the empty-services path) |
| `BeautyPassport.jsx` | 76.3% | AI-panel copy-to-clipboard and a couple of secondary branches untested |
| `route-planner/index.ts` (Deno) | 77.0% | — |
| `ai-assistant/index.ts` (Deno) | 51.4% | the `chat` action's multi-turn tool-use loop and its 5 individual tool implementations are largely untested — would require mocking a multi-turn Anthropic conversation, out of this phase's scope |
| `components/ui/*` (Dialog, Table, Toast, IconButton, Pagination, Radio, Switch, Tooltip) | mostly 0% | **not a real gap** — these appear only because the `../../ui` barrel `index.js` re-exports every file, pulling them into the module graph; none were part of any Phase 15 step's target list |

## 7. CI workflow and successful GitHub Actions run

`.github/workflows/ci.yml` runs two jobs — `frontend` (lint → test:run →
test:coverage → build) and `edge-functions` (Deno tests) — on push/PR to
`design-integration` and manual dispatch. The first real run, triggered by
Step 8's push (commit `22ad6f1`), completed successfully:

- Run: [`30754956658`](https://github.com/linafourgi-tech/BeautyRoute/actions/runs/30754956658)
- `status: completed`, `conclusion: success`
- Every step in both jobs reported `success` (confirmed via the GitHub
  REST API, since this repository is public).

## 8. Production bugs/design issues discovered but not fixed

Three issues were found while writing tests and were deliberately **not**
fixed, per this phase's "stop and report, don't silently fix" instruction:

1. **Appointments services accessibility naming issue.** `Appointments.jsx`'s
   local `Field` component wraps its entire `children` inside one shared
   `<label>`. For the "Services" field specifically, this makes every
   service-toggle button's accessible name resolve to "Services" (the
   field's label text) instead of its own text ("Haircut · 45min", etc.) —
   the enclosing `<label>`'s text overrides a labelable element's own
   content per the accessible-name algorithm. A real screen-reader user
   would hear "Services" for every single service chip, not which service
   it is. Found in Step 5; tests were adjusted to query by rendered text
   content instead of accessible role/name, with the issue documented
   inline at both call sites in `Appointments.test.jsx`.
2. **StylistDashboard hardcoded revenue/rating metrics.** `"SAR 5,600"`
   ("revenue so far") and `"4.9 ★"` ("average client rating") are hardcoded
   string literals in `StylistDashboard.jsx`, not derived from any real
   data — unlike "active client passports," which correctly reflects
   `clients.length`. Found in Step 5; `StylistDashboard.test.jsx` includes
   a dedicated test that supplies 3 real clients and 1 real appointment and
   confirms these two values never change, specifically to keep this
   visible rather than certify it as correct.
3. **Login native email-validation UX inconsistency.** `Login.jsx`'s
   `<input type="email">` has no `noValidate` on its `<form>`. For an email
   with no `@` at all, the browser's own native constraint-validation
   intercepts submission before React's `onSubmit` ever runs, so the app's
   custom `EMAIL_RE`-based message ("Enter a valid email address.") may
   rarely or never actually reach real users for the most common invalid-
   email case — the browser's own native tooltip shows instead. Nothing
   breaks functionally (invalid emails still can't be submitted either
   way), but the two error presentations are inconsistent. Found in Step 4;
   `Login.test.jsx`'s test for this case uses `fireEvent.submit` to bypass
   native validation and exercise the app's own logic directly, with the
   real-world implication documented inline.

## 9. Known coverage gaps

- `Onboarding.jsx`'s services-selected Finish branch (Section 6).
- `ai-assistant`'s chat tool-use loop and its 5 tool implementations
  (Section 6).
- Supabase-local-dev/RLS integration-level tests do not exist (Section 10)
  — everything server-side is tested at the unit/mocked-boundary level,
  not against a real Postgres instance with RLS policies actually enforced.
- End-to-end (Playwright) tests do not exist — explicitly out of scope for
  every step in this phase.
- BR-FS-001 (the face-shape classifier) has no evaluation tests — it has no
  model code to evaluate; not applicable yet.

## 10. Known technical debt

- **No Supabase local/RLS integration tier exists, in CI or otherwise.**
  `docs/testing/TEST_STRATEGY.md` Section 7/8 documents this as a
  near-term follow-up: real RLS policy enforcement can only be genuinely
  verified against a live Postgres instance, which neither this local
  environment (Docker daemon not running) nor the current CI workflow
  provisions. What Step 6 tests instead is the application-code
  authorization logic (workspace/client/visit ownership checks) that runs
  alongside RLS, not RLS itself.
- **No coverage thresholds are configured or enforced**, per explicit
  instruction across every relevant step — `test:coverage` reports a
  number but nothing fails the build on a regression yet.
- **`npm audit` reports 2 high-severity advisories** in `react-router`/
  `react-router-dom` (GHSA-qwww-vcr4-c8h2), first surfaced in Step 2 and
  explicitly out of scope for every step since — fixable only via a
  breaking downgrade to `react-router-dom@7.11.0`.
- **A recurring local Vite dependency-optimization cache issue**
  (`node_modules/.vite` going stale, producing `Cannot read properties of
  undefined (reading 'config')` on the first test run after certain
  changes) was hit repeatedly during Steps 3–5. Clearing the cache always
  resolved it; it never affected CI (a fresh checkout has no stale cache
  to begin with).
- **A Windows/OneDrive-specific `npm ci` `EPERM` issue**, hit during Step
  8: a locked native binary (likely OneDrive sync interference) caused
  `npm ci` to fail and partially corrupt `node_modules` locally. Repaired
  with a plain `npm install` (confirmed `package.json`/`package-lock.json`
  were untouched). This is a local-machine quirk, not a real dependency
  problem — GitHub's Linux CI runners don't have this issue, confirmed by
  the successful run in Section 7.

## 11. Confirmation: no real Anthropic, Mapbox, or production Supabase calls

- **Frontend tests:** every test that touches `src/lib/supabase.js`
  (directly or transitively) mocks it or the service layer around it;
  several test files additionally install a `fetch` spy that throws if
  ever called, as a hard guarantee rather than an assumption
  (`BeautyPassport.test.jsx`, `routeOptimizer.test.js`, `ai.test.ts`,
  `route.test.ts`).
- **Deno tests:** `globalThis.fetch` is fully stubbed in every test file
  via `stubFetch()`/inline replacement, which throws on any unmocked URL —
  confirmed by tests that deliberately omit a route for `api.anthropic.com`
  or `api.mapbox.com` and assert the function still returns
  `provider_unconfigured` rather than hanging or erroring on a real
  network attempt.
- **CI:** the workflow's env vars are fixed, clearly-named
  `ci-placeholder-*` dummy values; no real Supabase project, Anthropic key,
  or Mapbox token exists anywhere in the workflow or repository secrets
  were referenced.

No test in this phase, at any point, made a real network call to
Anthropic, Mapbox, or a live Supabase project.

## 12. Final validation results

Re-run fresh immediately before this report, from a clean working tree:

| Check | Result |
|---|---|
| `npm run lint` | exit 0, zero findings |
| `npm run test:run` | 244 passed (244), 31 files |
| `npm run test:coverage` | 83.51% / 71.32% / 74.2% / 85.58% (stmts/branch/funcs/lines) |
| `npm run build` | succeeds; same known bundle-size advisory warnings as `docs/operations/BUILD_NOTES.md` already documents |
| Deno Edge Function tests | 43 passed (43), 0 failed |
| Tracked-secret scan | clean |
| GitHub Actions (`22ad6f1`, run `30754956658`) | `completed` / `success` |

## 13. Recommended next testing priorities

Not commitments — options for a future phase to choose from, in rough
priority order:

1. **Supabase-local-dev RLS integration tier** (Section 10) — the single
   highest-value gap: everything else tests application-code
   authorization logic, but the actual RLS policies in `schema.sql`/
   `supabase/migrations/*` have never been exercised by an automated test
   against a real Postgres instance.
2. **Coverage thresholds in CI**, once the team is comfortable with the
   current baseline, to prevent silent regressions.
3. **`ai-assistant`'s chat tool-use loop** — the largest single coverage
   gap in either Edge Function.
4. **The three discovered issues in Section 8**, each a small, independent
   fix once explicitly approved.
5. **E2E tests** (Playwright), once the unit/component/service/Edge-
   Function tiers below them have matured further — deliberately last,
   per the Test Strategy doc's own reasoning (E2E is the most valuable
   per-gap but slowest/highest-maintenance tier).

## 14. Final Phase 15 status

**Complete**, as scoped by Steps 1–9 above. 244 Vitest tests + 43 Deno
tests, all passing; lint clean; CI green on a real GitHub Actions run;
zero real external-provider calls in any test. The gaps and debt in
Sections 9–10 are real and documented, not hidden — Phase 15 does not
claim RLS-integration coverage, E2E coverage, or coverage-threshold
enforcement, none of which were ever in this phase's scope.
