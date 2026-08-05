#!/usr/bin/env node
// Bundle-budget verification (Phase 13 Step 6: performance measurement and
// CI budgets). Run this AFTER `npm run build` -- it reads the real dist/
// output on disk, never a network request, never a bundler API, so it's
// deterministic given a fixed dist/.
//
// ---- Eager vs. lazy ----------------------------------------------------
// dist/index.html is the definitive signal for what's actually eager-
// loaded (same principle established in the Phase 13 Step 1 report: chunk
// separation alone doesn't tell you what a fresh page load actually
// fetches). Eager assets are exactly:
//   - every <script type="module" src="..."> in index.html (the real
//     entry chunk)
//   - every <link rel="modulepreload" href="..."> in index.html (Vite
//     emits these for chunks the entry needs immediately; the browser
//     fetches them eagerly, in parallel with the entry script)
//   - every <link rel="stylesheet" href="..."> in index.html
// Every other .js/.css file physically present in dist/assets/ is a lazy
// chunk: fetched later, on demand, via a dynamic import() (route-level
// code splitting from Step 1) or as a dependency of one.
//
// ---- mapbox-gl -----------------------------------------------------------
// mapbox-gl is never referenced by index.html (the map only loads inside
// the lazy-loaded Route Planner page), so it's already excluded from every
// "eager" figure by the classification above. It's ALSO deliberately
// excluded from "largest lazy route chunk" and reported on its own
// report-only line instead, never gated by a pass/fail budget -- a single
// large mapping library chunk that only downloads when a professional
// opens the Route Planner is a fundamentally different cost than initial-
// load or common-route weight, and holding it to the same budget would
// either be meaningless (a budget so high it catches nothing else) or
// force gutting a feature that has nothing to do with initial load. See
// docs/performance/PHASE_13_BUNDLE_BASELINE.md for the full rationale.
//
// ---- No new dependency for gzip -----------------------------------------
// Node's built-in zlib.gzipSync computes the exact same gzip a static file
// server would produce for these already-compressible text assets, so no
// third-party gzip-size package was added for this.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";

export const ASSETS_DIR = "assets";

// ---- Budgets --------------------------------------------------------------
// Every number below is derived from the real measured post-Step-5 build
// (see docs/performance/PHASE_13_BUNDLE_BASELINE.md for the exact
// baseline table), with a small documented margin -- never a round number
// picked without measuring first, and never so tight that an unrelated,
// harmless change (a new icon, a translated string) trips it.
//
// Metric choice: the two AGGREGATE "initial payload" budgets (eager JS,
// eager CSS, and their total) are measured in gzip bytes, because gzip is
// what actually crosses the network on a fresh page load and is the
// figure that maps onto load-time budgets like LCP. The two SINGLE-CHUNK
// budgets (largest eager JS chunk, largest lazy route chunk) are measured
// in RAW bytes instead, because a single chunk's PARSE/COMPILE cost on the
// main thread scales with its uncompressed size, not its wire size -- and
// an oversized single chunk is exactly the "one giant file" regression
// this budget exists to catch early, independent of how well it happens
// to gzip.
// All "measured baseline" figures below are this script's own binary-KB
// (KiB, 1024 bytes) output against the real post-Step-5 build -- NOT
// Vite's own build-log numbers, which report decimal kB (1000 bytes) and
// so read a little higher for the same bytes. See
// docs/performance/PHASE_13_BUNDLE_BASELINE.md for the full measured
// table and unit note.
export const DEFAULT_BUDGETS = {
  // Measured baseline: 129.27 KB. ~16% margin.
  eagerJsGzipBytes: 150 * 1024,
  // Measured baseline: 8.40 KB. ~43% margin -- CSS is small and noisy
  // relative to its own size (one new utility class can move it a
  // noticeable percentage), so the margin is wider in relative terms
  // while staying small in absolute terms.
  eagerCssGzipBytes: 12 * 1024,
  // Measured baseline: 137.67 KB combined. ~20% margin.
  totalEagerGzipBytes: 165 * 1024,
  // Measured baseline: 447.43 KB (the single entry chunk -- vendor
  // libraries + app shell, not yet split further). This deliberately
  // deviates from Phase 13 Step 6's originally suggested 300 KB starting
  // point: 300 KB would fail against the CURRENT, already-measured
  // baseline, which would violate the explicit "include a small
  // documented margin above the current baseline" requirement for this
  // same budget. 500 KB gives a real, small (~12%) margin above what's
  // actually on disk today. See the baseline doc for the full note.
  largestEagerJsChunkRawBytes: 500 * 1024,
  // Measured baseline: 342.25 KB (BusinessEngine, the largest lazy
  // route -- the Business/owner dashboard bundle, including chart
  // rendering). ~17% margin.
  largestLazyRouteChunkRawBytes: 400 * 1024,
};

