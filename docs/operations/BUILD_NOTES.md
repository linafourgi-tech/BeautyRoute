# Build Notes

**Document type:** Operational notes on the current production build. Records
what the build actually outputs today and why. This is a current-state
snapshot, not the detailed performance record — for the full before/after
measurement, rationale, and CI budget derivation, see
[`docs/performance/PHASE_13_FINAL_REPORT.md`](../performance/PHASE_13_FINAL_REPORT.md)
and
[`docs/performance/PHASE_13_BUNDLE_BASELINE.md`](../performance/PHASE_13_BUNDLE_BASELINE.md).
This document previously described the **pre-Phase-13** build (a single
eagerly-loaded ~940 KB/268 KB-gzip main bundle, no code splitting); Phase 13
(route-level code splitting plus four other optimization steps) is complete
and merged to `main`, and the numbers below reflect that.

## 1. Current production build status

`npm run build` (`vite build`) currently **succeeds**. Verified against a
fresh build on 2026-08-06:

```text
dist/index.html                          0.54 kB │ gzip:   0.32 kB
dist/assets/index-*.css                 43.09 kB │ gzip:   8.76 kB
dist/assets/index-*.js                 458.17 kB │ gzip: 132.55 kB
dist/assets/BusinessEngine-*.js        352.86 kB │ gzip: 102.62 kB
dist/assets/mapbox-gl-*.js           1,825.34 kB │ gzip: 501.20 kB
(+ 40 further per-route/vendor chunks, 45 total)
```

(Hashes in filenames change per build; sizes are representative of the
current state and will drift slightly as the app grows — this is a snapshot,
not a pinned budget. The pinned budget is `scripts/bundle-budget.mjs`,
enforced in CI — see Section 6.)

Every page in `src/App.jsx` is loaded via `React.lazy()` behind a shared
`Suspense` boundary, so `index-*.js` above is the app shell (React, React
Router, the Supabase client, shared contexts, and other always-needed code)
rather than every page. `BusinessEngine-*.js` is the largest individual
lazy route chunk, fetched only when a user navigates to `/business`.

## 2–4. Current bundle-size warnings

Vite's build reporter emits an advisory warning because one chunk exceeds
its default 500 kB (minified) threshold:

- **Mapbox GL bundle** (`dist/assets/mapbox-gl-*.js`, ~1.8 MB / ~501 kB
  gzipped) — the `mapbox-gl` library itself. It is dynamically imported by
  `src/components/RouteMap.jsx`, and `RouteEngine` (the only page that
  renders `RouteMap`) is itself `React.lazy()`-loaded, so this chunk is only
  fetched when a user actually navigates to `/route` — never on initial page
  load, and never alongside the rest of the app. The library itself is
  simply large; splitting it into its own chunk doesn't shrink it, it only
  controls *when* it's fetched.

The main application bundle (`dist/assets/index-*.js`, ~458 kB / ~133 kB
gzipped) is now **under** the 500 kB warning threshold and does not trigger
this warning — a change from the pre-Phase-13 state this document previously
described, where the (then-unsplit) main bundle was the second chunk
tripping the same warning.

## 5. Why these are warnings, not build failures

Vite's chunk-size check is an advisory heuristic, not a correctness check.
The build completes successfully, produces valid output, and the
application runs correctly — the warning exists to flag chunks that may
affect initial page-load performance for users on slower connections, not
to indicate broken or invalid code. No functionality is degraded by the
current bundle sizes.

## 6. Optimization status

Phase 13 (Performance Optimization) is **complete** — see
[`PHASE_13_FINAL_REPORT.md`](../performance/PHASE_13_FINAL_REPORT.md) for
the full seven-step record. What's relevant to this build:

- **Route-level lazy loading — done.** Every page in `src/App.jsx` is
  `React.lazy()`'d behind one shared `Suspense` boundary, so page code
  ships only to users who visit that route.
- **Dynamic import for the map library — done.** `mapbox-gl` is loaded via
  a dynamic `import()` inside `RouteMap.jsx`, and (per Section 2–4 above)
  is now only fetched on actual navigation to `/route`, not on app load.
- **CI-enforced bundle budgets — done.** `scripts/bundle-budget.mjs` runs
  after every build (`npm run perf:bundle-budget`, wired into CI) and fails
  the build if any of 5 measured budgets is exceeded. Verified passing
  against today's build: all 5 budgets pass with real margin. See
  `PHASE_13_BUNDLE_BASELINE.md` for the exact budgets and rationale.
- **Not yet done — general code splitting beyond routes.** No manual chunk
  boundaries (`build.rollupOptions.output.manualChunks` or equivalent) have
  been configured beyond what route-level splitting and Vite's own
  automatic chunking already produce.
- **Not yet done — bundle-composition analysis.** No dependency-by-
  dependency breakdown (e.g. `rollup-plugin-visualizer`) has been run
  against the ~458 kB main chunk to identify further splitting
  opportunities; this is tracked as remaining technical debt in the Phase
  13 final report.

## 7. Mapbox licensing / commercial cost awareness

Mapbox GL JS has been under a proprietary license since v2 (this repo uses
`mapbox-gl` `^3.27.0`), and Mapbox's map-load, geocoding, matrix, and
directions APIs are billed on usage-based account terms. This is not a
defect in the current implementation, but it is an ongoing commercial
dependency that needs active tracking as the project moves toward
production traffic — both the client-side map-render volume and the
server-side geocoding/matrix/directions call volume (from
`supabase/functions/route-planner/index.ts`) contribute to billed usage.
See the Risks section of `docs/PROJECT_ROADMAP.md` for how this is tracked
at the project level.

## 8. Localhost Mapbox CORS behavior

In local development, the map's *tiles* may fail to load with a CORS error
in the browser console. This is **expected, not a bug**: the Mapbox public
token (`VITE_MAPBOX_PUBLIC_TOKEN`) is deliberately domain-restricted in the
Mapbox account to the production domain(s), and `localhost` is intentionally
not on that allowlist. The map object itself still initializes correctly
(canvas and attribution render); only the tile fetch is blocked. All routing
logic — geocoding, matrix, directions, and route optimization — runs
server-side in the `route-planner` Edge Function and is unaffected by this;
it was verified independently of tile rendering (see
`docs/verification/PHASE_12_LIVE_VERIFICATION_REPORT.md`).

## 9. Status

**Phase 13 performance optimization is complete** (route-level code
splitting, shared session context, bounded queries, geocoding
parallelization, and CI-enforced bundle budgets — see
`docs/performance/PHASE_13_FINAL_REPORT.md`). This document reflects the
build as it stands after that work, verified against a real build on
2026-08-06. Remaining, explicitly-deferred bundle work is limited to the two
items in Section 6 (general code splitting beyond routes, and a
bundle-composition analysis) — both tracked as technical debt in the Phase
13 final report, not implemented here.
