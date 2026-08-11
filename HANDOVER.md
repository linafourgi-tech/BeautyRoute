# BeautyRoute — Handover Document

**Document type:** Handover-readiness record. Written for the incoming programmer/maintainer. Every claim below was verified directly against the repository at the commit noted below — not copied from older reports without re-checking.

**As of commit:** `b1701f2` on `main` (merge of PR #11, the nanoid security fix), audited for this document from branch `docs/handover-readiness`.

**Read this first, then `README.md` for setup.** This document does not duplicate README's setup instructions — see Section 6 for the pointer.

---

## 1. Current project status

- **What works today:** a working, Supabase-backed React SPA covering authentication/onboarding, workspace-scoped client/appointment/service management, the Beauty Passport, an AI Assistant (live, Anthropic-backed), Mapbox-backed route optimization, subscription/plan-tier gating, and a Business Engine dashboard — all reading and writing real, row-level-security-enforced Supabase data. See Section 2 for the verified, per-feature breakdown.
- **`main` / CI status:** green. All 3 required GitHub Actions checks pass on `main`'s current HEAD (`b1701f2`): *Frontend quality (lint, test, coverage, build)*, *Edge Function tests (Deno)*, *Repository security gates (secrets, dependency audit)* — verified directly via the GitHub API for this document, not assumed.
- **Test counts (verified fresh, this pass):** **398 Vitest tests across 48 files**, all passing. **70 Deno tests** (Edge Functions + shared plan-gating module), all passing. One known, pre-existing, Windows-checkout-only issue: `scripts/bundle-budget.test.ts` fails to *parse* under Vitest specifically on Windows (a `core.autocrlf`/Rolldown shebang-stripping interaction) — passes on Linux CI, which is authoritative. Not a code defect; documented in `docs/performance/PHASE_13_FINAL_REPORT.md`.
- **Security status:** Phase 12 Security Review is **complete** (posture score 72→90/100, no unresolved Critical/High finding). The one dependency-audit gate failure discovered after that review (`GHSA-2v37-7h3g-55p8`, nanoid) has since been **fixed** (patched to 3.3.18, merged via PR #11) — not allowlisted. Full record: `docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md`.
- **Performance status:** Phase 13 Performance Optimization is **complete** — route-level code splitting, bounded/paginated queries, and CI-enforced bundle budgets cut the initial eager JS+CSS payload by 49.9% (274.52 KB → 137.67 KB gzip). All 5 budgets in `npm run perf:bundle-budget` currently pass. Full record: `docs/performance/PHASE_13_FINAL_REPORT.md`.

---

## 2. Implemented functionality

Verified against the actual route table (`src/App.jsx`) and each page's/service's source — not assumed from documentation.

| Area | Status | Evidence |
|---|---|---|
| **Authentication** (signup, login, password reset) | Real, live | `src/pages/{Login,Signup,ForgotPassword,ResetPassword}.jsx`, `src/services/auth.ts`. Password reset was added during Phase 12 (previously missing — M-1 finding, now resolved). |
| **Onboarding** | Real, live | `src/pages/Onboarding.jsx` + `src/components/onboarding/steps/*` (Business, Services, Availability, Ready). Creates a real workspace row on completion; gated by `OnboardingRoute`. |
| **Workspace handling** | Real, live | `src/contexts/WorkspaceContext.jsx`, `src/hooks/useCurrentWorkspace.ts`. Multi-workspace switching persists via `localStorage`. |
| **Appointments** | Real, live | `src/pages/Appointments.jsx`, `src/services/appointments.ts`. Bounded query window (90 days back / 180 forward, Phase 13), day-tabs, client/service picker. |
| **Clients** | Real, live | `src/pages/Clients.jsx`, `src/services/clients.ts`. Full CRUD, workspace-scoped. |
| **Services / service templates** | Real, live | `src/pages/Services.jsx`, `src/services/services.ts`, `src/services/serviceTemplates.ts`. |
| **Beauty Passport** | Real, live | `src/pages/BeautyPassport.jsx`, `src/services/visits.ts`, `src/services/files.ts`. Includes AI-generated client summaries/next-visit suggestions/aftercare guidance via `src/services/ai.ts`. |
| **Stylist Dashboard** | Real, live | `src/pages/StylistDashboard.jsx`. Today's route, real client count, real monthly revenue (`src/services/revenue.ts`, fixed from a hardcoded figure during Phase 16). Average client rating honestly shows "Not available" — no ratings/reviews table exists (see Section 5). |
| **Business Engine** | Real, live | `src/pages/BusinessEngine.jsx`. Migrated off `mockData.js` in this handover cycle: real 6-month revenue/expense series (`src/services/revenue.ts`'s `getRevenueSeries`, `src/services/expenses.ts`) and real longest-standing-clients list — explicitly *not* labeled "most loyal" since it's tenure-only, not a real loyalty/visit-frequency signal. |
| **AI Assistant** | Real, live | `supabase/functions/ai-assistant/index.ts` (server-side, Anthropic-backed), `src/services/ai.ts`, `src/pages/AIEngine.jsx`. Gated by forwarded JWT + workspace membership + server-side plan check. See Section 4A for full status. |
| **Route Planner** | Real, live | `supabase/functions/route-planner/index.ts` (Mapbox Geocoding/Matrix/Directions, server-side), `src/pages/RouteEngine.jsx`. Live-verified against real Mapbox APIs during Phase 12 (`docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`). Map *tiles* fail to load on `localhost` by design (domain-restricted public token) — routing logic itself is unaffected. |
| **Subscription / plan gating** | Real gating, no real billing | `src/lib/plans.js`, `src/services/subscription.ts` (`hasFeature`, mirrored server-side in `supabase/functions/_shared/planRules.ts`), `src/components/subscription/{FeatureGate,TrialBanner,UpgradeRequired}.jsx`, `src/pages/Pricing.jsx`. Enforced both client- and server-side. **No live payment processor is integrated** — this is data-model/gating only. |

---

## 3. Remaining mocks / prototypes

A repository-wide search was re-run for this document: `mockData`, `TODO(mockData-audit`, `mock`, `prototype`, `placeholder`, `hardcoded`, `FIXME`, `HACK`, `STUB`. Every hit was individually classified. Results:

**Legitimate test mocks (not production mocks — excluded below):** `vi.mock(...)` calls and `*.test.{js,jsx,ts}` fixtures across the suite (this is what a normal Vitest/Deno test suite is expected to contain); HTML `placeholder="..."` input-hint attributes across form pages (`Login`, `Signup`, `ResetPassword`, `ForgotPassword`, `Clients`, `AIEngine`, `RouteEngine`, onboarding steps, the shared `Input`/`Select` components) — these are visible UI hint text, not fabricated data; one comment in `FeatureGate.jsx` describing the *absence* of hardcoding ("so pages never hardcode plan checks inline").

**Real, currently-shipping production mocks/prototypes — both already explicitly self-documented in source, neither silent:**

1. **`src/data/mockData.js`** — trimmed to a single export (`clients`), used only by Client Portal (below). Every other export (`stylist`, `stylists`, `appointments`, `revenueByMonth`, `engines`) was removed as dead code when Business Engine was migrated off it in this handover cycle.

2. **`src/pages/ClientPortal.jsx`** (route `/client-portal`) — the entire page is an intentional, documented prototype, **not** production-ready. Specifics:
   - **Fake/demo client identity:** `const client = clients[0]` — a hardcoded placeholder "logged-in" client, not a real session. `/client-portal` is deliberately outside `ProtectedRoute` (see `src/App.jsx`'s own routing comment) because no client-facing auth system exists.
   - **Simulated AI face-shape analysis:** `FACE_SHAPES`/`STYLE_LIBRARY`/`ANALYZE_STEPS` and `runAnalysis()` — a `setInterval` + `Math.random()` simulation, not a call to any real model or endpoint. This is a placeholder for BR-FS-001 (see Section 4B), which has no trained model to call.
   - **Simulated booking flow:** `SmartBookingEngine`'s `confirm()` sets local component state only and never calls `createAppointment()` — no real appointment is created.
   - **Service catalog limitation:** the `SERVICES` array is hardcoded because this anonymous route has no URL parameter or other signal identifying *which* workspace's real service catalog to load — the real catalog (`service_templates`/`services` tables, `getServiceTemplates()`) exists and is used correctly everywhere else in the app.
   - **Missing dependency, root cause for all of the above:** no client-facing authentication or business/workspace-resolution mechanism exists anywhere in this codebase yet. This is a genuine architecture gap, not an oversight — building it is unscoped future product work.
   - Every one of the five points above carries its own `TODO(mockData-audit, 2026-08-05)` comment at its exact source location (What / Why / Missing format), plus a page-header summary block. The page also shows a **user-visible** "Prototype" notice — not just a source comment — stating plainly that AI analysis and booking are simulated.

3. **`src/pages/SalonEngine.jsx`** (route `/salon`) — a locked "coming soon" preview with no data layer at all; intentionally inert until a future Salon plan tier exists. Not misleading: shows a lock icon and an explicit "This engine activates on the Salon plan" message.

No other production mock, stub, or hardcoded placeholder value was found anywhere in `src/` or `supabase/functions/`.

---

## 4. AI systems

Two entirely separate initiatives at very different maturity levels. Do not conflate them.

### 4A. AI Assistant — implemented, live feature

A working, server-side LLM integration calling the **Anthropic API**, invoked only from the `ai-assistant` Supabase Edge Function (`supabase/functions/ai-assistant/index.ts`) — the provider API key is a server-side secret (`ANTHROPIC_API_KEY`), never present in the browser bundle. Provides: client summaries, next-visit suggestions, aftercare guidance, and workspace chat. Gated by the caller's forwarded Supabase JWT, workspace membership, and a server-side plan check (`hasFeature`, mirrored from the frontend's own gating logic). Frontend entry points: `src/services/ai.ts`, `src/pages/AIEngine.jsx`, and Beauty Passport's AI actions. Covered by both Vitest tests (frontend, mocked service boundary) and Deno tests (Edge Function auth/validation logic, no live Anthropic calls in CI).

### 4B. BR-FS-001 status

**Research and specification only. No model code, no training run, no deployed model exist anywhere in this repository.** This is the original/university custom face-shape classifier initiative, separate from the AI Assistant above.

- **Intended architecture:** MobileNetV3-Large (selected and documented in `docs/ai/BR-FS-001_ARCHITECTURE_SELECTION.md`; the full spec is in `docs/ai/BR-FS-001_MODEL_SPECIFICATION.md`, which itself states plainly: *"Nothing in this document should be read as authorization to acquire or use any dataset discussed in the prior research documents."*)
- **Dataset status: `REQUIRES LICENSE REVIEW`** (the exact, final decision text in `docs/ai/FACE_SHAPE_DECISION.md`). **No dataset — academic or otherwise — has been cleared, licensed, or acquired.** Every candidate dataset surveyed in `docs/ai/FACE_SHAPE_COMPARISON.md` and `docs/ai/FACE_SHAPE_DATASET_RESEARCH.md` failed at least one hard-rejection criterion, almost always licensing. The single most credible lead is one peer-reviewed academic source (Pasupa, Sunhem & Loo, 2019) that requires **direct author outreach** to even confirm license terms and dataset details — this has not happened yet, per the repository's own record.
- **Commercial-rights review is a separate, later track.** Even the academic-outreach path above, if it succeeds, only resolves *research/academic* access — `docs/ai/FACE_SHAPE_COMPARISON.md` explicitly weights "license clarity & commercial safety" at 30% of its own scoring because *"a commercial SaaS product cannot ship a model trained on data with unclear or non-commercial rights."* Whoever picks this initiative back up should treat academic dataset access and commercial-shipping rights as two separate, sequential approvals — not one.
- Client Portal's simulated face-shape analysis (Section 3) is a **UI placeholder for this initiative**, not an early version of it — there is no model to call, simulated or otherwise connected.

---

## 5. Known limitations / technical debt

Re-verified for this document, not copied from older reports. Each item below is confirmed current as of `main` @ `b1701f2`.

- **No real Postgres/RLS integration-test tier.** All current automated tests mock the Supabase client boundary; RLS policies are enforced by the real Postgres engine in production but are not yet exercised by an automated test against a real (local or ephemeral) Postgres instance. **Attempted in this handover pass — deferred, environmental blocker, not a repository defect.** See Part 2 write-up below.
- **No ratings/reviews data model.** Confirmed: no such table exists anywhere in `schema.sql`. The Stylist Dashboard's "Not available" rating state is honest, not a placeholder for hidden data.
- **Password policy is minimal; no MFA.** Verified in `supabase/config.toml`: `minimum_password_length = 6`, `password_requirements = ""` (no complexity requirement beyond length), `[auth.mfa.totp]`/`[auth.mfa.phone]` both `enroll_enabled = false`. Supabase Auth supports stronger settings; none are currently turned on.
- **Single shared Supabase environment — no staging project.** Confirmed still true (this is a structural fact, not something a migration fixes): all schema/migration work applies directly to the one real, linked project. Documented and risk-accepted in the Phase 12 security review (finding H-2's root cause), which also fixed the specific standing-access issue that caused; the *absence of a staging environment itself* remains unchanged.
- **`ALLOWED_ORIGINS` is not set for a production domain, because no production domain exists yet.** The Edge Function CORS allowlist mechanism itself is implemented (`supabase/functions/_shared/cors.ts`, fixed from a wildcard during Phase 12); it currently only needs to allow local dev origins, which it does by default. This becomes an actual to-do the moment a production domain is chosen.
- **Client Portal's underlying dependencies are unbuilt**, not just its UI: no client-facing auth/identity system, no business/workspace-resolution mechanism for anonymous routes. See Section 3.
- **No deployment pipeline exists.** No `vercel.json`, `netlify.toml`, `Dockerfile`, or any deployment config anywhere in the repo; `docs/PROJECT_ROADMAP.md`'s Phase 14 (Deployment) is Planned, not started. `.github/workflows/ci.yml` is explicitly verification-only, by its own header comment.
- **No live payment processor.** The subscription/plan-tier data model and gating are real and enforced server-side; there is no Stripe (or other) integration behind it.
- **No end-to-end (Playwright) test suite.** All current automated coverage is unit/component-level (Vitest) or Edge-Function-level (Deno).
- **No CI-enforced coverage threshold.** Coverage is measured and reported (`npm run test:coverage`) but nothing currently fails a build for falling below a specific percentage.
- **Windows-only `bundle-budget.test.ts` parse failure**, confirmed still present, still Windows-checkout-specific, still passes on Linux CI. See Section 1.

**Already fixed — explicitly not listed as current debt:** the hardcoded StylistDashboard revenue/rating figures (Phase 16), the login native-vs-app validation inconsistency (Phase 16), the Appointments accessibility defect (Phase 16), the wildcard Edge Function CORS (Phase 12), the standing unauthorized workspace-membership grant (Phase 12, H-2), account enumeration on signup (Phase 12), unsafe workspace deletion (Phase 12), the `GHSA-2v37-7h3g-55p8` nanoid advisory (this handover cycle, PR #11), the dangling `supabase/config.toml` seed reference (this handover cycle — `supabase/seed.sql` now exists, documented, no data seeded for good reason — see its own header comment). The `react-router` advisory `GHSA-qwww-vcr4-c8h2` is a reviewed, documented, currently-accepted exception (not a defect) — see `scripts/dependency-audit.mjs`.

---

## 6. Setup

See **`README.md`** for the full, verified setup guide — prerequisites, installation, environment variables, Supabase setup, database migration order, local development, Edge Functions, and running tests. Not duplicated here to avoid the two documents drifting apart.

---

## 7. Important repository documentation

Every path below was verified to exist as of this document's commit.

| Document | Purpose |
|---|---|
| `README.md` | Setup, tech stack, features, environment variables, running tests. Start here for "how do I run this." |
| `docs/PROJECT_ROADMAP.md` | Phase-by-phase status, risks, milestones — the project's own maintained change log. Start here for "what's the overall project state." |
| `docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md` | The complete security review: findings, fixes, posture score, accepted/deferred risks. |
| `docs/performance/PHASE_13_FINAL_REPORT.md` + `docs/performance/PHASE_13_BUNDLE_BASELINE.md` | Performance optimization work and bundle-size measurement. |
| `docs/testing/PHASE_15_FINAL_REPORT.md` + `docs/testing/TEST_STRATEGY.md` | How the automated test suite was built, what it covers, and known gaps. |
| `docs/quality/PHASE_16_REMEDIATION_REPORT.md` | Three specific production-defect fixes (dashboard hardcoded metrics, login validation, appointments a11y) plus the react-router advisory assessment. |
| `docs/quality/DATABASE_MIGRATION_POLICY.md` | The rule governing how future migrations may seed dev/test data — read before writing a new migration. |
| `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md` | Live verification of Maps & Routing against real external services. |
| `docs/ai/` (6 files) | The complete BR-FS-001 research trail — dataset research, comparison, decision, literature review, architecture selection, model specification. |
| `docs/operations/BUILD_NOTES.md` | Current production build output snapshot; points to the Phase 13 report for the full before/after story. |
| `supabase/seed.sql` | Local-dev seed script — intentionally seeds no data; read its header comment for why and for the real local-setup path. |

---

## 8. Handover checklist

| Item | Status |
|---|---|
| Security Review (Phase 12) | **DONE** |
| Performance Optimization (Phase 13) | **DONE** |
| Automated test suite (Phase 15) | **DONE** — 398 Vitest + 70 Deno tests, all passing |
| Production-defect remediation (Phase 16) | **DONE** |
| Business Engine off mock data | **DONE** (this handover cycle) |
| README audit/rewrite | **DONE** (this handover cycle) |
| `supabase/seed.sql` dangling-reference fix | **DONE** (this handover cycle) |
| `GHSA-2v37-7h3g-55p8` (nanoid) security fix | **DONE** (this handover cycle, PR #11) |
| This `HANDOVER.md` | **DONE** (this handover cycle) |
| Real Postgres/RLS integration test | **DEFERRED** — see Part 2 outcome below; blocked by environment, not code |
| Client Portal real backend (client auth, business resolution) | **NEXT** — unscoped, requires product/architecture decisions first, not a quick fix |
| BR-FS-001 implementation | **BLOCKED** — dataset licensing (academic access, then separately commercial rights) unresolved; no engineering work can start until then |
| Deployment pipeline / production domain | **NEXT** — Phase 14, not started |
| Payment processor integration | **NEXT** — unscoped |
| Ratings/reviews data model | **NEXT** — unscoped |
| MFA / stronger password policy | **NEXT** — Supabase Auth supports it; not yet configured |
| Staging environment separate from the shared linked project | **NEXT** — structural, requires provisioning a second Supabase project |
| End-to-end (Playwright) test suite | **NEXT** — deferred since Phase 15, unchanged |

### Part 2 outcome: DEFERRED

Investigated adding one meaningful RLS integration test against a real local Postgres instance (e.g. proving workspace A cannot read workspace B's data) for this handover pass, per instruction to attempt it only if safe.

**Exact blocker:** `supabase start` (the only supported way to run a real local Postgres+Auth+RLS instance for this project) requires Docker. This environment has a stray `docker` CLI client installed but **no Docker Desktop application and no reachable daemon anywhere on the machine** — `docker info` fails to connect (`dockerDesktopLinuxEngine` pipe not found), and an exhaustive search found no Docker Desktop executable and no docker-related process running at all. This is the same environmental gap already noted independently in `docs/testing/TEST_STRATEGY.md` from Phase 15.

**Not faked:** no test was written against mocked infrastructure and presented as an integration test. Nothing was run against the shared/linked Supabase project — that would violate the explicit safety rule against using production/shared infrastructure for this purpose, regardless of Docker availability.

**This is an environmental limitation, not a repository defect, and does not block handover** — RLS itself is real, enforced by Postgres in production, and its authorization *logic* (the application-code checks that run alongside RLS) is already covered by the existing Deno test suite (`ai-assistant`/`route-planner`'s workspace-membership checks). What's missing is specifically a test against the *database engine's own policy enforcement*, which needs a real local Postgres — the next maintainer with Docker available can pick this up directly; `docs/testing/TEST_STRATEGY.md` Section 7/8 already describes exactly what such a test tier should cover.