// mapbox-gl is report-only by design (see the module comment above) -- no
// budget field for it exists, and evaluateBudgets() never fails on it.

// ---- HTML parsing (regex, not a DOM parser -- index.html is small,
// generated, and has a fixed, simple shape; adding an HTML-parsing
// dependency for 3 tag types would be disproportionate) --------------------

function extractAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`));
  return match ? match[1] : null;
}

function toAssetRelativePath(href) {
  // index.html hrefs/srcs are root-relative ("/assets/xyz.js"); dist/ IS
  // that root, so strip the leading slash to get a dist-relative path.
  return href.replace(/^\//, "");
}

// Returns { jsPaths: string[], cssPaths: string[] } of dist-relative paths
// (e.g. "assets/index-XXXX.js") for everything index.html eagerly
// requests: <script type="module">, <link rel="modulepreload">, and
// <link rel="stylesheet">.
export function parseEagerAssetPaths(html) {
  const jsPaths = new Set();
  const cssPaths = new Set();

  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/type=["']module["']/.test(tag)) continue;
    const src = extractAttr(tag, "src");
    if (src) jsPaths.add(toAssetRelativePath(src));
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = extractAttr(tag, "rel");
    const href = extractAttr(tag, "href");
    if (!href) continue;
    if (rel === "modulepreload") jsPaths.add(toAssetRelativePath(href));
    else if (rel === "stylesheet") cssPaths.add(toAssetRelativePath(href));
  }

  return { jsPaths: [...jsPaths], cssPaths: [...cssPaths] };
}

// ---- Filesystem measurement ------------------------------------------------

export function rawSize(filePath) {
  return statSync(filePath).size;
}

export function gzipSize(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

export function isMapboxChunk(filename) {
  return /^mapbox-gl-/.test(filename);
}

// Lists every .js/.css file directly inside distDir/assets (Vite's flat
// output layout -- no nested subdirectories to recurse into).
export function listChunkFiles(distDir) {
  const assetsDir = join(distDir, ASSETS_DIR);
  if (!existsSync(assetsDir)) {
    throw new Error(`Missing ${join(distDir, ASSETS_DIR)} -- run \`npm run build\` first.`);
  }
  return readdirSync(assetsDir).filter((f) => f.endsWith(".js") || f.endsWith(".css"));
}

