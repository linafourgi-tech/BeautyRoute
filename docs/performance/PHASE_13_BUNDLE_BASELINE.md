# Phase 13 Bundle Baseline & CI Budgets

**Step:** Phase 13 (Performance Optimization) — Step 6: performance measurement and CI budgets
**Scope of this document:** what the production bundle actually weighs today, how that compares to before Phase 13 started, and the rationale behind the CI budgets enforced by `scripts/bundle-budget.mjs`. This is a measurement and enforcement step only — no application behavior changed to produce these numbers.

## How these numbers were produced

Every table below comes from the **same** tool: `node scripts/bundle-budget.mjs <dist-dir>`, run against a real `npm run build` output at three points in this repo's history:

| Baseline | Commit | What it represents |
|---|---|---|
| Pre-Phase-13 | `edb9811` | The last commit before any Phase 13 work — Phase 12's final security review commit. No route-level code splitting yet. |
| Post-Step-1 | `a931c18` | Merge commit for Step 1 (route-level code splitting via `React.lazy`/`Suspense`). |
| Post-Step-5 (current) | `c74bd53` | Merge commit for Step 5 (Route Planner geocoding parallelization) — the state of `main` immediately before this step. |

Each was measured by checking out the commit, running a clean `npm run build` (`package.json`/`package-lock.json` are byte-identical across all three commits, so no dependency changes could explain any difference), and running the budget script against the resulting `dist/`.

**Unit note:** all sizes below are **KB = 1024 bytes (KiB)**, computed by this repo's own script (Node's `zlib.gzipSync`, default compression level). Vite's own build-log output reports **decimal kB (1000 bytes)** using a different internal gzip implementation/level, so its printed numbers will not match these exactly even for the identical file — this is expected, not a bug. Don't mix the two; use this script's numbers for anything budget-related, since that's what actually gets enforced.

## Baseline table

| Metric | Pre-Phase-13 | Post-Step-1 | Post-Step-5 (current) | Change (pre → current) |
|---|---:|---:|---:|---:|
| Initial eager JS (gzip) | 260.85 KB | 130.13 KB | **129.27 KB** | **−50.4%** |
| Initial eager CSS (gzip) | 13.67 KB | 8.55 KB | **8.40 KB** | **−38.6%** |
| Total initial eager JS+CSS (gzip) | 274.52 KB | 138.68 KB | **137.67 KB** | **−49.9%** |
| Largest eager JS chunk (raw) | 925.57 KB | 245.67 KB | **447.43 KB** | −51.7% (see note below) |
| Largest lazy route chunk (raw / gzip) | n/a (no lazy chunks existed) | 342.25 KB / 98.45 KB | 342.25 KB / 98.45 KB | — |
| mapbox-gl chunk (raw / gzip, report-only) | 1782.55 KB / 485.37 KB | 1782.56 KB / 485.37 KB | 1782.56 KB / 485.37 KB | unchanged (expected — see below) |
| Total generated chunks (JS+CSS) | 3 | 48 | 45 | +42 (intentional — route-level splitting) |

## What's eager vs. lazy

`dist/index.html` is the definitive signal for what a fresh page load actually fetches — not chunk-file separation alone (a file can exist as its own chunk and still be eagerly `modulepreload`ed). Concretely, **eager** means:

- every `<script type="module" src="...">` in `index.html` (the real entry chunk)
- every `<link rel="modulepreload" href="...">` in `index.html` (chunks Vite knows the entry needs immediately; the browser fetches these in parallel with the entry script, not on demand)
- every `<link rel="stylesheet" href="...">` in `index.html`

Everything else physically present in `dist/assets/` is **lazy**: fetched only when a `React.lazy()`-wrapped route (or one of its own dependencies) is actually navigated to, per Phase 13 Step 1.

## Why the largest-eager-chunk number went *up* between Step 1 and Step 5, not down

This is a real, measured shift worth calling out explicitly rather than glossing over: Step 1 alone produced two separate eager chunks (`index-*.js` at 245.67 KB raw, plus a `styles-*.js` chunk Vite split out for shared dependency code, at roughly 200 KB raw) that were both `modulepreload`ed together. By Step 5, Vite's own automatic chunking had merged that shared-dependency code back into a single, larger `index-*.js` entry chunk (447.43 KB raw) as the module graph changed across Steps 2–5 (new shared contexts, consolidated service query surfaces). The **aggregate** eager gzip payload barely moved (130.13 → 129.27 KB, effectively flat) because it's the same bytes, just redistributed across a different number of chunks — but the **single largest chunk** metric genuinely grew, which is exactly the kind of change a single-largest-chunk budget exists to catch.

This step (Step 6) is measurement and enforcement only — it does not attempt to re-split that chunk. The `largestEagerJsChunkRawBytes` budget is set from this real, current number (see below), not from an earlier, smaller one that no longer reflects the actual build. Splitting the entry chunk further is a legitimate candidate for a future Phase 13 step, informed by this exact finding.

## mapbox-gl: unchanged across every measurement, and by design

