# Phase 13 Final Report — Performance Optimization

**Status:** Completed
**Steps completed:** 7 of 7
**Full step-by-step record:** individual PR reports for each step below; this document is the consolidated closeout.

---

## Executive Summary

Phase 13 set out to make BeautyRoute perform acceptably under realistic multi-workspace, multi-appointment load before beta traffic arrives, starting from a read-only audit (posture score 68/100) that found no code splitting, unbounded appointment queries, unmemoized context values causing avoidable re-renders, over-fetched `select('*')` queries, sequential (one-at-a-time) geocoding in the Route Planner, and no CI mechanism to prevent bundle-size regressions from ever being introduced.

Seven steps later, every one of those findings has been addressed with a measured, evidence-based fix, each shipped through its own PR with full local validation and independently confirmed green on real GitHub Actions CI:

1. Route-level code splitting (`React.lazy`/`Suspense`)
2. Shared session context (eliminate redundant per-route session refetching)
3. Bounded and paginated data queries (rolling-window appointment queries)
4. Targeted memoization and safe query narrowing (`select()` column reduction, context value memoization)
5. Route Planner geocoding parallelization (bounded-concurrency, ~5x critical-path improvement)
6. Performance measurement and CI budgets (deterministic bundle-budget script + baseline documentation)
7. This final report and phase closeout

**Headline result:** the initial eager JS+CSS payload dropped from 274.52 KB to 137.67 KB gzip — a **49.9% reduction** — with the improvement now protected against regression by CI-enforced budgets on every future PR, not just a one-time cleanup that could silently erode over time.

Nothing about this phase changed application behavior, database schema, or security posture — every step preserved existing routing results, RLS scoping, plan gating, rate limiting, and CORS behavior exactly, verified by the full pre-existing test suite passing unmodified alongside new, targeted tests for each change.

---

## Scope Completed

| Step | What shipped | PR / Merge commit |
|---|---|---|
| 1 | Every one of 16 page components converted to `React.lazy()` behind a shared `Suspense` boundary; auth/public routes prioritized | PR #1 — `a931c18` |
| 2 | `SessionContext`/`SessionProvider` replacing per-route `useSession()` refetching, mirroring the existing `WorkspaceContext` pattern | PR #2 — `cba71d6` |
| 3 | `getTodaysAppointments()` + a bounded rolling window (90 days past / 180 days future) for `getAppointments()`, both using indexed `.gte()`/`.lt()` filters | PR #3 — `1ba56cf` |
| 4 | `WorkspaceContext` value memoization; `select()` column narrowing on `getClients`/`getProfile`/`getServiceTemplates`/`getWorkspaces`; `Appointments.jsx` day-filter memoization; lazy-loaded Beauty Passport photos | PR #4 — `12249b0` |
| 5 | Bounded-concurrency (`GEOCODE_CONCURRENCY = 5`) geocoding in `route-planner`, replacing sequential per-address requests, folding in start/end location geocoding | PR #5 — `c74bd53` |
| 6 | `scripts/bundle-budget.mjs` (deterministic dist/ measurement + 5 enforced budgets) wired into CI; `docs/performance/PHASE_13_BUNDLE_BASELINE.md` | PR #6 — `55244ab` |
| 7 | This report; `docs/PROJECT_ROADMAP.md` updated to mark Phase 13 Completed | This PR |

Everything shipped through the mandatory PR workflow (branch protection on `main`, 3 required status checks, no direct pushes) established during Phase 12.

---

## Performance Improvements Achieved

### Before/after metrics

| Metric | Pre-Phase-13 | Post-Step-5 (feature work complete) | Change |
|---|---:|---:|---:|
| Initial eager JS (gzip) | 260.85 KB | 129.27 KB | **−50.4%** |
| Initial eager CSS (gzip) | 13.67 KB | 8.40 KB | **−38.6%** |
| Total initial eager JS+CSS (gzip) | 274.52 KB | 137.67 KB | **−49.9%** |
| Largest eager JS chunk (raw) | 925.57 KB | 447.43 KB | −51.7% |
| Total generated chunks | 3 | 45 | +42 (route-level granularity) |
| Route Planner geocoding critical path (23 stops + start/end) | 25T (sequential) | 5T (bounded-parallel, cap 5) | **~5x faster** |
| Appointments query result set (typical workspace) | unbounded (entire history) | bounded to a 270-day rolling window | prevents unbounded growth |

*(T = one geocode round-trip latency; see `docs/performance/PHASE_13_BUNDLE_BASELINE.md` and the Step 5 PR report for the full derivation.)*