// The full measurement pass: reads dist/index.html plus every chunk file
// on disk, classifies each as eager/lazy/mapbox-gl, and returns raw
// byte-level metrics. Throws a clear, specific error (never a raw ENOENT)
// if dist/index.html is missing or if index.html references an asset that
// doesn't actually exist on disk -- a stale/corrupt build should fail
// loudly here, not silently under-count.
export function computeMetrics(distDir) {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`Missing ${indexPath} -- run \`npm run build\` first.`);
  }
  const html = readFileSync(indexPath, "utf-8");
  const { jsPaths: eagerJsPaths, cssPaths: eagerCssPaths } = parseEagerAssetPaths(html);

  for (const relPath of [...eagerJsPaths, ...eagerCssPaths]) {
    const fullPath = join(distDir, relPath);
    if (!existsSync(fullPath)) {
      throw new Error(
        `index.html references ${relPath}, which does not exist in ${distDir} -- the build output looks incomplete or stale. Re-run \`npm run build\`.`
      );
    }
  }

  const allChunkFiles = listChunkFiles(distDir);
  const eagerJsSet = new Set(eagerJsPaths.map((p) => basename(p)));
  const eagerCssSet = new Set(eagerCssPaths.map((p) => basename(p)));

  const eagerJsRawBytes = eagerJsPaths.reduce((sum, p) => sum + rawSize(join(distDir, p)), 0);
  const eagerJsGzipBytes = eagerJsPaths.reduce((sum, p) => sum + gzipSize(join(distDir, p)), 0);
  const eagerCssRawBytes = eagerCssPaths.reduce((sum, p) => sum + rawSize(join(distDir, p)), 0);
  const eagerCssGzipBytes = eagerCssPaths.reduce((sum, p) => sum + gzipSize(join(distDir, p)), 0);

  let largestEagerJsChunk = null;
  for (const p of eagerJsPaths) {
    const raw = rawSize(join(distDir, p));
    if (!largestEagerJsChunk || raw > largestEagerJsChunk.rawBytes) {
      largestEagerJsChunk = { file: basename(p), rawBytes: raw };
    }
  }

  let mapboxGl = null;
  let largestLazyRouteChunk = null;
  for (const file of allChunkFiles) {
    if (!file.endsWith(".js")) continue; // "route chunk" -- JS only, CSS chunks aren't routes
    if (eagerJsSet.has(file)) continue; // already counted as eager, never double-counted as lazy
    const fullPath = join(distDir, ASSETS_DIR, file);
    const raw = rawSize(fullPath);

    if (isMapboxChunk(file)) {
      const gzip = gzipSize(fullPath);
      if (!mapboxGl || raw > mapboxGl.rawBytes) mapboxGl = { file, rawBytes: raw, gzipBytes: gzip };
      continue; // never enters the lazy-route-chunk comparison -- see module comment
    }

    if (!largestLazyRouteChunk || raw > largestLazyRouteChunk.rawBytes) {
      const gzip = gzipSize(fullPath);
      largestLazyRouteChunk = { file, rawBytes: raw, gzipBytes: gzip };
    }
  }

  // eagerCssSet is unused past classification (no lazy-CSS budget exists
  // yet), but is kept for symmetry / future use and to document that CSS
  // chunks are excluded from the lazy-route-chunk scan above by the
  // `.endsWith(".js")` guard, not by accident.
  void eagerCssSet;

  return {
    eagerJsRawBytes,
    eagerJsGzipBytes,
    eagerCssRawBytes,
    eagerCssGzipBytes,
    totalEagerGzipBytes: eagerJsGzipBytes + eagerCssGzipBytes,
    largestEagerJsChunk,
    largestLazyRouteChunk,
    mapboxGl,
    totalChunks: allChunkFiles.length,
  };
}

// ---- Budget evaluation ------------------------------------------------------

export function evaluateBudgets(metrics, budgets = DEFAULT_BUDGETS) {
  const failures = [];

  function check(label, actual, limit, format) {
    if (actual > limit) {
      failures.push(`${label}: ${format(actual)} exceeds budget of ${format(limit)}`);
    }
  }

  const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

  check("Initial eager JS (gzip)", metrics.eagerJsGzipBytes, budgets.eagerJsGzipBytes, kb);
  check("Initial eager CSS (gzip)", metrics.eagerCssGzipBytes, budgets.eagerCssGzipBytes, kb);
  check("Total initial eager JS+CSS (gzip)", metrics.totalEagerGzipBytes, budgets.totalEagerGzipBytes, kb);
  if (metrics.largestEagerJsChunk) {
    check(
      `Largest eager JS chunk (raw, ${metrics.largestEagerJsChunk.file})`,
      metrics.largestEagerJsChunk.rawBytes,
      budgets.largestEagerJsChunkRawBytes,
      kb
    );
  }
  if (metrics.largestLazyRouteChunk) {
    check(
      `Largest lazy route chunk (raw, ${metrics.largestLazyRouteChunk.file})`,
      metrics.largestLazyRouteChunk.rawBytes,
      budgets.largestLazyRouteChunkRawBytes,
      kb
    );
  }
  // mapbox-gl is intentionally never checked here -- report-only, see the
  // module comment.

  return { passed: failures.length === 0, failures };
}

