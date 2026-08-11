# BeautyRoute

## 1. Project overview

BeautyRoute is a web application for independent beauty professionals (starting
with mobile hairstylists) to run client relationships, scheduling, and
day-to-day operations from one place, backed by a real Supabase database with
row-level-security enforcement. It is under active development; this document
describes what currently exists in this repository, not a target/marketing
description of the finished product.

**Primary users:** independent, mobile beauty professionals (e.g. hairstylists)
managing their own client base and schedule.
**Secondary users (planned, not yet built):** salon teams and clients booking
directly through a public-facing surface — see Current mocked features and Known limitations.

## 2. Features currently implemented

Wired to real Supabase data, with workspace-scoped row-level security:

- **Authentication & onboarding** (`/login`, `/signup`, `/onboarding`, plus
  `/forgot-password` and `/reset-password`)
- **Service hub / landing** (`/`)
- **Dashboard** (`/dashboard`)
- **Clients** (`/clients`)
- **Services** (`/services`)
- **Appointments** (`/appointments`)
- **Beauty Passport** (`/passport`) — a per-client profile, visit history, and notes
- **Route Engine** (`/route`) — server-computed, optimized daily routes between
  appointments using Mapbox
- **AI Engine** (`/ai`) — the AI Assistant (see Section 18)
- **Pricing / subscription plans** (`/pricing`) — plan-tier gating enforced
  both client-side and server-side; real payment processing is **not**
  implemented (see Known limitations)
- **Business Engine** (`/business`) — revenue/expenses (6-month series) and
  longest-standing clients, all from real workspace-scoped Supabase queries

## 3. Tech stack

- **Frontend:** React 19.2.7, Vite 8.1.1, React Router 7.18.1, Tailwind CSS
  4.3.3 (via `@tailwindcss/vite`), Recharts 3.9.2, lucide-react 1.25.0
- **Backend:** Supabase — Postgres 17, Auth, Row-Level Security, Storage,
  Realtime, Edge Functions (Deno runtime)
- **AI:** Anthropic API, called only from a server-side Supabase Edge Function
  (`ai-assistant`) — the provider key never reaches the browser
- **Maps/Routing:** Mapbox — Geocoding, Matrix, and Directions APIs called
  server-side (`route-planner` Edge Function); Mapbox GL JS client-side for
  rendering
- **Testing:** Vitest 4.1.10 + React Testing Library 16.3.2 (+ `jest-dom`,
  `user-event`) for the frontend, jsdom as the DOM environment, Deno's
  built-in test runner for Edge Functions
- **Tooling:** oxlint 1.71.0 (linting), Supabase CLI 2.109.1 (installed as an
  npm dev dependency — invoke via `npx supabase ...`, no separate global
  install required)

## 4. System architecture

The app is a client-side-rendered React SPA (`react-router-dom`,
`BrowserRouter`) that talks directly to Supabase from the browser using the
public anon key, with all authorization enforced by Postgres row-level-security
policies keyed on workspace membership — not by client-side checks alone. Two
capabilities that require a provider secret (AI, and Mapbox geocoding/routing)
are never called directly from the browser; they go through dedicated
Supabase Edge Functions that hold the real secrets server-side and validate
the caller's forwarded Supabase JWT before doing anything.

## 5. Repository structure

