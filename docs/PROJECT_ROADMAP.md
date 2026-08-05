# BeautyRoute Development Roadmap

**Document type:** Internal project governance document. Planning and status tracking only — this file does not itself change, and is not evidence of a change to, any application code, database schema, or infrastructure.
**Maintained by:** BeautyRoute Founding Team
**Last updated:** 2026-08-05

---

## Project Vision

BeautyRoute exists to give independent beauty professionals and small salons the same operational backbone that large chains take for granted — client history, scheduling, route-optimized mobile appointments, and AI-assisted business intelligence — without the cost or complexity of enterprise salon software. Long term, BeautyRoute aims to be the default operating system for independent beauty professionals across their full workflow: booking, client relationship management, on-the-go routing between appointments, personalized service recommendations (including AI-driven face-shape and style guidance), and the commercial infrastructure (marketplace, payments, notifications) needed to run a real business on top of it. The product is being built to graduate from a student project into a maintainable, licensable, commercially viable SaaS platform — not a one-off demo.

---

## Current Status

BeautyRoute has a working frontend and backend foundation with core workspace, client, and scheduling data flowing through Supabase under row-level-security enforcement, plus an initial AI feature already live in production code and a second, larger AI initiative in the research/specification stage.

- **Frontend foundation:** React 19 + Vite + Tailwind v4 single-page app with client-side routing (react-router-dom), a dedicated design-token system (`src/styles/beautyroute/`), and a growing internal UI component library (`src/components/ui/` — Button, Dialog, Table, Toast, Tooltip, Skeleton, Tag, Badge, and others) used consistently across pages.
- **Supabase backend:** `@supabase/supabase-js` client integration, two live Edge Functions (`ai-assistant`, `route-planner`) with shared server-side plan-gating logic (`supabase/functions/_shared/planRules.ts`), and a `supabase/config.toml` project configuration.
- **Database schema:** A committed `schema.sql` baseline plus an incremental migration history covering row-level-security policies, workspace-membership recursion fixes, audit-trigger RLS, and professional onboarding state. Some recent migrations were used to insert and then clean up verification/test data directly in migration history — flagged as a process risk (see Risks) rather than a schema defect.
- **Authentication foundation:** Login/Signup pages, session handling (`src/hooks/useSession.ts`, `src/services/auth.ts`), workspace-scoped route protection (`src/components/routing/ProtectedRoute.jsx`, `OnboardingRoute.jsx`), and a dev-only auth bootstrap gated behind `import.meta.env.DEV`. Authorization is enforced through Supabase RLS policies keyed on workspace membership, not client-side checks alone.
- **Documentation:** `docs/ai/` contains a complete, source-cited research trail for the face-shape classifier initiative (dataset research, comparison, decision, literature review, architecture selection, model specification). This document (`docs/PROJECT_ROADMAP.md`) is the first piece of broader, non-AI-specific project governance documentation.
- **Performance:** Phase 13 (Performance Optimization) is complete — route-level code splitting, a shared session context, bounded/paginated appointment queries, targeted memoization and query narrowing, bounded-concurrency Route Planner geocoding, and CI-enforced bundle budgets (`scripts/bundle-budget.mjs`) together cut the initial eager JS+CSS payload by 49.9% (274.52 KB → 137.67 KB gzip), with regressions now caught automatically on every PR. Full record: `docs/performance/PHASE_13_FINAL_REPORT.md` and `docs/performance/PHASE_13_BUNDLE_BASELINE.md`.
- **AI research:** Two parallel AI efforts exist at very different maturity levels. (1) The **AI Assistant** (LLM-powered client-summary, next-visit-suggestion, aftercare-guidance, and workspace chat features) is implemented and live in `supabase/functions/ai-assistant/index.ts`, with server-side plan gating, rate limiting, and RLS-scoped data access. (2) **BR-FS-001**, the face-shape classifier, has completed dataset research, architecture selection (MobileNetV3-Large recommended), and a full model specification — but is explicitly blocked from implementation pending dataset licensing review (status: REQUIRES LICENSE REVIEW). No BR-FS-001 model code exists yet, by design.
- **Business model research:** A subscription/plan-tier data model exists end-to-end in design (`src/lib/plans.js`, `src/services/subscription.ts`, `src/pages/Pricing.jsx`, `src/components/subscription/FeatureGate.jsx`, `TrialBanner.jsx`, `UpgradeRequired.jsx`) with server-side feature gating already mirrored into the AI Assistant Edge Function. Actual payment processing is not yet integrated — the codebase contains an explicit forward-reference to Stripe as future work, not a working integration.

---

## Development Phases

### Phase 1A — Repository Foundation & Audit