`mapbox-gl` has never been part of the eager payload at any of the three baselines above — it was already dynamically imported inside the Route Planner page before Phase 13 started (a separate optimization from the route-level page splitting Step 1 added). It's excluded from every "eager" figure by the classification rule above, and is **additionally** excluded from the "largest lazy route chunk" figure and from every pass/fail budget, reported on its own line instead. A single mapping-library chunk that only downloads when a professional actually opens the Route Planner is a fundamentally different cost than initial-load or common-route weight; holding it to the same budget as a route chunk would either be a budget so high it catches nothing else, or force gutting a real feature that has nothing to do with initial load.

## CI budgets and their rationale

All budgets live in `scripts/bundle-budget.mjs`'s `DEFAULT_BUDGETS` and are enforced in CI (`npm run perf:bundle-budget`, run immediately after `npm run build` in the "Frontend quality" job) — see that file's own comments for the authoritative, line-by-line rationale. Summary:

| Budget | Limit | Current (post-Step-5) | Margin |
|---|---:|---:|---:|
| Initial eager JS (gzip) | 150 KB | 129.27 KB | ~16% |
| Initial eager CSS (gzip) | 12 KB | 8.40 KB | ~43% |
| Total initial eager JS+CSS (gzip) | 165 KB | 137.67 KB | ~20% |
| Largest eager JS chunk (raw) | 500 KB | 447.43 KB | ~12% |
| Largest lazy route chunk (raw) | 400 KB | 342.25 KB | ~17% |
| mapbox-gl chunk | — (report only, never fails) | 1782.56 KB raw / 485.37 KB gzip | n/a |

**Metric choice:** the three aggregate "initial payload" budgets are measured in **gzip** bytes, because gzip is what actually crosses the network on a fresh page load — the figure that maps onto load-time budgets like LCP. The two single-chunk budgets (largest eager chunk, largest lazy route chunk) are measured in **raw** bytes instead, because a single chunk's parse/compile cost on the main thread scales with its uncompressed size, not its wire size — and "one chunk got way bigger" is exactly the regression these two budgets exist to catch, independent of how well that chunk happens to compress.

**A deliberate deviation from this step's originally suggested starting budget:** the largest-eager-JS-chunk budget was suggested at ≤300 KB raw as a starting point. The current, real, measured baseline is 447.43 KB raw (see the section above for why) — a 300 KB budget would fail against the very baseline it's supposed to be measured from, which would violate this step's own explicit requirement that budgets "include a small documented margin above the current baseline." 500 KB was chosen instead: a real, small (~12%) margin above what's actually on disk today. Every other suggested starting budget in this step's requirements held up against the real measurements without needing adjustment.

**Every budget number is small and conservative on purpose:** these are meant to fail CI on a real regression (a new heavy dependency added to the eager path, an accidentally-un-lazy import, a route chunk that grows 3x), not to fail on routine, harmless changes like a new icon, a translated string, or a minor dependency patch bump. All margins above were re-verified against a real, fresh `npm run build` (not estimated).

## Web Vitals targets — documented, not yet enforced

These are the standard [Core Web Vitals](https://web.dev/articles/vitals) "good" thresholds, recorded here as the targets this project should measure against once it has a real production deployment:

| Metric | Target | What it measures |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | Time until the largest visible content element renders |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | Visual stability — how much content unexpectedly shifts during load |
| INP (Interaction to Next Paint) | ≤ 200ms | Responsiveness to user interaction, replacing First Input Delay as of 2024 |

**Why these aren't enforced in CI yet:** all three require real network conditions, real device performance, and a real, stable production domain to measure meaningfully (via Lighthouse CI, a Real User Monitoring integration, or Chrome UX Report data) — a CI runner building against `localhost` or a throwaway preview URL produces numbers that don't reflect what an actual professional on an actual phone experiences, and would either give false confidence or fail on noise unrelated to any real regression. Per this step's explicit scope, no Lighthouse run against a fake/placeholder production URL was added. Bundle-size budgets (enforced above) are the leading indicator available today; Web Vitals enforcement is a natural follow-up once this project has a real hosting/deployment target.

## Known limitations

- **Gzip figures are this script's own, not Vite's build-log figures.** Different gzip implementations/compression levels produce slightly different byte counts for the same file (see the unit note above). This script's numbers are internally consistent with each other (same tool, same settings, every time), which is what matters for both trend comparison and CI enforcement — but they should not be quoted interchangeably with Vite's own console output.
- **Bundle size is a proxy, not a direct latency measurement.** Smaller bundles generally load and parse faster, but actual load time also depends on network conditions, cache state, device CPU, and HTTP/2+ multiplexing behavior that a static byte-count can't capture — hence the separate, not-yet-enforced Web Vitals section above.
- **The largest-eager-chunk budget doesn't diagnose *why* a chunk grew**, only *that* it did — a future regression would still need a manual bundle-analyzer pass (e.g. `rollup-plugin-visualizer`, not added here to avoid an unrequested new dependency) to pinpoint the cause.
- **No historical trend storage.** Each CI run measures the current build in isolation and compares it against the fixed budgets in this file/script — it doesn't track size over time across commits. This document's three-point baseline table is a manually-gathered snapshot, not an automated trend.
- **`totalChunks` is report-only.** A rising chunk count isn't inherently good or bad (more chunks can mean better caching granularity, or excessive fragmentation) — there's no evidence-based single number to gate it on yet, so it's measured and printed but never fails CI.