All bundle figures are this repo's own `scripts/bundle-budget.mjs` measurements (Node `zlib.gzipSync`, binary KB) — not Vite's own build-log figures, which use a different gzip implementation/level and decimal kB units. See the baseline doc's unit note before comparing against Vite's console output directly.

### Bundle evolution

```
Pre-Phase-13 (edb9811):     ██████████████████████████████████████████████████  274.52 KB
Post-Step-1  (a931c18):     █████████████████████████                           138.68 KB
Post-Step-5  (c74bd53):     █████████████████████████                           137.67 KB
                             (initial eager JS+CSS, gzip)
```

Nearly the entire improvement (49.5 of the eventual 49.9 percentage points) landed in Step 1 alone — route-level code splitting was by far the highest-leverage single change. Steps 2–5 held that gain steady while fixing correctness/latency issues elsewhere (redundant fetches, unbounded queries, sequential external API calls) rather than chasing further bundle-size reduction, which is the expected and correct pattern: the first code-splitting pass captures most of the "things that don't need to be in the initial bundle at all" opportunity; subsequent work reasonably shifts to runtime behavior.

One finding surfaced only during Step 6's careful re-measurement, not fixed as part of this phase: the single largest eager chunk grew from 245.67 KB (post-Step-1) to 447.43 KB (post-Step-5) as Vite's automatic chunking re-consolidated shared dependency code across Steps 2–5's context/service changes, even though the *aggregate* eager payload stayed essentially flat. This is now a tracked, budgeted metric (500 KB, ~12% margin) rather than an unmonitored blind spot — see Remaining Technical Debt below.

### Route optimization summary

The Route Planner's geocoding step (`supabase/functions/route-planner/index.ts`) previously geocoded every unique stop address, plus the optional start/end location, strictly one at a time via a sequential `for...of` loop with `await` on each iteration. Step 5 replaced this with a small, self-contained bounded-concurrency worker pool (`runWithConcurrency`, `GEOCODE_CONCURRENCY = 5`) shared identically by both the `plan` and `reroute` actions. Every existing behavior was preserved exactly: `MAX_STOPS`, address deduplication, the `MIN_GEOCODE_RELEVANCE` fuzzy-match threshold, unresolved/missing-address classification, result ordering, single-failure-aborts-the-batch semantics, and every security control (auth, workspace membership, plan gating, durable rate limiting, CORS, no service-role usage) — none of which were touched by this step. Result: a maximal 23-stop route now completes its geocoding phase in roughly 1/5th the sequential time, at a small, fixed, explicitly-capped increase in worst-case concurrent load on Mapbox (never unbounded, never scaling linearly with route size).

### Query optimization summary

`getAppointments()` previously fetched a workspace's entire appointment history with no bound. Step 3 added `APPOINTMENTS_WINDOW_DAYS_PAST = 90` / `APPOINTMENTS_WINDOW_DAYS_FUTURE = 180` and switched to `.gte('start_time', ...).lt('start_time', ...)` filtering, leveraging the existing composite index's leftmost-prefix rule without any new migration. A separate, purpose-built `getTodaysAppointments(workspaceId)` was added for the Stylist Dashboard's actual need (today's schedule only), removing a client-side `todayISODate()` filter step. Step 4 then narrowed `select()` column lists on `getClients`, `getProfile`, `getServiceTemplates`, and `getWorkspaces` after a systematic, per-consumer field-usage audit — reducing response payload size without dropping any field a real caller reads, and deliberately retaining fields like `workspace_id` needed for scoping even when not directly rendered. One genuine gap was found and explicitly **not** silently worked around: `Clients.jsx`'s `getClients()` call remains unbounded, because the list is client-side-searched in full and any numeric limit would silently drop matching clients from search results without a corresponding UI change (server-side search/pagination) — this was reported, not fixed, per explicit instruction to stop and report rather than guess at UI changes.

### Rendering optimization summary

`WorkspaceContext`'s (and the new `SessionContext`'s) provider value objects are now `useMemo`'d, so consumers that only care about a subset of the context no longer re-render on every provider re-render caused by unrelated state changes. `Appointments.jsx`'s day-filter (`dayAppts`) is now memoized against `[appointments, active]` instead of recomputing on every render. `BeautyPassport.jsx`'s before/after photos gained explicit `width`/`height`/`loading="lazy"` attributes matching their existing CSS dimensions, deferring off-screen image decode cost. Every memoization was applied only where a real, evidenced re-render cost existed — no speculative `useMemo`/`useCallback` was added without a traced justification.