- **Objective:** Establish a clean, auditable baseline of the codebase, confirm no secrets or unresolved hazards exist in version control, and surface repository-hygiene issues before further feature work.
- **Main Deliverables:** Baseline repository commit; general repository health audit covering secrets exposure, dependency licensing, stray/dead files, migration hygiene, and test coverage.
- **Status:** Completed
- **Definition of Done:** Repository audited end-to-end; findings documented and communicated to the team; no committed secrets found; no blocking issues left unflagged.
- **Dependencies:** None.
- **Priority:** Critical
- **Estimated Complexity:** Small
- **Owner:** Founding Engineer

### Phase 1B — Project Documentation & Governance

- **Objective:** Establish the internal documentation and governance artifacts a professional software company would maintain — roadmap, status tracking, decision records — independent of any single feature.
- **Main Deliverables:** `docs/PROJECT_ROADMAP.md` (this document); the AI research documentation set under `docs/ai/`; ongoing change-log discipline (see Change Log below).
- **Status:** In Progress
- **Definition of Done:** Roadmap published and kept current at each phase transition; every major initiative (AI, commerce, security) has a discoverable, source-of-truth document.
- **Dependencies:** Phase 1A.
- **Priority:** Critical
- **Estimated Complexity:** Small
- **Owner:** Founding Engineer / AI Research Lead

### Phase 2 — Supabase Integration

- **Objective:** Stand up Supabase as the system of record for authentication, data storage, RLS-enforced authorization, and serverless business logic.
- **Main Deliverables:** Supabase client integration; project configuration (`supabase/config.toml`); Edge Functions runtime and shared plan-rules module; database schema baseline and migration history.
- **Status:** Completed
- **Definition of Done:** Frontend reads/writes through the Supabase client under RLS; Edge Functions deployed and callable; schema migrations apply cleanly from a fresh database.
- **Dependencies:** Phase 1A.
- **Priority:** Critical
- **Estimated Complexity:** Medium
- **Owner:** Backend Engineer

### Phase 3 — Authentication

- **Objective:** Provide secure, workspace-scoped sign-up, sign-in, and session management as the entry point to the product.
- **Main Deliverables:** Login/Signup pages; session hook and auth service; protected/onboarding route guards; RLS-based workspace-membership authorization; onboarding flow (`src/pages/Onboarding.jsx` and `src/components/onboarding/*`).
- **Status:** Completed
- **Definition of Done:** A new user can sign up, complete onboarding, and reach a workspace whose data is correctly scoped and inaccessible to other workspaces, verified against RLS policies rather than client-side checks alone.
- **Dependencies:** Phase 2.
- **Priority:** Critical
- **Estimated Complexity:** Medium
- **Owner:** Backend Engineer / Founding Engineer

### Phase 4 — Beauty Passport

- **Objective:** Give each client a persistent, professional-facing profile of preferences, history, allergies, and formulas that professionals can reference and build on over time.
- **Main Deliverables:** `src/pages/BeautyPassport.jsx`; supporting client/visit data services (`src/services/clients.ts`, `src/services/visits.ts`).
- **Status:** In Progress
- **Definition of Done:** A professional can view and update a client's Beauty Passport, and the data correctly feeds downstream features (AI Assistant client summaries, aftercare guidance) without duplication of source-of-truth data.
- **Dependencies:** Phase 2, Phase 3.
- **Priority:** High
- **Estimated Complexity:** Medium
- **Owner:** Full-stack Engineer

### Phase 5 — Appointment System

- **Objective:** Deliver end-to-end appointment scheduling, status tracking, and service association wired to real backend data.
- **Main Deliverables:** `src/pages/Appointments.jsx`; `src/services/appointments.ts`; `src/lib/appointmentView.js`; service/service-template data model (`src/services/services.ts`, `serviceTemplates.ts`).
- **Status:** In Progress
- **Definition of Done:** Professionals can create, view, update, and cancel appointments against live Supabase data, with correct workspace scoping and status transitions.
- **Dependencies:** Phase 2, Phase 3, Phase 4.
- **Priority:** Critical
- **Estimated Complexity:** Large
- **Owner:** Full-stack Engineer

### Phase 6 — Marketplace

- **Objective:** Enable clients to discover and book independent professionals/salons through a shared marketplace surface, beyond a single professional's existing client base.
- **Main Deliverables:** Marketplace browsing/discovery UI; public professional/salon profile pages; search and filtering; booking handoff into the existing Appointment System.
- **Status:** Planned
- **Definition of Done:** A prospective client can discover a professional through the marketplace and complete a booking without prior direct relationship, and the professional's existing workspace data model supports being listed.
- **Dependencies:** Phase 4, Phase 5.
- **Priority:** Medium
- **Estimated Complexity:** Large
- **Owner:** Unassigned

