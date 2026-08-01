# Build Notes

**Document type:** Operational notes on the current production build. Records
what the build actually outputs today and why, and what optimization work is
explicitly deferred. This is not a performance audit or a completed
optimization report — no optimization work described below has been done yet.

## 1. Current production build status

`npm run build` (`vite build`) currently **succeeds**. As of this writing:

```text
dist/index.html                        0.46 kB │ gzip:   0.29 kB
dist/assets/index-*.css               87.49 kB │ gzip:  14.53 kB
dist/assets/index-*.js               939.65 kB │ gzip: 267.58 kB
dist/assets/mapbox-gl-*.js         1,825.33 kB │ gzip: 501.20 kB
```

(Hashes in filenames change per build; sizes are representative of the
current state and will drift slightly as the app grows — this is a snapshot,
not a pinned budget.)

## 2–4. Current bundle-size warnings

Vite's build reporter emits an advisory warning because two chunks exceed
its default 500 kB (minified) threshold:

- **Main application bundle** (`dist/assets/index-*.js`, ~940 kB / ~268 kB
  gzipped) — contains all page/route code and app-level dependencies
  (React, React Router, Recharts, the Supabase client, etc.), because every
  page is currently statically imported into `src/App.jsx` (see Section 6).
- **Mapbox GL bundle** (`dist/assets/mapbox-gl-*.js`, ~1.8 MB / ~501 kB
  gzipped) — the `mapbox-gl` library itself. It is already split into its
  own chunk (see Section 6) because `src/components/RouteMap.jsx` loads it
  via a dynamic `import("mapbox-gl")` rather than a static import — but the
  library itself is simply large; splitting it into its own chunk doesn't
  shrink it, it only means it's fetched separately from (and, per Section 6,
  currently still alongside) the rest of the app.

## 5. Why these are warnings, not build failures

Vite's chunk-size check is an advisory heuristic, not a correctness check.
The build completes successfully, produces valid output, and the
application runs correctly — the warning exists to flag chunks that may
affect initial page-load performance for users on slower connections, not
to indicate broken or invalid code. No functionality is degraded by the
current bundle sizes.

## 6. Deferred optimization ideas (none implemented yet)

The following are documented as **candidate future work only**. None of
them has been implemented as of this commit:

- **Route-level lazy loading.** `src/App.jsx` currently imports every page
  component statically (no `React.lazy`/`Suspense` anywhere in the
  codebase), so all page code ships in the single main bundle regardless of
  which route a user visits. Converting page imports to `React.lazy()` would
  let each route's code load on demand instead.
- **Dynamic imports for map components.** `mapbox-gl` (the library) is
  already loaded via a dynamic `import()` inside `RouteMap.jsx`, so it's
  already split into its own chunk. What is *not* yet dynamic is the
  `RouteMap` component and the `RouteEngine` page themselves — both are
  statically imported into the main bundle today, so the `mapbox-gl` chunk
  is fetched as soon as the app loads a route that references `RouteEngine`,
  not only when a user actually navigates to `/route`. Combining this with
  route-level lazy loading above would defer both.
- **General code splitting.** Beyond the map, no other manual or automatic
  chunk boundaries have been configured (e.g. via
  `build.rollupOptions.output.manualChunks` or Rolldown's chunking options).
- **Bundle analysis.** No bundle-composition analysis (e.g.
  `rollup-plugin-visualizer` or equivalent) has been run against this
  codebase; the breakdown above is limited to what Vite's default build
  output reports, not a full dependency-by-dependency size audit.

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

**No performance optimization has been implemented yet.** Everything in
Section 6 is a documented idea for future work, not a completed or
in-progress change. This document records the current, honest state of the
build — not a plan commitment or a timeline.