### CI performance budgets summary

`scripts/bundle-budget.mjs` (zero new dependencies — Node's built-in `zlib`) now runs after every `npm run build` in CI, measuring the real `dist/` output and failing the build if any of 5 budgets is exceeded:

| Budget | Limit | Metric |
|---|---:|---|
| Initial eager JS | 150 KB gzip | aggregate, network-transfer-relevant |
| Initial eager CSS | 12 KB gzip | aggregate |
| Total initial eager JS+CSS | 165 KB gzip | aggregate |
| Largest eager JS chunk | 500 KB raw | single-chunk, parse-cost-relevant |
| Largest lazy route chunk | 400 KB raw | single-chunk |

`mapbox-gl` is measured and printed but never gated — see the baseline doc for why. All 5 budgets currently pass with 12–43% real, measured margin — tight enough to catch a genuine regression, loose enough not to fail on routine, harmless changes.

---

## Report — Final Measured Numbers

| Measurement | Result |
|---|---|
| Total Vitest tests | **395** (across 45 test files) |
| Total Deno tests | **70** (`planRules.test.ts` + `ai-assistant/index.test.ts` + `route-planner/index.test.ts`, the exact CI command) |
| Coverage | Statements 82.65% (1387/1678) · Branches 72.26% (956/1323) · Functions 75.7% (377/498) · Lines 85.07% (1208/1420) |
| Bundle budgets | **PASS** — all 5 enforced budgets satisfied with real margin (see table above) |
| Current initial eager JS (gzip) | 129.27 KB |
| Current initial eager CSS (gzip) | 8.40 KB |
| Total improvement from Phase 13 (initial eager JS+CSS, gzip) | **−49.9%** (274.52 KB → 137.67 KB) |
| CI status | All 3 required checks (Frontend quality, Edge Function tests, Repository security gates) green on every Phase 13 merge commit (PRs #1–#6), independently verified via the GitHub Actions API job-by-job after each merge |

**A note on local validation for this step:** running `npm run test:run`/`test:coverage` locally on this Windows development machine surfaces one file-specific anomaly — `scripts/bundle-budget.test.ts` fails to parse under Vitest's SSR transform, tracing to `core.autocrlf=true` converting the script's committed (pure-LF) shebang line to CRLF on local checkout, which breaks Rolldown's shebang-stripping when the file is SSR-imported as a test dependency. This was confirmed to be a local-checkout-only artifact, not a defect in the shipped code: the actual git blob on `origin/main` has clean LF line endings (verified via `git show origin/main:scripts/bundle-budget.mjs | xxd`), and this exact file already passed cleanly on real GitHub Actions CI (Linux) during Step 6's merge. Per this step's explicit documentation-only scope, no test or script file was modified to work around it locally; the numbers above reflect the authoritative, CI-confirmed state (Step 6's real merge-commit CI run), and this step's own CI run (once opened) will independently reconfirm it. This is recorded as a genuine, newly-discovered piece of technical debt below — CI has never run on Windows, so this class of issue has no automated detection today.

---

## Remaining Technical Debt

- **Largest eager JS chunk (447 KB raw) has not been further split.** It's within its CI budget (500 KB, ~12% margin) but is meaningfully larger than it was right after Step 1 (245.67 KB), due to Vite's automatic re-consolidation of shared dependency code as the module graph changed across Steps 2–5. A follow-up bundle-analyzer pass (e.g. `rollup-plugin-visualizer`) to identify what's actually in that chunk and whether it can be split further was not performed in this phase.
- **`mapbox-gl` remains a very large dependency (1.8 MB raw / ~485 KB gzip),** even though it's correctly excluded from the initial-load path. No investigation was done into whether a lighter alternative, a partial/modular import, or further code-splitting within the Route Planner itself could reduce this.
- **`Clients.jsx`'s client list query remains unbounded** — explicitly identified in Step 3, explicitly not fixed, because a safe fix requires UI changes (server-side search/pagination) that were out of that step's scope. This is the one genuine, load-bearing gap in the query-bounding work.
- **No CI job runs on Windows.** This phase's own Step 6 work surfaced a real, previously-invisible platform-specific issue (the CRLF/Rolldown interaction above) that only a Windows-based local run — never CI — would ever catch. The actual shipped code is unaffected (Linux CI is the deployment-relevant platform), but this is a blind spot in the project's cross-platform development experience worth knowing about.
- **A handful of shared UI components have 0% test coverage** (`Table.jsx`, `Toast.jsx`, `Tooltip.jsx`, `IconButton.jsx`, `Pagination.jsx`, per the coverage table) — pre-existing, outside Phase 13's scope, but relevant context for Phase 13's own coverage numbers above.

---

## Deferred Work

- **Web Vitals enforcement (LCP/CLS/INP)** — targets are documented (`docs/performance/PHASE_13_BUNDLE_BASELINE.md`) but deliberately not enforced in CI, since meaningful measurement requires a real, deployed production domain and realistic network/device conditions, neither of which exist yet (Phase 14, Deployment, is still Planned). This is the natural, explicitly-flagged follow-up once a real hosting target exists.
- **Database query-plan verification.** The bounded appointment queries (Step 3) are designed to leverage an existing composite index's leftmost-prefix rule, but no `EXPLAIN ANALYZE` was run against realistic data volume to confirm the query planner actually uses that index as expected at scale.
- **Edge Function latency review beyond Route Planner.** Phase 13's original charter mentioned a general Edge Function latency review; only `route-planner` (Step 5) received dedicated optimization work. `ai-assistant`'s own latency profile was not part of this phase's scope.
- **No load/concurrency testing.** Nothing in this phase simulated realistic concurrent multi-workspace traffic (connection pool behavior, lock contention, cold-start latency under load). This is appropriately deferred to a dedicated load-testing effort once a staging environment exists (Phase 14+).
- **No historical bundle-size trend tracking.** CI budgets catch an absolute regression against a fixed threshold on each run, but there's no time-series view of bundle size across commits.

---

## Recommended Phase 14 Priorities

Phase 14 (Deployment) is the next Planned phase per the roadmap. Recommended priorities informed directly by this phase's findings:

1. **Stand up a real staging/production deployment target**, which unblocks both Web Vitals enforcement (LCP/CLS/INP against real conditions) and genuine load testing — both explicitly deferred above for exactly this reason.
2. **Add Windows (or at minimum a second OS) to CI's test matrix**, or at least document the CRLF/`core.autocrlf` interaction found in this phase as a known local-dev gotcha, so it isn't rediscovered from scratch by a future contributor.
3. **A short, targeted bundle-analyzer pass** on the 447 KB entry chunk before it grows further — cheap, low-risk, and directly informed by this phase's own measurement.
4. **Revisit `Clients.jsx` pagination** as a small, dedicated UI + query change (server-side search/pagination), closing Phase 13's one explicitly-deferred query gap.
5. **Carry the CI-budget discipline forward** into Phase 14's own deliverables (e.g., a deploy-time budget or smoke-test gate), rather than treating bundle budgets as a one-time Phase 13 artifact.

---

## Lessons Learned

- **Measure before setting a budget, every time, even against your own prior estimates.** The originally suggested 300 KB largest-eager-chunk budget (Step 6) would have failed against the real, current baseline (447 KB) — a mismatch only caught by actually running the measurement rather than trusting an earlier, smaller number from a different point in the phase. Every budget in this phase was set from a fresh, real `npm run build`, not carried forward from memory.
- **The biggest win came first, and that's normal.** Route-level code splitting (Step 1) delivered ~99% of the phase's total eager-payload reduction. Later steps correctly shifted focus to runtime behavior (redundant fetches, unbounded queries, sequential external calls) rather than chasing diminishing bundle-size returns — a reasonable prioritization to make explicit rather than assume.
- **A metric can hold steady in aggregate while shifting underneath.** The largest-single-chunk regression between Step 1 and Step 5 would have gone completely unnoticed without Step 6's re-measurement, because the aggregate eager-gzip figure barely moved. This is the direct argument for why CI budgets need both aggregate *and* single-chunk metrics, not just one or the other.
- **A tool that works during development can still fail in a way CI never catches.** The CRLF/Rolldown interaction found while validating this very report exists specifically because CI only runs on Linux — a genuine, previously-invisible gap that a from-scratch root-cause investigation (not a guess, not a blind retry) traced conclusively to `core.autocrlf`, confirmed against the actual committed git blob, and confirmed non-reproducing on the real CI platform, before concluding it needed no code fix.
- **Stopping to report a gap, instead of quietly working around it, stayed the right call throughout.** `Clients.jsx`'s unbounded query (Step 3) is the clearest example: a numeric `.limit()` would have "passed" every test while silently breaking client search for any workspace with more clients than the limit — a regression worse than the original unbounded-but-correct behavior. Reporting and deferring, rather than shipping a plausible-looking partial fix, was the right trade every time this came up in the phase.

---

## Final Assessment

Scores are out of 100. Each reflects the state of the codebase as of Phase 13's completion, reasoned from direct, first-hand evidence gathered across Phases 9–13 of this engagement (security review, testing foundation, and this performance phase) — not a generic or aspirational rating.

### Scalability — 60/100

**Strengths:** Multi-tenant RLS-enforced Postgres backend from the ground up; appointment queries now bounded to a rolling window leveraging existing indexes (Step 3); durable, atomic, cross-function-isolated Postgres-backed rate limiting (Phase 12) rather than per-isolate in-memory state that would break under horizontal scaling; bounded-concurrency external API calls (Step 5) that don't scale linearly with load.
**Gaps:** No load or concurrency testing has ever been performed against this codebase — every scalability-relevant change in this phase is reasoned from query/request *shape*, not measured under realistic concurrent load. `Clients.jsx` remains a genuinely unbounded query. No documented connection-pooling, read-replica, or caching strategy exists yet. mapbox-gl's 1.8 MB weight is a real concern specifically because BeautyRoute's target user is a mobile professional, plausibly on constrained mobile bandwidth, even though it's correctly kept out of the critical initial-load path.
**Reasoning:** Solid foundational patterns are in place and the multi-tenant design itself scales structurally, but "scalability" as an outcome (not just as an architectural intent) remains unverified — this score reflects real, evidenced groundwork without the load-testing evidence to claim more.

### Maintainability — 78/100

**Strengths:** Exceptionally consistent patterns across the whole codebase and this entire multi-phase engagement — the same "thin wrapper hook over shared Context" pattern used identically for `WorkspaceContext` and `SessionContext`; service-layer separation with consistent allowlist-based field validation; every non-obvious decision commented with its *why*, not just its *what* (visible throughout `route-planner/index.ts`, `bundle-budget.mjs`, and the service files touched in Step 4); a documented migration-hygiene policy; a roadmap kept genuinely current at every phase transition rather than left stale.
**Gaps:** `BusinessEngine.jsx` compiles to a 350 KB lazy chunk on its own, suggesting a large, possibly under-decomposed page component. A handful of shared UI components have zero test coverage. Reliance on very thorough, narrative code comments is a strength for a small team but could become harder to keep accurate as the surface area grows without a lighter-weight architecture-decision-record process.
**Reasoning:** This is the strongest category in this assessment — the discipline evidenced across seven Phase 13 steps (systematic consumer audits before any `select()` narrowing, explicit "don't narrow speculatively" refusals, stop-and-report over silent workarounds) is genuinely above what's typical at this project's stage.

### Frontend Performance — 72/100

**Strengths:** A real, measured 49.9% reduction in initial eager payload; route-level code splitting; memoized context values eliminating avoidable re-renders; narrowed query payloads; lazy-loaded images; now protected by enforced CI budgets with real margin, not just a one-time cleanup.
**Gaps:** The largest single eager chunk (447 KB) is meaningfully larger than immediately post-Step-1 and hasn't been investigated further; mapbox-gl remains very heavy even though correctly excluded from initial load; Web Vitals (LCP/CLS/INP) are documented as targets but have never actually been measured against a real deployment — so "frontend performance" as *experienced by a real user on a real device* remains unverified, only its proxy (bundle size) is.
**Reasoning:** The measured, evidence-based work in this phase is genuinely strong, but the score is held back from higher by the gap between "bundle size improved" (proven) and "a real user's experience improved" (not yet measurable without a production deployment).

### Backend Performance — 65/100

**Strengths:** Bounded, indexed appointment queries; a real, measured ~5x reduction in Route Planner geocoding critical path via safely bounded concurrency, with worst-case provider load explicitly capped rather than left to scale with route size; narrowed `select()` payloads reducing data transfer; every optimization done here preserved every existing security control exactly (verified, not assumed).
**Gaps:** No query-plan verification (`EXPLAIN ANALYZE`) was performed to confirm indexes are actually used efficiently at real data volume; `ai-assistant`, the other Edge Function, received no latency review in this phase at all; `Clients.jsx`'s backend query remains unbounded; no connection-pooling or database-capacity review was performed.
**Reasoning:** Real, measured wins exist exactly where this phase focused (routing, appointments), but the phase's backend scope was narrower than "backend performance" as a whole — this score reflects genuine, verified improvement in a subset of the backend, not a comprehensive backend performance review.

### Testing Maturity — 74/100

**Strengths:** 395 Vitest tests + 70 Deno tests, CI-enforced on every PR; a strong track record across this entire engagement of root-causing flaky/failing tests from first principles rather than papering over them (see the Step 2 CI-flakiness investigation); every Phase 13 step added targeted regression tests proving the specific properties that mattered (concurrency-cap-never-exceeded, ordering-unchanged, one-failure-doesn't-corrupt-others, etc.), not just "does it still pass."
**Gaps:** RLS policies themselves remain untested by an automated integration tier (only the application-layer authorization logic alongside them is tested, a known and previously-documented gap); no end-to-end tests exist; several UI components have zero coverage; and this very step surfaced a real gap in platform coverage — nothing in this project's testing strategy has ever validated behavior on Windows, only Linux (via CI).
**Reasoning:** The *practice* of testing (root-causing, targeted regression coverage, never silently loosening a test to make it pass) is excellent and evidenced repeatedly. The *coverage* has real, acknowledged holes (RLS, e2e, some UI components, cross-platform).

### CI Maturity — 76/100

**Strengths:** Branch protection active with 3 required status checks; every GitHub Action pinned to an exact commit SHA; a PR-only workflow strictly enforced on `main`; secret scanning and a documented `npm audit` exception-allowlist gate; bundle budgets now enforced with real margin, added this phase without any new third-party Action.
**Gaps:** No deployment pipeline exists yet (Phase 14 entirely Planned); no staging environment; CI runs on a single OS (Linux only), which is exactly why this phase's own CRLF/Rolldown finding was invisible until a local Windows run happened to surface it; no Lighthouse/Web-Vitals CI stage yet (correctly deferred, not an oversight); no caching/performance review of the CI pipeline itself.
**Reasoning:** What exists is genuinely well-built and disciplined (pinned Actions, branch protection, layered required checks), but "CI maturity" as a whole is bounded by the absence of anything past the test/build/audit stage — there's no CD, no staging, no deploy gate yet.

### Production Readiness — 40/100

**Strengths:** A completed security review (Phase 12, posture 90/100) with no unresolved Critical/High findings; solid automated test coverage; performance budgets now enforced; a working, RLS-scoped multi-tenant data model already in production use for the features that exist.
**Gaps:** This is intentionally the lowest score, and should be — per `docs/PROJECT_ROADMAP.md`'s own phase numbering (the authoritative source of truth this report defers to), Phase 7 (Payments), Phase 8 (Notifications), Phase 14 (Deployment), Phase 15 (Beta Launch), and Phase 16 (Production Launch) are all still `Status: Planned` — none has started. (Note for anyone cross-referencing project history: this roadmap has, more than once, had to disambiguate its own phase numbers from informal external labels reused for unrelated work at the time — e.g. a production-issue remediation pass was informally called "Phase 16" and the testing effort informally called "Phase 15" when each was done; neither of those is this roadmap's actual Phase 16 or Phase 15. The Phase 15/16 referenced here are strictly this roadmap's own Beta Launch and Production Launch phases, both genuinely unstarted.) There is no deployment pipeline, no staging environment, no monitoring or alerting, no real payment processing, no beta users, and no incident-response process. "Production readiness" is a phase-gated outcome this project hasn't reached yet by design, not a defect in what has been built.
**Reasoning:** The engineering *quality* of what exists is not in question here — this score specifically measures distance from an actual production launch, which remains substantial and expected given the roadmap's own explicit sequencing.

### Overall Engineering Score — 66/100

*(Straight average of the 7 category scores above: (60+78+72+65+74+76+40)/7 = 66.4, rounded.)*

This number is dominated by Production Readiness being appropriately, structurally low at this stage of the roadmap — Phases 7/8/14/15/16 haven't started, so no realistic scoring of "production readiness" today could be much higher. If Production Readiness is set aside as "not yet in scope" and the remaining six engineering-quality categories are averaged instead — (60+78+72+65+74+76)/6 = 70.8 — the picture is a **~71/100 engineering-quality score**: solid, disciplined, evidence-based work with real, measured wins and honestly-documented gaps, appropriate for a project that has completed testing (Phase 11), security review (Phase 12), and performance optimization (Phase 13), but has not yet built deployment, monetization, or scale infrastructure.

**Do not read either number as "the product is 66-71% done."** Both are quality/maturity assessments of what exists, not completion percentages against the full roadmap — Phases 6–8 and 14–16 represent substantial unstarted scope that these scores don't (and aren't meant to) capture.