### Phase 7 — Payments

- **Objective:** Convert the existing plan/subscription data model into real, billable commerce, and support in-app payment collection for bookings where applicable.
- **Main Deliverables:** Stripe (or equivalent) integration for subscription billing; webhook-driven `subscription_status`/`plan_tier` updates (currently a manual/placeholder field per `src/services/subscription.ts`); payment collection flow for marketplace bookings, if in scope.
- **Status:** Planned
- **Definition of Done:** A workspace can upgrade/downgrade/cancel a real subscription through a real payment processor, with server-side state kept in sync via webhooks rather than client-asserted values; the existing `FeatureGate`/`hasFeature()` gating logic (already mirrored server-side in the AI Assistant function) correctly reflects live billing state.
- **Dependencies:** Phase 2, Phase 3.
- **Priority:** High
- **Estimated Complexity:** Large
- **Owner:** Unassigned

### Phase 8 — Notifications

- **Objective:** Keep professionals and clients informed of appointment changes, reminders, and business-relevant events without requiring them to be inside the app.
- **Main Deliverables:** Notification data model and delivery channel(s) (email and/or SMS and/or push, to be decided); appointment reminder and status-change triggers; notification preference controls.
- **Status:** Planned
- **Definition of Done:** Appointment creation, changes, and cancellations reliably trigger the appropriate notification to the correct recipient, with an auditable delivery record and user-controllable preferences.
- **Dependencies:** Phase 5.
- **Priority:** Medium
- **Estimated Complexity:** Medium
- **Owner:** Unassigned

### Phase 9 — Maps & Routing

- **Objective:** Let mobile/on-the-go professionals see an optimized route between appointments, reducing dead travel time between clients.
- **Main Deliverables:** `src/pages/RouteEngine.jsx`; `src/components/RouteMap.jsx`; `src/lib/routeOptimizer.js`; `src/services/route.ts`; `supabase/functions/route-planner/index.ts` (server-side routing using a secret Mapbox token, never exposed to the browser); Mapbox GL JS integration with a documented public/secret token split in `.env.example`.
- **Status:** Completed
- **Definition of Done:** A professional's day of appointments renders as an optimized route on a live map, computed server-side, with graceful degradation when the map token is not configured. **Met** — live-verified against real Mapbox APIs (geocoding, matrix, directions) and the real Supabase backend, including schedule-conflict detection, cross-workspace/tamper protection, and timezone-aware date handling. Three defects found during verification were fixed and re-verified live. See `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md` for the full record (filed under "Phase 12," the label used for this verification pass at the time — it covers this Phase 9 item; see Change Log).
- **Dependencies:** Phase 2, Phase 5.
- **Priority:** High
- **Estimated Complexity:** Large
- **Owner:** Full-stack Engineer

### Phase 10 — AI Platform

- **Objective:** Deliver differentiated, genuinely useful AI features across two tracks — (a) an operational AI Assistant for day-to-day business questions, and (b) a purpose-built, self-hosted face-shape classifier (BR-FS-001) that does not depend on a paid third-party model API.
- **Main Deliverables:**
  - *AI Assistant track:* `supabase/functions/ai-assistant/index.ts` (client summaries, next-visit suggestions, aftercare guidance, workspace chat with tool use), server-side plan gating and rate limiting, `src/pages/AIEngine.jsx`, `src/services/ai.ts`.
  - *BR-FS-001 track:* `docs/ai/FACE_SHAPE_DATASET_RESEARCH.md`, `FACE_SHAPE_COMPARISON.md`, `FACE_SHAPE_DECISION.md`, `BR-FS-001_LITERATURE_REVIEW.md`, `BR-FS-001_ARCHITECTURE_SELECTION.md`, `BR-FS-001_MODEL_SPECIFICATION.md`.
- **Status:** In Progress
- **Definition of Done:** *AI Assistant track:* feature is live, plan-gated, and rate-limited in production (met). *BR-FS-001 track:* dataset licensing gate resolved (REQUIRES LICENSE REVIEW → cleared), MobileNetV3-Large baseline trained and benchmarked against a literature-precedented backbone (Xception or EfficientNetV2S) as specified, and a reviewed, approved model artifact exists — none of which has started, by design, until the licensing gate clears.
- **Dependencies:** Phase 2, Phase 3 (AI Assistant track); dataset licensing resolution, external to this codebase (BR-FS-001 track).
- **Priority:** High
- **Estimated Complexity:** Large
- **Owner:** AI Research Lead

### Phase 11 — Testing