```text
src/
  components/        Shared UI (components/ui/), layout, auth/onboarding/
                      routing/subscription-specific components, and the map
                      component.
  contexts/           SessionContext, WorkspaceContext (shared session and
                      current-workspace state).
  data/               Static mock data. Only one export (`clients`) remains
                      in use, by Client Portal only — see Section 16.
  docs/               In-app product/brand reference stubs (FEATURES.md,
                      DATABASE.md, BRAND_GUIDELINES.md, PRODUCT_BIBLE.md) —
                      see the note in Section 5's audit remarks; these are
                      minimal placeholder files, not a substantive reference.
  hooks/              useSession, useCurrentWorkspace, useSubscription.
  lib/                Route optimizer, plan rules, dev-only auth bootstrap,
                      Supabase client/types, appointment/month-series view
                      helpers, input validation.
  pages/              One file per route (see Section 2).
  services/           Supabase data-access layer, one file per domain: ai,
                      appointments, auth, clients, expenses, files, profiles,
                      revenue, route, serviceTemplates, services,
                      subscription, visits, workspaces.
  styles/beautyroute/ The real, in-use design-token stylesheet.
  test/               Vitest setup (`setup.js`).

supabase/
  functions/          Edge Functions — ai-assistant, route-planner, and a
                      _shared/ module (cors.ts, planRules.ts, rateLimit.ts,
                      edgeTestUtils.ts). See Section 12.
  migrations/         Incremental schema changes, applied in filename
                      (timestamp) order. See Section 10.
  config.toml         Supabase project configuration (local dev ports,
                      Postgres major version, Edge Runtime settings, etc.).
  seed.sql            Local-dev seed script run by `supabase start`/`db
                      reset`. Intentionally seeds no data — see Section 11.
  tests/              Real local-Postgres RLS integration test(s) + its own
                      README (prerequisites, known environment caveats).
                      Not run in CI. See Section 13.

docs/
  PROJECT_ROADMAP.md  Phase-by-phase status, risks, milestones, and the
                      project's own change log. Start here for current
                      project state.
  ai/                 BR-FS-001 research trail (see Section 18).
  security/           Phase 12 security review — final report.
  performance/        Phase 13 performance optimization — final report and
                      bundle-measurement baseline.
  testing/            Phase 15 testing strategy and final report.
  quality/            Database migration policy; Phase 16 remediation report.
  verification/       Live-verification reports against real external
                      services (currently: Maps & Routing).
  operations/         Build notes — current production build snapshot,
                      cross-referencing docs/performance/ for the full
                      before/after measurement.
  design-reference/   Historical design-tool export, not production code —
                      see its own NOTICE.md.

scripts/              secret-scan.sh, dependency-audit.mjs, bundle-budget.mjs
                      (+ its own test) — see Sections 13 and 15.
schema.sql             Baseline database schema snapshot (see Section 10).
PROJECT_BRIEF.md       The original one-page founding product brief.
.env.example           Names and explanations of every environment variable
                      (see Section 9) — never contains real values.
```

## 6. Prerequisites

Verified from this repository's own configuration — nothing below is a
generic assumption:

- **Node.js 24** — pinned exactly in `.github/workflows/ci.yml`
  (`actions/setup-node`, `node-version: "24"`). `package.json` declares no
  `engines` field, so CI's pinned version is the only verified constraint;
  it is not independently confirmed to be a hard local requirement.
- **npm** — bundled with Node; no specific npm version is pinned anywhere in
  this repository.
- **Git**
- **Supabase CLI** — already an npm dev dependency (`supabase@^2.109.1`);
  `npm install` is enough to get it, invoked via `npx supabase ...`. A
  separate global install is not required.
- **Deno 2.9.4** — only needed to run the Edge Function tests locally
  (`supabase/functions/**`) or to use `supabase functions serve`; not
  required for ordinary frontend development. Pinned exactly in
  `.github/workflows/ci.yml` (`denoland/setup-deno`, `deno-version:
  "2.9.4"`).
- **Docker** — only needed if you run a local Supabase stack (`supabase
  start`, for local Postgres/Auth/RLS). Not required if you link this
  project to a real hosted Supabase project instead. (`docs/testing/TEST_STRATEGY.md`
  notes Docker Desktop was used for this during Phase 15's planning, but
  this is not independently re-verified as part of this audit.)

## 7. Installation

```bash
git clone <this-repository-url>
cd "platform salma"
npm install
cp .env.example .env
```

Then fill in `.env` with your own values — see Section 9
for every variable name and what it's for. Never commit `.env` (it's already
excluded by `.gitignore`; only `.env.example` is tracked).

## 8. Local development

```bash
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173` — no custom
`server.port` is configured in `vite.config.js`).