// ---- Reporting ---------------------------------------------------------
// Prints only sizes, filenames, and pass/fail status -- no file contents,
// no paths outside dist/, no environment values, so there's nothing here
// that could leak a secret even by accident.

export function formatReport(metrics, budgets, evaluation) {
  const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
  const lines = [];
  lines.push("Bundle budget report");
  lines.push("---------------------");
  lines.push(`Initial eager JS:  ${kb(metrics.eagerJsRawBytes)} raw / ${kb(metrics.eagerJsGzipBytes)} gzip (budget: ${kb(budgets.eagerJsGzipBytes)} gzip)`);
  lines.push(`Initial eager CSS: ${kb(metrics.eagerCssRawBytes)} raw / ${kb(metrics.eagerCssGzipBytes)} gzip (budget: ${kb(budgets.eagerCssGzipBytes)} gzip)`);
  lines.push(`Total initial eager JS+CSS (gzip): ${kb(metrics.totalEagerGzipBytes)} (budget: ${kb(budgets.totalEagerGzipBytes)})`);
  lines.push(
    metrics.largestEagerJsChunk
      ? `Largest eager JS chunk: ${metrics.largestEagerJsChunk.file} -- ${kb(metrics.largestEagerJsChunk.rawBytes)} raw (budget: ${kb(budgets.largestEagerJsChunkRawBytes)})`
      : "Largest eager JS chunk: (none found)"
  );
  lines.push(
    metrics.largestLazyRouteChunk
      ? `Largest lazy route chunk: ${metrics.largestLazyRouteChunk.file} -- ${kb(metrics.largestLazyRouteChunk.rawBytes)} raw / ${kb(metrics.largestLazyRouteChunk.gzipBytes)} gzip (budget: ${kb(budgets.largestLazyRouteChunkRawBytes)} raw)`
      : "Largest lazy route chunk: (none found)"
  );
  lines.push(
    metrics.mapboxGl
      ? `mapbox-gl chunk (report only, not budgeted): ${metrics.mapboxGl.file} -- ${kb(metrics.mapboxGl.rawBytes)} raw / ${kb(metrics.mapboxGl.gzipBytes)} gzip`
      : "mapbox-gl chunk: (not found in this build)"
  );
  lines.push(`Total generated chunks (JS+CSS): ${metrics.totalChunks}`);
  lines.push("");
  if (evaluation.passed) {
    lines.push("PASS -- all bundle budgets satisfied.");
  } else {
    lines.push(`FAIL -- ${evaluation.failures.length} budget(s) exceeded:`);
    for (const f of evaluation.failures) lines.push(`  - ${f}`);
  }
  return lines.join("\n");
}

// ---- CLI entry point ---------------------------------------------------

function isMainModule() {
  // pathToFileURL correctly handles platform differences (e.g. Windows
  // drive letters need an extra leading slash: "file:///C:/...") that a
  // manual string template would get wrong.
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function main() {
  const distDir = process.argv[2] ?? "dist";
  let metrics;
  try {
    metrics = computeMetrics(distDir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const evaluation = evaluateBudgets(metrics, DEFAULT_BUDGETS);
  console.log(formatReport(metrics, DEFAULT_BUDGETS, evaluation));
  if (!evaluation.passed) process.exit(1);
}

if (isMainModule()) {
  main();
}