- **Objective:** Introduce automated test coverage before the codebase grows further, given that zero automated tests currently exist anywhere in the repository.
- **Main Deliverables:** Test runner/framework selection and setup; unit tests for business-critical logic (plan gating, RLS-adjacent authorization checks, route optimization); integration tests for Edge Functions; a CI gate that runs tests on every change.
- **Status:** Completed
- **Definition of Done:** Core business logic (subscription/plan gating, authentication/authorization boundaries, appointment scheduling logic) has automated test coverage, and CI fails the build on a broken test. **Met** — 255 Vitest tests (frontend, across 32 files) + 43 Deno tests (Edge Functions and shared plan rules) cover plan gating, authentication/route guards, workspace context, and the appointment/client/service/Beauty Passport domain pages; `.github/workflows/ci.yml` runs lint, tests, coverage, and build on every push/PR, confirmed green on a real GitHub Actions run. Full record: `docs/testing/TEST_STRATEGY.md` (the original plan), `docs/testing/PHASE_15_FINAL_REPORT.md` (final summary of what was actually built and verified), and `docs/quality/PHASE_16_REMEDIATION_REPORT.md` (the 11 additional regression tests added while fixing the three defects Phase 15 found but left unfixed). Not yet covered: Supabase-local-dev/RLS integration tests and end-to-end tests, both explicitly documented as deferred rather than claimed.
- **Dependencies:** Phases 2–9 (tests need real features to test).
- **Priority:** Critical
- **Estimated Complexity:** Large
- **Owner:** Unassigned

### Phase 12 — Security Review

- **Objective:** Formally review authentication, authorization (RLS), secret handling, and third-party API exposure across the full application before wider release.
- **Main Deliverables:** A documented security review covering RLS policy correctness, Edge Function authorization boundaries, secret/token handling (Supabase keys, Anthropic API key, Mapbox tokens), and dependency licensing exposure.
- **Status:** Completed
- **Definition of Done:** A formal review is completed and its findings addressed or explicitly accepted as known risk, with no unresolved critical or high-severity findings. **Met** — a full read-only audit (initial posture score 72/100) found no Critical findings and four High-severity defects (a stale `schema.sql` baseline, a persistent unauthorized dev-workspace membership grant, signup account enumeration, and unsafe workspace deletion), all fixed and independently re-verified across eight subsequent steps; final posture score 90/100. All four Medium findings were substantially addressed (password reset added, rate limiting moved to a durable Postgres-backed mechanism, Edge Function CORS restricted from a wildcard to an explicit allowlist) except branch protection, which remains **configuration debt** — confirmed off via the GitHub API, with exact manual enable steps documented, since no authenticated GitHub tooling was available to configure it directly. Both flagged Low findings (mass-assignment-shaped updates, unvalidated image URLs) were closed. New CI security gates (secret scanning, a documented `npm audit` exception allowlist, pinned GitHub Actions) now run on every push. Full record: `docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md`. This phase does not constitute or advance Phase 13 (Performance Optimization) or Production Launch, both of which remain Planned.
- **Dependencies:** Phases 2–10.
- **Priority:** Critical
- **Estimated Complexity:** Medium
- **Owner:** Unassigned

### Phase 13 — Performance Optimization

