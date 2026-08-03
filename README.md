# BeautyRoute

## 1. Project Overview

BeautyRoute is a web application for independent beauty professionals (starting
with mobile hairstylists) to run client relationships, scheduling, and
day-to-day operations from one place, backed by a real Supabase database with
row-level-security enforcement. It is under active development; this document
describes what currently exists in this repository, not a target/marketing
description of the finished product.

## 2. What BeautyRoute currently provides

- Account creation, sign-in, and a guided onboarding flow.
- A per-client "Beauty Passport": profile, history, and notes.
- Appointment scheduling against live data.
- An LLM-powered AI Assistant (client summaries, next-visit suggestions,
  aftercare guidance, workspace chat) — a live, gated application feature.
- Server-computed, optimized daily routes between appointments using Mapbox.
- Subscription/plan-tier gating (feature access), enforced both client-side
  and server-side. Real payment processing is **not** implemented.

## 3. Target users

- **Primary:** independent, mobile beauty professionals (e.g. hairstylists)
  managing their own client base and schedule.
- **Secondary (planned, not yet built):** salon teams and clients booking
  directly through a public-facing surface — see Current Limitations.

## 4. Current implemented modules

Wired to real Supabase data, with workspace-scoped RLS:

- Authentication & onboarding (`/login`, `/signup`, `/onboarding`)
- Service hub / landing (`/`)
- Dashboard (`/dashboard`)
- Clients (`/clients`)
- Services (`/services`)
- Appointments (`/appointments`)
- Beauty Passport (`/passport`)
- Route Engine — maps & optimized routing (`/route`)
- AI Engine — AI Assistant (`/ai`)
- Pricing / subscription plans (`/pricing`)

Present in the app but **not** yet wired to real data (placeholder or mock
data only — see Current Limitations):

- Business Engine (`/business`) — uses static mock data from `src/data/mockData.js`.
- Client Portal (`/client-portal`) — a client-facing demo screen, explicitly
  marked in its own source as using demo data pending a real implementation.
- Salon Engine (`/salon`) — a locked "coming soon" preview with no data layer;
  intentionally inert until a future Salon plan tier exists.

## 5. Technology stack

- **Frontend:** React 19, Vite, React Router 7, Tailwind CSS v4, Recharts, lucide-react
- **Backend:** Supabase (Postgres, Auth, Row-Level Security, Edge Functions)
- **AI:** Server-side LLM integration, called only from a server-side Supabase Edge Function
- **Maps/Routing:** Mapbox (Geocoding, Matrix, Directions APIs server-side; Mapbox GL JS client-side for rendering)
- **Tooling:** oxlint (linting), Supabase CLI

## 6. System architecture

The app is a client-side-rendered React SPA (`react-router-dom`, `BrowserRouter`)
that talks directly to Supabase from the browser using the public anon key,
with all authorization enforced by Postgres row-level-security policies keyed
on workspace membership — not by client-side checks alone. Two capabilities
that require a provider secret (AI, and Mapbox geocoding/routing) are never
called directly from the browser; they go through dedicated Supabase Edge
Functions that hold the real secrets server-side and validate the caller's
forwarded Supabase JWT before doing anything.

## 7. Supabase architecture

- **Database:** Postgres, schema defined by `schema.sql` plus incremental
  files in `supabase/migrations/`.
- **Row-Level Security:** every table access is scoped by workspace
  membership at the database layer.
- **Edge Functions** (`supabase/functions/`):
  - `ai-assistant` — the AI Assistant backend (see Section 8).
  - `route-planner` — server-side geocoding, route matrix, optimization
    input, and schedule-conflict detection for the Route Engine.
  - `_shared/planRules.ts` — a server-side mirror of the frontend's
    `hasFeature()` plan-gating logic, so plan limits can't be bypassed by
    calling an Edge Function directly.
- **Project configuration:** `supabase/config.toml`.

## 8. AI architecture

BeautyRoute has **two separate AI-related initiatives**. They are not the
same thing and should not be described interchangeably:

