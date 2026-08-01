# BeautyRoute — Automated Testing Strategy (Phase 15)

**Document type:** Planning document. Defines what will be tested, with what
tools, and in what order. **Nothing in this document is installed or
implemented yet** — Phase 15 Step 1 is strategy only. Every later step
(2–9) implements one slice of this plan and is separately committed,
validated, and approved.

**Baseline at time of writing:** zero automated tests exist anywhere in this
repository (`docs/PROJECT_ROADMAP.md`, Phase 11 — Testing, still Planned).
Every currently-shipped feature (auth, onboarding, clients, services,
appointments, Beauty Passport, AI Assistant, Maps & Routing) has been
verified manually or via one-off live-verification passes (see
`docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`), not by a
repeatable test suite.

---

## 1. Testing goals

- **Protect what already works.** The primary goal is a regression net
  around behavior that has already been built and live-verified, ahead of
  visual redesign and further feature work — not "100% coverage" as an
  abstract target.
- **Catch authorization/tenant-isolation regressions first.** RLS, plan
  gating, and workspace-scoping are the highest-consequence surfaces in this
  app (a bug here leaks another workspace's data); they get priority over
  UI polish tests.
- **Keep tests fast and deterministic enough to run on every change.** Slow
  or flaky tests get skipped by developers in practice, which defeats the
  purpose.
- **Test real logic, not mocks of the logic under test.** Per the Phase 15
  instruction: do not mock away the thing being verified (e.g. don't mock
  `hasFeature` when testing `hasFeature`).
- **Do not chase coverage numbers at the expense of the above.** A
  meaningful assertion on `routeOptimizer.js` is worth more than a
  snapshot test of static JSX.

## 2. Current risks (why these tests, in this order)

Ranked by blast radius if silently broken:

1. **Cross-workspace data leakage.** RLS policies and Edge Function
   workspace-membership checks are the only thing standing between one
   professional's clients and another's. No automated test currently
   guards this — verified live, once, per phase, not on every change.
2. **Plan-gating bypass.** `hasFeature()` is duplicated in two places by
   necessity (`src/services/subscription.ts` for the frontend,
   `supabase/functions/_shared/planRules.ts` for Edge Functions — see that
   file's own header comment). Nothing currently catches the two drifting
   apart.
3. **Route Engine correctness regressions.** Three real bugs were already
   found and fixed during Phase 12 live verification (geocoding relevance
   threshold, reroute subset validation, timezone-aware day boundaries —
   see `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`). None of
   these fixes is currently protected by a test; a future refactor could
   silently reintroduce any of them.
4. **Silent UI regressions in gated flows** (auth, onboarding, subscription
   gating) — these are the entry point to everything else; a broken
   `ProtectedRoute` redirect loop or a `FeatureGate` that fails open would
   be severe and easy to miss in manual testing.
5. **Domain-page regressions** (Clients, Services, Appointments, Beauty
   Passport) — lower blast radius than 1–4 individually, but the largest
   surface area of day-to-day functionality.
6. **Build/lint drift** — currently caught manually per commit (see
   `docs/PROJECT_ROADMAP.md` process); not yet enforced automatically on
   every push/PR.

## 3. Recommended test stack

Evaluated against the actual stack in this repo (React 19, Vite 8,
react-router-dom 7, Tailwind v4, TypeScript-flavored `.ts` service files
alongside `.jsx` components, Supabase JS client, Deno-runtime Edge
Functions):

| Layer | Tool | Why |
|---|---|---|
| Unit / component test runner | **Vitest** | Native Vite integration (same config, same transform pipeline, same module resolution as the app — no separate Babel/webpack config to maintain), fast, Jest-compatible API so it's a known quantity. |
| Component rendering | **React Testing Library** | Tests behavior/output, not internals — fits "don't test implementation details," pairs naturally with Vitest. |
| DOM environment | **jsdom** | Required for React Testing Library to render components outside a real browser; Vitest supports it as an `environment` option with no extra runner. |
| Assertions | **@testing-library/jest-dom** | Adds DOM-specific matchers (`toBeInTheDocument`, `toBeDisabled`, etc.); works with Vitest's Jest-compatible `expect`. |
| User interaction | **@testing-library/user-event** | More realistic than firing raw DOM events for the interactive cases in Step 4/5 (form fills, clicks) — justified given the app has real forms (onboarding, client/service create, appointment edit). |
| Network mocking (frontend) | **Not adopted in Phase 15.** Service-layer tests (Step 3/5) will test pure logic and call the real `@supabase/supabase-js` client's request-building where feasible, or accept an injected/mocked Supabase client at the function boundary rather than intercepting HTTP. MSW is a reasonable future addition once integration-style tests against a local Supabase instance are in place (Step 6+), but adding it now would mean mocking the exact boundary the app most needs verified for real. |
| Supabase local dev | **Deferred, environment-gated.** `supabase` CLI (`v2.109.1`) and Docker Desktop are both installed in this environment, but the Docker daemon is not currently running here, and Phase 12's live verification already noted local Docker-based function bundling was unavailable at that time too. `supabase start` (local Postgres + RLS + Auth) is the right tool for genuine RLS/tenant-isolation integration tests, and is expected to work in CI (GitHub-hosted runners ship Docker), but cannot be assumed to work in every local dev environment. Step 6 will test RLS-adjacent *logic* (validation helpers, plan gating) at the unit level in Deno without a live database; full `supabase start`-backed RLS integration tests are noted as a **future addition**, not committed to in Phase 15's step list below, since none of Steps 2–9 currently call for one. |
| Edge Function tests | **Deno's built-in test runner (`deno test`)** | Edge Functions run on Deno at deploy time (`supabase/functions/*`); testing them with Deno's own runner (rather than transpiling into the Node/Vitest world) exercises the real runtime semantics. Requires the Deno CLI, which is **not currently installed** in this environment (checked: `deno --version` → not found) — Step 6 will need to either install it locally or scope its "Deno tests pass" validation to what's actually runnable here, and CI (Step 8) will need a Deno setup step. |
| End-to-end | **Playwright** | Already used once, ad hoc, for Phase 12 live-verification browser checks (installed temporarily, then removed — see the Phase 12 report's Cleanup section). Recommended for a **later** phase, explicitly out of scope for Steps 2–9 per the Phase 15 instructions ("Do not add Playwright yet"). |
| CI | **GitHub Actions** | The repo is already on GitHub (`origin` → `linafourgi-tech/BeautyRoute`); no other CI system is in use or configured. |

**Not adopted:** Jest (Vitest supersedes it here with less config, given
the existing Vite pipeline), Cypress (Playwright is already the tool with
prior usage history in this project), Enzyme (incompatible with modern
React and not aligned with "test behavior, not internals").

## 4. Unit tests

Pure-function logic with no DOM, no network, no React — the fastest and
most stable tier. Primary Phase 15 targets (Step 3):
`src/lib/routeOptimizer.js` (`optimizeStopOrder`), `src/lib/appointmentView.js`
(`toAppointmentViewModel`), and the plan-gating logic that actually lives in
`src/services/subscription.ts` (`hasFeature`, `isExpired`, `isTrial`,
`isTrialExpired`, `canAccessApplication`) alongside the static data in
`src/lib/plans.js` (`PLANS`, `PLAN_ORDER`) — see the note in Section 12
about this file-location detail.

## 5. React component tests

Vitest + React Testing Library + jsdom, rendering real components with
controlled props/context and asserting on rendered output and accessible
roles/text — not snapshots of markup structure (explicitly excluded per the
Phase 15 Step 5 instruction against "brittle pixel or snapshot-heavy
tests"). Targets are broken out by Step in Section 19's step-to-target
mapping (Sections 6/10/11/12 below).

## 6. Service-layer tests

`src/services/*.ts` wrap `@supabase/supabase-js` calls with workspace
scoping and typed shapes (`clients.ts`, `appointments.ts`, `services.ts`,
`visits.ts`, `workspaces.ts`, `subscription.ts`, `auth.ts`, `route.ts`,
`ai.ts`, `files.ts`, `profiles.ts`, `serviceTemplates.ts`). These are
tested at the boundary that can be exercised without a live database or
without weakening the module's real logic: input handling, error
propagation (e.g. `deleteClient`'s reliance on the database's `ON DELETE
RESTRICT` constraint on `appointments`/`visits` → a Postgres foreign-key
violation the caller must catch and explain, not swallow — see
`src/services/clients.ts`), and output shaping. Full end-to-end
"does this actually round-trip through Postgres/RLS" verification is a
Supabase-local-dev-backed integration concern (Section 7/8), not a
service-layer unit test.

## 7. Supabase integration tests

**Deferred beyond Phase 15's committed step list**, gated on Docker/`supabase
start` being reliably available (see Section 3). When adopted: spin up
`supabase start` against a disposable local Postgres, apply
`schema.sql` + `supabase/migrations/*` in order, and exercise real
service-layer calls against it — the only way to truly verify a migration
didn't silently break a query. Flagged here as a known gap, not silently
dropped.

## 8. RLS and tenant-isolation tests

The single highest-value test category not yet covered by any Phase 15
step in the instructions as given. Two tiers are possible:

- **Policy-adjacent logic in isolation** (in scope for Step 6): the
  workspace-membership and ownership checks Edge Functions perform in
  application code before/alongside relying on RLS (e.g. the
  `workspace_forbidden` / `client_forbidden` / `visit_forbidden` checks in
  `supabase/functions/ai-assistant/index.ts`, and the equivalent in
  `supabase/functions/route-planner/index.ts`) can be unit-tested with a
  fake/injected Supabase client that returns controlled data, without a
  live database.
- **Real RLS policy enforcement** (the actual `CREATE POLICY` statements in
  `schema.sql`/`supabase/migrations/*`) can only be genuinely verified
  against a real Postgres instance with RLS turned on — this requires
  Section 7's Supabase-local-dev integration tier. **This document
  recommends this as a near-term follow-up to Phase 15, not a Phase 15
  deliverable**, since Docker is not reliably available in this
  environment today and none of Steps 2–9 as instructed provision it.

## 9. Edge Function tests

Step 6 targets, using Deno's test runner against the actual Edge Function
source (not a transpiled copy):

- `supabase/functions/_shared/planRules.ts` — `hasFeature()` for every
  plan tier × feature combination, plus `isExpired`/trial-boundary cases.
- `supabase/functions/ai-assistant/index.ts` — request validation and
  authorization boundaries: missing `Authorization` header → `401
  unauthenticated`; workspace the caller doesn't belong to → `403
  workspace_forbidden`; workspace without the `ai` feature → `403
  feature_not_available`; client/visit not in the target workspace → `403
  client_forbidden`/`visit_forbidden`.
- `supabase/functions/route-planner/index.ts` — the same auth/workspace
  boundary pattern, plus routing-specific validation: the `MAX_STOPS = 23`
  cap (`route_too_large`), `MIN_GEOCODE_RELEVANCE = 0.7` threshold in
  `geocodeAddress()`, the subset/no-duplicate `isValidPermutation` check
  that gates `reroute` (`409 stale_route` on failure), and `dayBoundsUtc()`
  for timezone-correct day-boundary conversion.

Per the Phase 15 instruction, these tests **must not make live Mapbox
requests** — `fetchWithTimeout`/`geocodeAddress`/`fetchMatrix`/
`fetchDirections` are the external network boundary to mock; the
validation/authorization logic around them (which is what actually caught
the three Phase 12 bugs) must be exercised for real, not mocked away.

## 10. Authentication and onboarding tests

Step 4 targets: `ProtectedRoute` (signed-out → redirect to `/login`;
signed-in but `!profile.onboarding_completed` → redirect to `/onboarding`;
loading states must not redirect prematurely — see its own ordering
comment in `src/components/routing/ProtectedRoute.jsx`; expired
subscription → renders `UpgradeRequired`, not gated content),
`OnboardingRoute` (signed-out → `/login`; already onboarded → `/dashboard`;
loading → `RouteLoading`), and `RouteLoading` itself (renders without
crashing, no false interactivity while loading).

## 11. Subscription and plan-gating tests

Step 4 targets: `TrialBanner`, `FeatureGate` (renders `children` when
`hasFeature` is true, `fallback` — default `null` — when false, for every
plan tier), `UpgradeRequired`, and `WorkspaceContext`/
`useWorkspaceContext` behavior (no provider → throws, per its own guard;
workspace list empty → `workspace` resolves to `null` without crashing;
workspace switching persists via `localStorage` and survives a refresh
that still contains the previously-selected id — see
`src/contexts/WorkspaceContext.jsx`).

## 12. Clients, services, appointments, and Beauty Passport tests

Step 5 targets, covering loading/empty/error/success states, workspace-scoped
service calls (asserting the service layer is actually called with the
current workspace id, not a hardcoded/omitted one), the `deleteClient`
foreign-key-violation path described in Section 6, appointment form
prefill from `toAppointmentViewModel`'s `serviceIds` field (added
specifically to support edit-form prefill — see its comment in
`src/lib/appointmentView.js`), and confirming Beauty Passport's AI actions
call through `src/services/ai.ts` rather than invoking the `ai-assistant`
Edge Function directly from the component (the same boundary already
required and verified during the Phase 13 stabilization commit for
Appointments/Beauty Passport).

**Note on Section 4/Step 3 file location:** the Phase 15 instructions list
`src/lib/plans.js` as a target for "`hasFeature` behavior for all tiers."
In the actual codebase, `src/lib/plans.js` holds only the static `PLANS`
data; `hasFeature()` itself (along with `isExpired`, `isTrial`,
`isTrialExpired`, `canAccessApplication`) is defined in
`src/services/subscription.ts`, which imports `PLANS` from `plans.js`. Step
3 will test both files together as the single "plan gating" logic unit
this represents, rather than searching for a `hasFeature` export that
doesn't exist in `plans.js` itself.

## 13. AI Assistant authorization tests

Covered across Step 5 (frontend: Beauty Passport calling through
`src/services/ai.ts`, never the Edge Function directly) and Step 6
(backend: the `ai-assistant` Edge Function's own auth/workspace/plan-gate/
ownership checks enumerated in Section 9). Explicitly not covered in Phase
15: live calls to the real Anthropic API — mirrors the "no live Mapbox
requests" rule in Section 9 for the same reason (cost, non-determinism, and
the actual authorization logic under test doesn't require a real model
response).

## 14. Route Planner tests

Covered across Step 3 (frontend: `optimizeStopOrder`'s heuristic behavior,
including degenerate inputs — see Section 4/19) and Step 6 (backend: the
Edge Function validation enumerated in Section 9). Together these directly
protect all three bugs fixed during Phase 12 live verification (Section 2,
item 3).

## 15. End-to-end tests

**Explicitly out of scope for Phase 15** per the instructions ("Do not add
Playwright yet," "Do not add E2E tests yet"). Recommended as a distinct
future phase once the unit/component/service/Edge-Function tiers below are
in place — E2E tests are the most valuable for catching real integration
gaps but are also the slowest and most maintenance-heavy tier, and are
better justified once cheaper tiers have already caught what they can.

## 16. Future custom ML model evaluation tests

Not applicable to Phase 15: BR-FS-001 (the face-shape classifier) has **no
model code, no training run, and no deployed model** — it remains
documentation and research only, blocked on dataset licensing review (see
`docs/ai/FACE_SHAPE_DECISION.md`, status **REQUIRES LICENSE REVIEW**, and
`README.md` Section 8). Model evaluation tests (accuracy/precision/recall
thresholds, inference-latency budgets, confusion-matrix review) are a
future concern for once BR-FS-001 actually has a trained artifact — there
is nothing to test today, and this document does not invent a testing plan
for code that doesn't exist.

## 17. CI strategy

Step 8 will add a GitHub Actions workflow triggered on pull requests and
pushes to `design-integration` and (once it exists) `main`, running (in
order, failing fast): `npm ci`, `npm run lint`, the Vitest suite
(`npm run test:run`), and `npm run build`. Per the Phase 15 instructions:
no deployment step, no secrets, and no live Supabase or Mapbox calls in CI
— meaning Edge Function tests in CI (Step 6/8) must run against
mocked/injected boundaries only, consistent with Section 9, not against a
live `supabase start` instance unless a future phase explicitly adds that
(Section 7).

## 18. Test-data and cleanup policy

- **Frontend unit/component tests (Steps 3–5):** use in-memory
  fixtures/fakes only — no real Supabase project, no real network calls.
  Nothing to clean up; each test's data is local to that test.
- **Edge Function tests (Step 6):** construct fake Supabase-client
  responses and fake `Request` objects in-process; no real database rows
  are ever created, so there is nothing to seed or tear down. This is a
  deliberate design choice for Phase 15 specifically because it avoids
  repeating the test-data cleanup discipline problem already flagged as a
  process risk in `docs/PROJECT_ROADMAP.md` (migrations previously used to
  insert and clean up verification data — see that document's Risks
  section).
- **If/when Section 7's Supabase-local-dev integration tier is adopted**
  in a future phase: it must run against a disposable local database
  (`supabase start`/`supabase db reset`), never a shared or production
  project, so no cleanup discipline is needed at all — the environment
  itself is thrown away, not individual rows within it.

## 19. Definition of Done for Phase 15

Phase 15 is complete when, for each step actually executed and approved:

- **Step 2:** `npm install` succeeds; `npx vite build` still succeeds;
  the test runner starts and reports (even if `0 tests`, proving the
  toolchain itself works); zero secrets introduced.
- **Step 3:** unit tests exist and pass for `optimizeStopOrder`,
  `toAppointmentViewModel`, and the plan-gating functions (Section 12
  note); test count and (if configured) coverage are reported.
- **Step 4:** component tests exist and pass for `ProtectedRoute`,
  `OnboardingRoute`, `RouteLoading`, `WorkspaceContext`, `TrialBanner`,
  `FeatureGate`, `UpgradeRequired`, covering signed-out, onboarding-
  required, loading, error, allowed-plan, and blocked-plan cases without
  weakening any real check.
- **Step 5:** focused tests exist and pass for Clients, Services,
  Appointments, and Beauty Passport covering the states listed in Section
  12, with remaining untested behavior explicitly reported rather than
  implied to be covered.
- **Step 6:** Deno tests exist and pass for `planRules.ts` and the
  authorization/validation boundaries of both Edge Functions, with no live
  external network calls.
- **Step 7:** `npm run lint` exits cleanly (0) with `docs/design-reference/`
  excluded and the enumerated `src/` warnings resolved, without silencing
  any legitimate check globally.
- **Step 8:** a GitHub Actions workflow runs lint + tests + build on every
  push/PR to `design-integration` (and `main` once relevant) and is
  confirmed green on GitHub, not just locally.
- **Step 9:** `docs/PROJECT_ROADMAP.md` and a new
  `docs/testing/PHASE_15_TEST_REPORT.md` accurately report what was built,
  what wasn't, and what remains untested — no step is described as more
  complete than it verifiably is.

Phase 15 as a whole does **not** claim: full RLS integration-test coverage
(Section 8), Supabase-local-dev-backed integration tests (Section 7), E2E
tests (Section 15), or BR-FS-001 evaluation tests (Section 16) — all four
are explicitly documented here as deferred, not silently dropped.