- **Objective:** Ensure the application performs acceptably under realistic multi-workspace, multi-appointment load before beta traffic arrives.
- **Main Deliverables:** Frontend bundle/performance audit; database query/index review against real usage patterns; Edge Function latency review (the AI Assistant already enforces internal timeouts and a bounded tool-use loop as a starting point).
- **Status:** Completed
- **Definition of Done:** Defined performance budgets (page load, query latency, Edge Function response time) are met under a realistic simulated load. **Met for the areas actually in scope** — a read-only audit (posture score 68/100) drove 7 subsequent steps: route-level code splitting, a shared session context, bounded/paginated appointment queries, targeted memoization and `select()` query narrowing, bounded-concurrency Route Planner geocoding (~5x faster critical path), CI-enforced bundle budgets (5 budgets, all passing with 12–43% real margin), and this final report. Net result: initial eager JS+CSS payload down 49.9% (274.52 KB → 137.67 KB gzip), now protected against regression by `scripts/bundle-budget.mjs` running on every PR. **Not met / explicitly deferred, not silently skipped:** no realistic simulated *load* test was performed (no concurrency/connection-pool/query-plan testing at scale), Web Vitals (LCP/CLS/INP) are documented as targets but not enforced pending a real production deployment (Phase 14), `ai-assistant`'s own latency was not reviewed (only `route-planner` was), and `Clients.jsx`'s client-list query remains unbounded (needs a UI change, out of this phase's scope, explicitly reported rather than worked around). Full record: `docs/performance/PHASE_13_FINAL_REPORT.md` (final report, before/after metrics, technical debt, deferred work, Phase 14 recommendations, and a scored final assessment) and `docs/performance/PHASE_13_BUNDLE_BASELINE.md` (bundle measurement methodology and budget rationale). This phase does not constitute or advance Phase 14 (Deployment) or Production Launch, both of which remain Planned.
- **Dependencies:** Phases 2–10.
- **Priority:** Medium
- **Estimated Complexity:** Medium
- **Owner:** Unassigned

### Phase 14 — Deployment

- **Objective:** Establish a repeatable, automated deployment pipeline; none currently exists (no CI/CD configuration is present in the repository today).
- **Main Deliverables:** CI/CD pipeline (build, lint, test, deploy); environment/secrets management for staging and production; deployment runbook.
- **Status:** Planned
- **Definition of Done:** A change merged to the main branch can be deployed to staging and then production through a repeatable, documented, automated process — not a manual one.
- **Dependencies:** Phase 11, Phase 12.
- **Priority:** Critical
- **Estimated Complexity:** Medium
- **Owner:** Unassigned

### Phase 15 — Beta Launch

- **Objective:** Release BeautyRoute to a limited set of real professionals to validate the core workflow under real-world conditions before general availability.
- **Main Deliverables:** Beta cohort recruitment; feedback-collection process; monitoring/alerting for the beta environment; a defined beta exit criteria.
- **Status:** Planned
- **Definition of Done:** A defined cohort of real professionals actively uses BeautyRoute for real appointments over a sustained period, with feedback collected and critical issues resolved.
- **Dependencies:** Phases 11–14.
- **Priority:** High
- **Estimated Complexity:** Medium
- **Owner:** Unassigned

### Phase 16 — Production Launch

- **Objective:** Open BeautyRoute to general availability as a commercial product.
- **Main Deliverables:** Public launch plan; finalized pricing and billing (Phase 7 complete); production support process; post-launch monitoring.
- **Status:** Planned
- **Definition of Done:** BeautyRoute is generally available, billable, monitored, and supportable without founder-only intervention for routine issues.
- **Dependencies:** Phase 15 and all preceding phases.
- **Priority:** Critical
- **Estimated Complexity:** Large
- **Owner:** Unassigned

---

## Future Product Ideas

**Status:** None of the items below are implemented, scheduled, or assigned to a development phase above. They are early, unstructured product concepts carried over from initial product ideation, preserved here for future triage — not commitments, and not evidence of planned work.

- **Beauty Journeys** — A curated, multi-visit experience concept (as opposed to a single one-off appointment), not yet scoped or specified.
- **Favorites / Quick Rebooking** — Letting a client mark a professional, service, or past visit as a favorite and rebook it with minimal steps, not yet scoped or specified.
- **Wedding Journey** — A specialized, occasion-specific booking/preparation flow for weddings, not yet scoped or specified.

These originated from an early, informal product-ideas note (`src/docs/ROADMAP.md`, now removed — its content is preserved here in full).

---

## Risks

- **Mock/placeholder data in early development flows.** Some flows were validated using seeded or placeholder data during early Supabase integration; this must be fully retired before Beta Launch (Phase 15) to avoid conflating "looks correct with seed data" with "is correct under real usage."
- **Dataset licensing (BR-FS-001).** The face-shape classifier's underlying training data is not cleared for use — status is **REQUIRES LICENSE REVIEW** per `docs/ai/FACE_SHAPE_DECISION.md`. This blocks all BR-FS-001 implementation work and has no committed resolution date; it depends on external parties (dataset creators/authors) responding to outreach.
- **Automated test coverage exists but is not exhaustive.** Phase 11 (Testing) is complete — 255 Vitest tests and 43 Deno tests now cover plan gating, auth/route guards, and the core domain pages, enforced in CI. What remains genuinely untested: RLS policy enforcement itself (only the application-code authorization logic alongside it is tested — no Supabase-local-dev/Postgres integration tier exists yet), and end-to-end user flows. See `docs/testing/PHASE_15_FINAL_REPORT.md` and `docs/quality/PHASE_16_REMEDIATION_REPORT.md` for the full breakdown of what is and isn't covered.
- **Three real production defects found during testing were fixed under a dedicated remediation pass (externally labeled "Phase 16," distinct from this roadmap's own Phase 16, Production Launch).** An accessibility-naming defect in `Appointments.jsx`, hardcoded (non-real) revenue/rating figures on the Stylist Dashboard, and a native-vs-application login validation inconsistency were each fixed, tested, and independently verified; a `react-router`/`react-router-dom` CSRF advisory (GHSA-qwww-vcr4-c8h2) was also assessed and found not applicable to this app's usage. Full record: `docs/quality/PHASE_16_REMEDIATION_REPORT.md`. This work does **not** constitute Phase 12 (Security Review), Phase 13 (Performance Optimization), or Phase 16 (Production Launch) below — all three remain Planned.
- **Future commercial licensing exposure.** Two dependencies carry licensing terms that need active tracking as the project moves from graduation project to commercial product: Mapbox GL JS (proprietary license since v2, usage-based account terms) and the eventual BR-FS-001 training dataset (pending Phase 10's licensing resolution). Neither is a defect today, but both require ongoing diligence rather than a one-time check.
- **Payments are not yet real.** The subscription/plan-gating data model exists and is already enforced server-side, but there is no live payment processor behind it — `subscription_status`/`plan_tier` are not yet kept in sync by real billing events. Treating the current state as "billing is done" would be a planning error.
- **Migration-history hygiene.** Several existing database migrations were used to insert and then clean up test/verification data rather than represent durable schema changes, and at least one migration file was left empty with an unedited default name. This is a process risk for schema auditability, not a current data-integrity risk, and should be cleaned up as part of ongoing governance (Phase 1B) rather than left to accumulate. One instance of this risk materialized concretely during the Phase 12 Security Review (finding H-2): a dev-only seed migration granted permanent, never-revoked `workspace_staff` membership into a real, named workspace with no matching cleanup migration, unlike every other test-data migration in this project. Revoked in `supabase/migrations/20260803130000_revoke_dev_workspace_membership.sql`; the recurrence-prevention rule adopted as a result is documented in `docs/quality/DATABASE_MIGRATION_POLICY.md`.

---

## Milestones

- **M1 — Governance Baseline:** Repository audited, roadmap published, AI research fully documented. *(Target: end of Phase 1B.)*
- **M2 — Core Booking Loop Live:** A professional can authenticate, manage a Beauty Passport, and run a full appointment lifecycle on real Supabase data. *(Target: end of Phase 5.)*
- **M3 — Mobile Professional Workflow:** Route optimization is live for a professional's day of appointments. **(Met** — live-verified 2026-08-01 against real Mapbox APIs; see `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`.**)** *(Target: end of Phase 9.)*
- **M4 — AI Platform v1:** AI Assistant fully live (met); BR-FS-001 licensing gate cleared and a benchmarked baseline model exists. *(Target: end of Phase 10.)*
- **M5 — Commerce-Ready:** Marketplace, real payments, and notifications are all live. *(Target: end of Phase 8.)*
- **M6 — Production-Hardened:** Automated tests, a completed security review, and performance budgets are all in place. **(Met** — automated tests (Phase 11), the security review (Phase 12), and performance budgets (Phase 13, `scripts/bundle-budget.mjs` enforced in CI) are all now complete; see `docs/performance/PHASE_13_FINAL_REPORT.md`. "Production-Hardened" describes engineering guardrails, not production readiness itself — deployment (Phase 14), payments (Phase 7), and beta launch (Phase 15) remain separate, unmet milestones below.**)** *(Target: end of Phase 13.)*
- **M7 — Beta Complete:** A real professional cohort has used BeautyRoute in production conditions with critical issues resolved. *(Target: end of Phase 15.)*
- **M8 — Production Launch:** BeautyRoute is generally available and commercially operating. *(Target: end of Phase 16.)*

---

## Change Log

- **2026-08-05 — Phase 13 (Performance Optimization) marked Completed.** A read-only audit (initial posture score 68/100) drove 7 subsequent steps, each shipped through its own PR with full local validation and independently confirmed green on real GitHub Actions CI: (1) route-level code splitting via `React.lazy`/`Suspense` across all 16 page components; (2) a shared `SessionContext`/`SessionProvider` replacing per-route session refetching, mirroring the existing `WorkspaceContext` pattern; (3) bounded, indexed appointment queries (a 90-day-past/180-day-future rolling window replacing an unbounded fetch) plus a dedicated `getTodaysAppointments()`; (4) `WorkspaceContext` value memoization, systematic `select()` column narrowing on `getClients`/`getProfile`/`getServiceTemplates`/`getWorkspaces` after a per-consumer field-usage audit, `Appointments.jsx` render memoization, and lazy-loaded Beauty Passport photos; (5) bounded-concurrency (`GEOCODE_CONCURRENCY = 5`) geocoding in `route-planner`, replacing sequential one-at-a-time requests for a measured ~5x critical-path improvement, with every existing routing result and security control (auth, workspace membership, plan gating, durable rate limiting, CORS, no service-role usage) preserved exactly; (6) `scripts/bundle-budget.mjs`, a deterministic, dependency-free bundle-measurement and CI-budget-enforcement script (5 budgets, all passing with 12–43% real margin) plus `docs/performance/PHASE_13_BUNDLE_BASELINE.md`; (7) this final report. Net effect: initial eager JS+CSS payload down 49.9% (274.52 KB → 137.67 KB gzip), now protected against future regression by CI on every PR; Vitest suite grew from 345 to 395 tests (45 files), Deno tests held at 70. Explicitly deferred, not silently skipped: realistic load/concurrency testing, Web Vitals (LCP/CLS/INP) enforcement (needs a real production domain — Phase 14), `ai-assistant` Edge Function latency review, and `Clients.jsx`'s unbounded client-list query (needs a UI change). A local-only Windows/Rolldown line-ending interaction was found and root-caused (not a defect in the shipped, git-committed code — confirmed via the actual LF git blob and a real, already-green Linux CI run) and is recorded as cross-platform-testing technical debt. Full record: `docs/performance/PHASE_13_FINAL_REPORT.md` (including a scored final assessment across scalability, maintainability, frontend/backend performance, testing maturity, CI maturity, and production readiness) and `docs/performance/PHASE_13_BUNDLE_BASELINE.md`. This phase does not constitute or advance Phase 14 (Deployment) or Production Launch, both of which remain Planned.
- **2026-08-04 — Phase 12 (Security Review) marked Completed.** A full read-only audit (initial posture score 72/100) found no Critical findings and four High-severity defects, all fixed and independently re-verified across eight subsequent steps (final posture score 90/100): (1) `schema.sql` was stale relative to applied migrations — regenerated directly from the live linked database and re-verified after every later schema change; (2) a dev-only seed migration had granted permanent, never-revoked `workspace_staff` membership into a real, named workspace — revoked via a targeted, idempotent migration after read-only confirmation the row still existed live; (3) signup explicitly revealed whether an email was already registered, defeating Supabase's own anti-enumeration API behavior — now shows an identical generic confirmation in both cases; (4) workspace deletion had no safe general-purpose path (a confirmed FK-ordering bug between the audit trigger and RESTRICT constraints) — replaced with an ordered, atomic, audit-preserving `delete_workspace()` function. All four Medium findings were substantially addressed: a full password-reset flow was added; Edge Function rate limiting moved from a per-isolate in-memory Map to a durable, atomic, cross-function-isolated Postgres-backed limiter; Edge Function CORS was restricted from `Access-Control-Allow-Origin: *` to an explicit origin allowlist. Branch protection on `main` remains **off** (confirmed via the GitHub API) and is recorded as configuration debt — exact manual GitHub UI steps are documented, since no authenticated GitHub tooling was available in this environment to enable it directly; this requires action from the repository owner, not further engineering work. Both flagged Low findings were closed: `updateProfile`/`updateWorkspace`/`updateWorkspaceSettings` now reject any field outside an explicit allowlist instead of silently forwarding it, and persisted image/avatar URLs are now validated as well-formed http(s) URLs before being stored. New CI security gates now run on every push: a deterministic, self-contained secret scanner (tracked files + full git history, no external upload) and a `npm audit` gate with a documented, narrow exception allowlist (currently just the already-confirmed-non-applicable react-router advisory GHSA-qwww-vcr4-c8h2) rather than a blanket high/critical suppression; all three GitHub Actions are now pinned to exact commit SHAs. Net effect across the full phase: Vitest suite grew from 244 to 345 tests (41 files), Deno tests from 43 to 60. Full record: `docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md`. This phase does not constitute or advance Phase 13 (Performance Optimization) or Production Launch, both of which remain Planned.
- **2026-08-03 — Production issue remediation completed (externally labeled "Phase 16" — unrelated to this roadmap's own Phase 16, Production Launch, and to the "Phase 15"/"Phase 12" external labels noted elsewhere in this log).** Fixed all three real production defects that the Phase 11 testing effort found but explicitly left unfixed pending approval: (1) `Appointments.jsx`'s Services field now uses a native `fieldset`/`legend` group so each service toggle button has its own distinct accessible name instead of every button being announced as "Services"; (2) `StylistDashboard.jsx` now shows real, workspace-scoped monthly revenue from the existing RLS-enforced `revenues` table via a new `src/services/revenue.ts` service-layer function, and an honest "Not available" state for average client rating (no ratings/reviews table exists in the schema — confirmed by full enumeration, not assumed; building one is unscoped future product work) — the previous hardcoded "SAR 5,600" and "4.9 ★" are gone; (3) `Login.jsx` now uses `noValidate` so the app's own validation is the single, consistent source of truth instead of the browser's native constraint validation sometimes winning the race, and the shared `Input` component gained `aria-invalid`/`aria-describedby`/`role="alert"` wiring so validation errors are properly exposed to assistive technology. A separate dependency assessment of `react-router`/`react-router-dom` (both at 7.18.1) against advisory GHSA-qwww-vcr4-c8h2 found the advisory's vulnerable surface (React Router's unstable RSC APIs) is not used anywhere in this codebase, which uses the classic `BrowserRouter`/`Routes`/`Route` API with no data loaders/actions — no dependency change was made or is currently recommended. Net effect: Vitest suite grew from 244 to 255 tests (32 files); all validation (lint, tests, coverage, Deno tests, build, tracked-secret scan) passed cleanly and a real GitHub Actions run on `main` was confirmed green after each step. Full record: `docs/quality/PHASE_16_REMEDIATION_REPORT.md`. This work is issue remediation only — it does not constitute or advance Phase 12 (Security Review), Phase 13 (Performance Optimization), or this roadmap's own Phase 16 (Production Launch), all three of which remain Planned.
- **2026-08-02 — Phase 11 (Testing) marked Completed.** Built an automated
  test foundation across 9 steps (externally labeled "Phase 15" during that
  work — unrelated to this roadmap's own Phase 15, Beta Launch, and to the
  earlier "Phase 12"/Phase 9 labeling note below): Vitest + React Testing
  Library for the frontend (244 tests across 31 files) and Deno tests for
  both Edge Functions plus the shared plan-rules module (43 tests),
  covering plan gating, authentication/route guards, workspace context,
  and the client/service/appointment/Beauty Passport domain pages, plus a
  GitHub Actions CI workflow confirmed green on a real run. Three real,
  independent production issues were found and explicitly left unfixed
  (reported, not silently patched) pending separate approval: an
  accessibility-naming issue in `Appointments.jsx`'s Services field,
  hardcoded (non-real-data) revenue/rating figures in
  `StylistDashboard.jsx`, and a native-vs-custom email-validation UX
  inconsistency in `Login.jsx`. Explicitly not yet covered: Supabase-
  local-dev/RLS integration tests (RLS policies themselves are not yet
  exercised by an automated test against a real Postgres instance) and
  end-to-end tests — both documented as deferred, not claimed. Full
  record: `docs/testing/TEST_STRATEGY.md` and
  `docs/testing/PHASE_15_FINAL_REPORT.md`. No application behavior,
  routing, Edge Function logic, or migrations were changed by this work.
- **2026-08-02 — Added "Future Product Ideas" section; removed obsolete `src/docs/ROADMAP.md`.** The three forward-looking concepts from that early, informal product-ideas note (Beauty Journeys, Favorites / Quick Rebooking, Wedding Journey) were preserved verbatim in a new "Future Product Ideas" section above, explicitly labeled as unimplemented, unscoped ideas rather than planned work. No development phase, milestone status, or phase numbering was changed by this update.
- **2026-08-01 — Phase 9 (Maps & Routing) marked Completed.** Live-verified the Route Engine end to end against real Mapbox APIs (geocoding, distance/duration matrix, directions) and the real Supabase backend, now that both `MAPBOX_SECRET_TOKEN` and `VITE_MAPBOX_PUBLIC_TOKEN` were configured. Verified: real geocoding, multi-stop routing, route optimization, schedule-conflict detection, manual rerouting, missing/unresolved-address handling, cancelled-appointment exclusion, cross-workspace and tamper protection, authentication and plan gating, timezone-aware date boundaries, start/end location geocoding, real map initialization, external navigation links, browser-bundle secret checks, and clean `oxlint`/`vite build` runs. Three real defects were found, fixed, and re-verified live: (1) low-confidence Mapbox geocoding matches were being accepted as correct — fixed with a relevance threshold; (2) the `reroute` tamper-check wrongly rejected legitimate reorders — fixed to validate a duplicate-free subset instead of an exact-length match; (3) day-boundary calculation ignored the workspace's timezone, which could misclassify appointments near midnight for non-UTC workspaces (e.g. the `Asia/Riyadh` test workspace) — fixed with a proper local-to-UTC boundary conversion. The `route_too_large` stop-count cap was verified by code review only, not a live 24+-stop request, and is documented as such rather than claimed as live-tested. Full record: `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md` (filed under "Phase 12," the external label used for this verification pass; internally this roadmap tracks the same work as Phase 9). All temporary verification data and diagnostic code were removed and confirmed gone; no application behavior outside the route-planner function and the day-boundary helper was changed.