- **AI Assistant — implemented application feature.** A live feature backed
  by a server-side LLM integration, called only from the `ai-assistant`
  Supabase Edge Function (the provider API key is a server-side secret,
  never present in the browser bundle). It provides client summaries, next-visit suggestions,
  aftercare guidance, and workspace chat, gated by the caller's forwarded
  JWT, workspace membership, and server-side plan checks (`hasFeature`).
  Source: `supabase/functions/ai-assistant/index.ts`, `src/services/ai.ts`,
  `src/pages/AIEngine.jsx`.

- **BR-FS-001 — research-only, not implemented.** A custom, self-hosted
  face-shape classifier initiative, currently **documentation and research
  only**: dataset research, a documented model/architecture selection
  (MobileNetV3-Large), and a full model specification. **No model code, no
  training run, and no deployed model exist.** The dataset licensing status
  is explicitly **REQUIRES LICENSE REVIEW**, which blocks any implementation
  work from starting. Full record: `docs/ai/`.

## 9. Security model

- **Authorization is database-enforced**, via Postgres row-level-security
  policies keyed on workspace membership — the frontend never asserts access
  on its own.
- **Provider secrets never reach the browser.** The LLM provider API key and
  the Mapbox *secret* token exist only as Supabase Edge Function secrets. The one
  deliberate exception is the Mapbox *public* token (`VITE_MAPBOX_PUBLIC_TOKEN`),
  which Mapbox explicitly designs for browser exposure and which is
  domain-restricted in the Mapbox account; it cannot geocode or compute
  routes on its own.
- **Edge Functions validate the caller**, not a service-role key: each
  function is called with the user's own forwarded Supabase JWT and performs
  its own auth + workspace-membership + plan-gating checks server-side,
  independent of the frontend's own `FeatureGate` UI.
- **Automated tests exist and run in CI** (244 Vitest tests, 43 Deno Edge
  Function tests — see Section 17), but **no formal security review has
  been completed yet** — see `docs/PROJECT_ROADMAP.md` (Phase 12).

## 10. Maps & Routing status

Live-verified against the real Mapbox Geocoding, Matrix, and Directions APIs
and the real Supabase backend (not simulated). Provides address geocoding,
a 2-opt route-order optimization heuristic (an estimate, not a claim of
global optimality), schedule-conflict detection, missing/unresolved-address
handling, and external navigation links. One item (the 23-stop route size
cap) is verified by code review only, not by a live request that actually
triggered it. Full record: `docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`.

In local development, the map's *tiles* may fail to load due to a CORS error
— this is expected: the public Mapbox token is domain-restricted to the
production domain(s) in the Mapbox account, and `localhost` isn't on that
allowlist. All routing logic (geocoding, matrix, directions, optimization)
runs server-side and is unaffected by this.

## 11. Project structure

```text
src/
  components/       Shared UI (components/ui/), layout, auth/onboarding/
                     routing/subscription-specific components, and the map
                     component.
  contexts/          WorkspaceContext (current workspace/session state).
  data/              Static mock data still used by Business Engine and
                     Client Portal (see Current Limitations).
  docs/              In-app product/brand reference docs (not build output;
                     see Documentation Index).
  hooks/             useSession, useCurrentWorkspace, useSubscription.
  lib/               Route optimizer, plan rules, dev-only auth bootstrap,
                     Supabase client/types, appointment view helpers.
  pages/             One file per route (see Section 4).
  services/          Supabase data-access layer, one file per domain
                     (clients, appointments, visits, services, auth,
                     workspaces, subscription, route, ai, files, profiles).
  styles/beautyroute/  The real, in-use design-token stylesheet.

supabase/
  functions/         Edge Functions (see Section 7).
  migrations/         Incremental schema changes (see Section 14).
  config.toml         Supabase project configuration.

docs/
  PROJECT_ROADMAP.md  Phase-by-phase status, risks, milestones.
  ai/                 BR-FS-001 research trail (see Section 8).
  design-reference/   Historical design-tool export, not production code —
                       see its own NOTICE.md.
  verification/       Live-verification reports (e.g. Maps & Routing).

schema.sql             Baseline database schema (see Section 14).
```

## 12. Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`).

## 13. Required environment variables