- **Dev-only auth bootstrap:** if `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD` are set,
  `src/lib/devAuth.js` signs in as that user automatically on load (gated
  behind `import.meta.env.DEV`; this code does not exist in a production
  build). This only **signs in** — it does not create the user. You must
  create that user yourself first (Supabase Studio → Authentication → Add
  user).
  - **Audit note (verified, not previously documented in this README):** an
    earlier migration (`20260724110000_seed_dev_workspace_membership.sql`)
    granted a specific seeded dev user membership in a specific pre-existing
    workspace. A later migration
    (`20260803130000_revoke_dev_workspace_membership.sql`, part of the Phase
    12 security review's H-2 fix) **revokes that exact membership**. Applying
    the full migration history in order — which is what any fresh local
    setup does — nets out to **no pre-existing workspace membership** for a
    freshly created dev user. What happens after sign-in from there depends
    on that user's `profiles.onboarding_completed` value, which is not set
    by any migration in this repository (it's part of the manually-created
    Studio user) and so cannot be verified here. In practice, expect to go
    through the normal `/onboarding` flow (see `ProtectedRoute`/
    `OnboardingRoute` in `src/components/routing/`) to create your own
    workspace, rather than being pre-added to any specific one.
- **Map tiles may fail to load locally with a CORS error** — expected, not a
  bug. `VITE_MAPBOX_PUBLIC_TOKEN` is domain-restricted in the Mapbox account
  to the production domain(s); `localhost` isn't on that allowlist. All
  routing logic (geocoding, matrix, directions, optimization) runs
  server-side and is unaffected.

## 9. Environment variables

Names only — see `.env.example` for the full explanation of each. **Never**
commit real values; only `.env.example` (with empty values) is tracked.

**Client-side** (`VITE_`-prefixed, bundled into the app — each is designed
for browser exposure or is dev-only):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_PUBLIC_TOKEN` — the map renders a graceful "not configured"
  placeholder if this is unset, rather than crashing
- `VITE_DEV_EMAIL` — dev-only, gated behind `import.meta.env.DEV` (see
  Section 8)
- `VITE_DEV_PASSWORD` — dev-only, gated behind `import.meta.env.DEV`

**Server-side** (Supabase Edge Function secrets — set with `supabase secrets
set NAME=value`, never in a `VITE_` var or committed anywhere):

- `ANTHROPIC_API_KEY` — the LLM provider key used by the `ai-assistant` Edge
  Function
- `MAPBOX_SECRET_TOKEN` — used server-side by `route-planner` for geocoding/
  matrix/directions calls
- `ALLOWED_ORIGINS` — optional CORS allowlist for both Edge Functions
  (comma-separated origins, e.g.
  `https://app.example.com,https://example.com`); local dev origins are
  allowed even if this is unset (verified in
  `supabase/functions/_shared/cors.ts`)

**Auto-provided, not something you set manually:** `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are read via `Deno.env.get(...)` inside both Edge
Functions, but these are injected automatically by the Supabase Edge
Function runtime itself — they are not part of the `supabase secrets set`
workflow.

## 10. Database migration order

`schema.sql` at the repository root is a **baseline snapshot** of the full
schema (tables, types, functions, triggers, RLS policies) — regenerated
directly from the live linked database as of the Phase 12 security review.
It is a reference, not something you apply directly. The actual source of
truth for provisioning a database is `supabase/migrations/*.sql`, applied in
filename (timestamp) order via the Supabase CLI (`supabase db push` for a
linked remote project, or `supabase db reset` for a local one). In order:

1. `20260722092124_name_of_your_migration.sql`
2. `20260724100000_add_missing_rls_policies.sql`
3. `20260724110000_seed_dev_workspace_membership.sql`
4. `20260724120000_fix_is_workspace_member_recursion.sql`
5. `20260724130000_professional_onboarding.sql`
6. `20260724130100_backfill_onboarding_completed.sql`
7. `20260724130200_cleanup_p5_test_services.sql`
8. `20260724140000_fix_audit_trigger_rls.sql`
9. `20260725100000_phase9_test_second_workspace.sql`
10. `20260725100100_cleanup_phase9_test_workspace.sql`
11. `20260725150000_phase11_verification_workspaces.sql`
12. `20260725150100_cleanup_phase11_verification_workspaces.sql`
13. `20260803120000_safe_workspace_deletion.sql`
14. `20260803130000_revoke_dev_workspace_membership.sql`
15. `20260803140000_durable_rate_limiting.sql`

Two additional files in this directory —
`20260803120000_safe_workspace_deletion.test.ts` and
`20260803140000_durable_rate_limiting.test.ts` — are **Deno tests for their
matching migration's function, not migrations themselves**; the Supabase CLI
only applies `.sql` files.

Several migrations above are paired seed/cleanup migrations for
verification data (Phase 9, Phase 11) or a since-reverted dev seed (#3,
revoked by #14 — see Section 8's audit note). This is a known, intentional
pattern for this project, governed by
[`docs/quality/DATABASE_MIGRATION_POLICY.md`](docs/quality/DATABASE_MIGRATION_POLICY.md):
any future migration that seeds dev/test identity data into a real,
shared workspace must ship with a matching cleanup migration.

## 11. Supabase setup

There is no project-specific, step-by-step Supabase setup guide committed
anywhere in this repository today (flagged as a real gap in
Section 20). What follows is
built only from this repository's own `supabase/config.toml` and the
Supabase CLI's actual, verified command surface (`npx supabase --help`) —
not invented steps, but also not a substitute for a project-specific guide.

**Option A — link to a real hosted Supabase project:**

```bash
npx supabase link
npx supabase db push
```

This applies every migration in `supabase/migrations/` (Section 10) to the
linked project, in order. You'll need your own project's credentials from
the Supabase dashboard — none are in this repository.

**Option B — run a local Supabase stack (requires Docker):**

```bash
npx supabase start
```

Local ports, from this repo's own `supabase/config.toml`: API `54321`,
Postgres `54322`, Studio `54323`, local email testing (Inbucket) `54324`,
Analytics `54327`. **Known issue, confirmed during the Phase 14
handover-closure pass:** `supabase start`'s automatic migration replay
currently fails against a genuinely fresh/empty database — the first
migration file is empty, so a later one references a table nothing
earlier ever created. See `supabase/tests/README.md` for the exact error
and the workaround (applying `schema.sql` directly). If that doesn't
affect you, `supabase start` applies all migrations automatically,
then runs `supabase/seed.sql` (referenced by `config.toml`'s `[db.seed]`
block). That file intentionally seeds no demo data — see its own header
comment for why (every meaningful table traces back to `auth.users` via a
foreign key, and `auth.users` isn't something raw seed SQL should
populate) — and instead documents the real path: create a user in Studio,
then complete the normal `/onboarding` flow.

Either way, after applying migrations you still need to set the server-side
secrets (`supabase secrets set ANTHROPIC_API_KEY=...`
etc.) before the Edge Functions will work end-to-end.

## 12. Edge Functions

Location: `supabase/functions/`.

- **`ai-assistant`** — the AI Assistant backend (see
  Section 18).
- **`route-planner`** — server-side geocoding, route matrix, optimization
  input, and schedule-conflict detection for the Route Engine.
- **`_shared/`** — code shared by both functions:
  `planRules.ts` (a server-side mirror of the frontend's `hasFeature()`
  plan-gating logic, so plan limits can't be bypassed by calling a function
  directly), `cors.ts` (the `ALLOWED_ORIGINS`-driven CORS allowlist),
  `rateLimit.ts` (durable, Postgres-backed rate limiting), and
  `edgeTestUtils.ts` (test-only fetch-stubbing helper).

Run locally (requires Docker): `npx supabase functions serve`.
Deploy: `npx supabase functions deploy <function-name>`.

## 13. Running tests

```bash
npm run test         # Vitest, watch mode
npm run test:run      # Vitest, single run
npm run test:coverage # Vitest, single run + v8 coverage report
```

Real local-Postgres RLS integration test (LOCAL ONLY, requires Docker, not
run in CI — see `supabase/tests/README.md` for prerequisites and exact
setup, including two environment caveats found while building it):

```bash
npm run test:rls:local
```

Edge Function tests (Deno — not run by any `npm` script; this is the exact
command CI uses, from `.github/workflows/ci.yml`):

```bash
deno test --allow-net --allow-env --allow-read --node-modules-dir=none \
  supabase/functions/_shared/planRules.test.ts \
  supabase/functions/ai-assistant/index.test.ts \
  supabase/functions/route-planner/index.test.ts
```

**Verified current state of this repository (main, this audit):** 398
Vitest tests across 48 files, all passing; 70 Deno tests, all passing;
`npm run lint` (oxlint) passes with zero findings.

One caveat, not a regression: `scripts/bundle-budget.test.ts` fails to parse
under Vitest on a Windows checkout specifically (a `core.autocrlf`/Rolldown
shebang-stripping interaction) — documented in
`docs/performance/PHASE_13_FINAL_REPORT.md`. It passes on Linux CI, which is
the authoritative environment for this project.

CI (`.github/workflows/ci.yml`, on every push/PR to `main`) runs three
required jobs — exact names:

- **Frontend quality (lint, test, coverage, build):** `npm ci` → `npm run
  lint` → `npm run test:run` → `npm run test:coverage` → `npm run build` →
  `npm run perf:bundle-budget`.
- **Edge Function tests (Deno):** the exact `deno test` command above.
- **Repository security gates (secrets, dependency audit):** `bash
  scripts/secret-scan.sh` (tracked files + full git history) → `npm ci` →
  `node scripts/dependency-audit.mjs`.

## 14. Security notes

- **Authorization is database-enforced**, via Postgres row-level-security
  policies keyed on workspace membership — the frontend never asserts
  access on its own.
- **Provider secrets never reach the browser.** The Anthropic API key and
  the Mapbox *secret* token exist only as Supabase Edge Function secrets.
  The one deliberate exception is the Mapbox *public* token
  (`VITE_MAPBOX_PUBLIC_TOKEN`), which Mapbox explicitly designs for browser
  exposure and which is domain-restricted in the Mapbox account.
- **Edge Functions validate the caller**, not a service-role key: each
  function is called with the user's own forwarded Supabase JWT and
  performs its own auth + workspace-membership + plan-gating checks
  server-side, independent of the frontend's own `FeatureGate` UI.
- **A formal security review is complete.** Phase 12's review found no
  Critical findings; four High-severity defects were found and fixed
  (posture score: 72/100 → 90/100). Full record:
  [`docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md`](docs/security/PHASE_12_SECURITY_REVIEW_FINAL_REPORT.md).
- **CI never touches real external services.** Every credential in
  `ci.yml` is a fixed, non-secret placeholder; frontend tests mock the
  Supabase client boundary, and Edge Function tests set their own fake env
  vars in-process.
- Automated dependency and secret scanning run in CI on every push (see
  Section 13); the one currently-allowlisted advisory
  (`GHSA-qwww-vcr4-c8h2`, a react-router advisory whose vulnerable surface
  isn't used by this codebase) is documented in
  `scripts/dependency-audit.mjs`.

## 15. Deployment steps

**There is no deployment automation in this repository.** Verified: no
`vercel.json`, `netlify.toml`, `Dockerfile`, or any other deployment config
exists anywhere in this repo; `.github/workflows/ci.yml` explicitly
contains no deployment/publish step of any kind (its own top comment says
so). Per `docs/PROJECT_ROADMAP.md`, **Phase 14 (Deployment) is Planned, not
started** — this is accurate, current project status, not an omission in
this README. Do not invent deployment steps here; when Phase 14 begins,
this section should be replaced with real, verified instructions.

## 16. Current mocked / placeholder features

- **Client Portal** (`/client-portal`) — a client-facing demo screen.
  Genuinely blocked, not an oversight: there is no client-facing
  auth/identity system yet (the route is intentionally outside the
  professional-side `ProtectedRoute`), and no business-resolution mechanism
  for an anonymous visitor to reach a specific workspace's real data. Every
  mocked value in `src/pages/ClientPortal.jsx` carries its own
  `TODO(mockData-audit, 2026-08-05)` comment at its exact location stating
  what's mocked, why, and the specific missing dependency. The page itself
  shows a visible "Prototype" notice (not just a source comment) stating
  that AI analysis and booking are simulated and not connected to live
  backend services.
- **Salon Engine** (`/salon`) — a locked "coming soon" preview with no data
  layer; intentionally inert until a future Salon plan tier exists.

Business Engine (`/business`) **used to be in this list** and no longer is
— it was migrated onto real Supabase queries in the mock-data audit that
also produced this README rewrite; `src/data/mockData.js` was trimmed from
5 exports down to the one (`clients`) still used by Client Portal above.

## 17. Known limitations

- **No deployment pipeline exists** (see Section 15).
- **Payments are not implemented.** The subscription/plan-tier data model
  exists end-to-end and is enforced server-side, but there is no live
  payment processor behind it.
- **Production subscription billing is not implemented.** `plan_tier` /
  `subscription_status` are not yet kept in sync by real billing events.
- **BR-FS-001 has no implementation** (see Section 19).
- **Client Portal and Salon Engine are not wired to real data** (Section 16).
- **Real-Postgres RLS integration coverage is minimal, not a full tier.**
  One real test exists and passes — `supabase/tests/rls_workspace_isolation.sql`
  (`npm run test:rls:local`), proving workspace isolation on the `clients`
  table against a real local Postgres instance with the real RLS policies
  applied. Every other RLS-protected table is still only covered by
  mocked-boundary Vitest/Deno tests, and this test is not wired into CI
  (no local Postgres/Docker in the CI environment, by design). See
  `supabase/tests/README.md`, `docs/testing/PHASE_15_FINAL_REPORT.md`, and
  `docs/testing/TEST_STRATEGY.md`.
- **No end-to-end (Playwright) tests exist yet.**
- **`src/docs/` reference files are minimal stubs**, not substantive
  documentation (audit finding — see Section 20): `PRODUCT_BIBLE.md` is
  empty (0 bytes); `FEATURES.md`, `DATABASE.md`, and `BRAND_GUIDELINES.md`
  are each a few lines.
- **No `CONTRIBUTING.md`, `LICENSE`, or `CODE_OF_CONDUCT.md` exists** in
  this repository (verified: not present at the repository root).

## 18. AI Assistant status

**Implemented, live application feature.** A server-side LLM integration,
called only from the `ai-assistant` Supabase Edge Function (the Anthropic
API key is a server-side secret, never present in the browser bundle). It
provides client summaries, next-visit suggestions, aftercare guidance, and
workspace chat, gated by the caller's forwarded JWT, workspace membership,
and server-side plan checks (`hasFeature`). Source:
`supabase/functions/ai-assistant/index.ts`, `src/services/ai.ts`,
`src/pages/AIEngine.jsx`.

## 19. BR-FS-001 classifier status

**Research-only, not implemented.** A custom, self-hosted face-shape
classifier initiative — currently **documentation and research only**:
dataset research, a documented model/architecture selection
(MobileNetV3-Large), and a full model specification. **No model code, no
training run, and no deployed model exist.** The dataset licensing status
is explicitly **"REQUIRES LICENSE REVIEW"** (the exact final-decision text
in `docs/ai/FACE_SHAPE_DECISION.md`), which blocks any implementation work
from starting — no dataset, academic or commercial, is currently cleared
for any of the 3 candidates identified. Full record, including a
stage-by-stage status table and training-readiness checklist:
`docs/ai/BR-FS-001_CURRENT_STATUS.md` (start there) and the rest of
`docs/ai/`. Client Portal's simulated AI face-shape analysis (see Section
16) is a placeholder for this initiative, not an early version of it.

## 20. Still missing before handover-ready (audit findings, not fixed here)

Found during this audit; explicitly **not** invented or fixed as part of
this README rewrite, per instruction:

- **No project-specific Supabase setup guide exists anywhere in this repo**
  (Section 11 is built from generic, verified CLI mechanics only).
- **The migration chain cannot bootstrap a fresh database from scratch**
  (confirmed during the Phase 14 handover-closure pass, building the RLS
  test in `supabase/tests/` — see that directory's README.md for the full
  detail and workaround). Anyone following Section 11's `supabase start`
  path on a brand-new project will hit this. Not fixed here — it needs an
  initial-schema migration added by someone with authority over this
  project's migration history.
- **`src/docs/*.md` are stub files** that read as if they're real reference
  docs but aren't — worth either fleshing out or removing.
- **No `CONTRIBUTING.md`.** This README's own Contributing section
  (Section 21) is built entirely from verifiable facts (the CI jobs that
  must pass, the PR-based pattern observed in git history) — it is not a
  substitute for a real, owner-authored contributing guide covering things
  like code style conventions, commit message format, or review
  expectations, none of which are formally documented anywhere in this
  repository today.
- **No `LICENSE` file** — this repository's licensing terms are not
  established anywhere; this audit does not invent one.

## 21. Contributing

There is no `CONTRIBUTING.md` in this repository (see Section 20). What
follows is built only from what's actually observable in this repo's own
CI configuration and recent git history — not an invented process:

- Changes are made on a feature branch and opened as a pull request against
  `main` (observed pattern in this repository's merged-PR history).
- Before opening a PR, run locally: `npm run lint`, `npm run test:run`,
  `npm run build` — these are exactly what CI's "Frontend quality" job
  runs (plus `test:coverage` and `perf:bundle-budget`; see Section 13).
- If you touch `supabase/functions/`, also run the Deno test command in
  Section 13.
- If you touch dependencies, `node scripts/dependency-audit.mjs` will run
  in CI's security job — see that script for how to handle a new advisory.
- If you add a migration that seeds dev/test identity data,
  `docs/quality/DATABASE_MIGRATION_POLICY.md` (Section 10) governs how —
  read it first.
- All 3 CI jobs named in Section 13 must pass on your PR (verified via this
  repository's own merged-PR history — every recent merge shows all 3
  green before merging).