Names only — see `.env.example` for the full explanation of each, never
commit real values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_PUBLIC_TOKEN`
- `VITE_DEV_EMAIL` (dev-only auth bootstrap, gated behind `import.meta.env.DEV`)
- `VITE_DEV_PASSWORD` (dev-only auth bootstrap, gated behind `import.meta.env.DEV`)

Server-side secrets (set via `supabase secrets set`, never in a `VITE_` var
or committed anywhere): `MAPBOX_SECRET_TOKEN`, and `ANTHROPIC_API_KEY` (the
LLM provider key used by the `ai-assistant` Edge Function).

## 14. Database and schema.sql

`schema.sql` is a baseline snapshot of the full database schema (tables,
types, functions, triggers, and row-level-security policies). The files in
`supabase/migrations/` are the incremental changes applied since that
baseline, applied in filename (timestamp) order. Some existing migrations
were used to insert and later clean up test/verification data rather than
represent durable schema changes — this is a known, tracked process risk,
not a current data-integrity issue; see the Risks section of
`docs/PROJECT_ROADMAP.md`.

## 15. Documentation index

- `docs/PROJECT_ROADMAP.md` — phase-by-phase status, risks, milestones, and
  the project's own change log. **Start here** for current project state.
- `docs/ai/` — BR-FS-001 research trail (dataset research, comparison,
  decision, literature review, architecture selection, model specification).
- `docs/verification/` — live-verification reports against real external
  services (currently: Maps & Routing).
- [`docs/operations/BUILD_NOTES.md`](docs/operations/BUILD_NOTES.md) —
  current production build status, bundle-size warnings, and deferred
  optimization ideas.
- `docs/design-reference/` — historical design-tool export, retained for a
  future visual redesign; see its `NOTICE.md` for what it is and isn't.
- `src/docs/` — in-app product/brand reference material (`FEATURES.md`,
  `DATABASE.md`, `BRAND_GUIDELINES.md`, `PRODUCT_BIBLE.md`).
- `PROJECT_BRIEF.md` — the original one-page founding product brief.

## 16. Current limitations

- **Payments are not implemented.** The subscription/plan-tier data model
  exists end-to-end and is enforced server-side, but there is no live
  payment processor behind it.
- **Production subscription billing is not implemented.** `plan_tier` /
  `subscription_status` are not yet kept in sync by real billing events.
- **BR-FS-001 has no implementation** — research and specification only, and
  blocked on dataset licensing review (see Section 8).
- **Business Engine, Client Portal, and Salon Engine are not wired to real
  data** (see Section 4).
- **No formal security review has been completed yet.**
- **No Supabase-local-dev/RLS integration test tier exists yet** — RLS
  policies themselves are not yet exercised by an automated test against a
  real Postgres instance; automated tests cover the application-code
  authorization logic that runs alongside RLS. See
  `docs/testing/PHASE_15_FINAL_REPORT.md`.
- **No end-to-end (Playwright) tests exist yet.**
- **Production build emits bundle-size warnings** (main bundle and the
  Mapbox GL chunk both exceed the default 500 kB advisory threshold) — see
  [`docs/operations/BUILD_NOTES.md`](docs/operations/BUILD_NOTES.md) for the
  full breakdown and deferred optimization ideas.

## 17. Current development status

See `docs/PROJECT_ROADMAP.md` for the authoritative, maintained phase-by-phase
status. As of this writing: authentication, onboarding, clients, services,
appointments, the Beauty Passport, the AI Assistant, Maps & Routing, and
automated testing are complete; a formal security review, performance
optimization, deployment automation, and beta launch are still planned.

Automated testing is implemented and enforced in CI on every push/PR via
`.github/workflows/ci.yml`:

- **244 Vitest + React Testing Library tests** (frontend unit, hook, and
  component tests) — all passing.
- **43 Deno tests** covering both Supabase Edge Functions and the shared
  plan-gating module — all passing.
- **`npm run lint` currently passes with zero findings.**

Full record, including known coverage gaps and issues found (but not yet
fixed) along the way: `docs/testing/PHASE_15_FINAL_REPORT.md`.

## 18. Branch strategy

- **`main`** is the authoritative and default branch. It reflects the
  current application described throughout this document.
- **`design-integration`** still exists alongside `main` for now and has not
  yet been removed.
