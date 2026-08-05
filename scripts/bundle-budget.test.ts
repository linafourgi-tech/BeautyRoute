import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeMetrics,
  evaluateBudgets,
  formatReport,
  parseEagerAssetPaths,
  gzipSize,
  isMapboxChunk,
  DEFAULT_BUDGETS,
} from "./bundle-budget.mjs";

// This script reads real files from disk by design (it verifies the real
// dist/ output, not an in-memory bundler API) -- so these tests build a
// small, real fixture dist/ per test in a temp directory rather than
// mocking fs. Each fixture mirrors Vite's actual output shape: index.html
// at the dist root, everything else flat under dist/assets/.

let dir: string;

function writeAsset(relPath: string, sizeBytes: number, seed = "x") {
  // Deterministic, non-empty content of an exact byte length -- content
  // doesn't need to be valid JS/CSS, only a real, measurable, gzip-able
  // byte sequence, since the script only ever measures/classifies files,
  // it never parses or executes them.
  const content = seed.repeat(Math.max(1, sizeBytes));
  writeFileSync(join(dir, relPath), content.slice(0, sizeBytes));
}

function writeIndexHtml(html: string) {
  writeFileSync(join(dir, "index.html"), html);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bundle-budget-test-"));
  mkdirSync(join(dir, "assets"), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("parseEagerAssetPaths", () => {
  it("extracts the entry <script type=module>, <link rel=modulepreload>, and <link rel=stylesheet> -- nothing else", () => {
    const html = `<!doctype html><html><head>
      <link rel="icon" href="/favicon.svg" />
      <script type="module" crossorigin src="/assets/index-ABC.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/preload-helper-XYZ.js">
      <link rel="stylesheet" crossorigin href="/assets/index-DEF.css">
    </head><body></body></html>`;
    const { jsPaths, cssPaths } = parseEagerAssetPaths(html);
    expect(jsPaths.sort()).toEqual(["assets/index-ABC.js", "assets/preload-helper-XYZ.js"]);
    expect(cssPaths).toEqual(["assets/index-DEF.css"]);
  });

  it("returns empty arrays when index.html has no module script, preload, or stylesheet tags", () => {
    const { jsPaths, cssPaths } = parseEagerAssetPaths(`<html><head><link rel="icon" href="/favicon.svg" /></head></html>`);
    expect(jsPaths).toEqual([]);
    expect(cssPaths).toEqual([]);
  });

  it("ignores a non-module script tag (e.g. a classic/inline script) as not eager-bundle JS", () => {
    const html = `<html><head><script src="/assets/legacy.js"></script></head></html>`;
    const { jsPaths } = parseEagerAssetPaths(html);
    expect(jsPaths).toEqual([]);
  });
});

describe("gzipSize", () => {
  it("matches Node's own zlib.gzipSync output for the same file content", () => {
    const content = "a".repeat(5000);
    writeAsset("assets/sample.js", 5000, "a");
    const expected = gzipSync(Buffer.from(content)).length;
    expect(gzipSize(join(dir, "assets/sample.js"))).toBe(expected);
  });

  it("produces a smaller gzip size than raw size for realistically repetitive JS/CSS text", () => {
    writeAsset("assets/repetitive.js", 10_000, "console.log('hello');");
    const gz = gzipSize(join(dir, "assets/repetitive.js"));
    expect(gz).toBeLessThan(10_000);
  });
});

describe("isMapboxChunk", () => {
  it("matches Vite's real mapbox-gl chunk naming pattern", () => {
    expect(isMapboxChunk("mapbox-gl-CoHF-8o8.js")).toBe(true);
  });

  it("does not match an unrelated chunk that merely contains 'mapbox' mid-name", () => {
    expect(isMapboxChunk("RouteEngine-uses-mapbox-1H2qxSC2.js")).toBe(false);
  });
});

describe("computeMetrics -- eager/lazy classification", () => {
  it("classifies index.html-referenced files as eager and everything else in assets/ as lazy", () => {
    writeIndexHtml(`<html><head>
      <script type="module" crossorigin src="/assets/index-ABC.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-DEF.css">
    </head></html>`);
    writeAsset("assets/index-ABC.js", 1000);
    writeAsset("assets/index-DEF.css", 200);
    writeAsset("assets/SomeLazyRoute-GHI.js", 500); // not referenced by index.html

    const metrics = computeMetrics(dir);
    expect(metrics.eagerJsRawBytes).toBe(1000);
    expect(metrics.eagerCssRawBytes).toBe(200);
    expect(metrics.largestLazyRouteChunk?.file).toBe("SomeLazyRoute-GHI.js");
    expect(metrics.largestLazyRouteChunk?.rawBytes).toBe(500);
  });

  it("never double-counts a modulepreloaded chunk as both eager and lazy", () => {
    writeIndexHtml(`<html><head>
      <script type="module" crossorigin src="/assets/index-ABC.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/shared-JKL.js">
    </head></html>`);
    writeAsset("assets/index-ABC.js", 1000);
    writeAsset("assets/shared-JKL.js", 300);

    const metrics = computeMetrics(dir);
    expect(metrics.eagerJsRawBytes).toBe(1300);
    // The modulepreloaded chunk must not also show up as the "largest lazy
    // route chunk" -- there are no lazy JS files in this fixture at all.
    expect(metrics.largestLazyRouteChunk).toBeNull();
  });

  it("counts total chunks as every .js/.css file in assets/, eager or lazy", () => {
    writeIndexHtml(`<html><head><script type="module" src="/assets/index-ABC.js"></script></head></html>`);
    writeAsset("assets/index-ABC.js", 100);
    writeAsset("assets/Lazy1-AAA.js", 50);
    writeAsset("assets/Lazy2-BBB.js", 50);
    writeAsset("assets/Lazy-CCC.css", 50);

    const metrics = computeMetrics(dir);
    expect(metrics.totalChunks).toBe(4);
  });
});

describe("computeMetrics -- mapbox-gl exclusion", () => {
  it("excludes mapbox-gl from the largest-lazy-route-chunk comparison even when it's by far the largest lazy file", () => {
    writeIndexHtml(`<html><head><script type="module" src="/assets/index-ABC.js"></script></head></html>`);
    writeAsset("assets/index-ABC.js", 1000);
    writeAsset("assets/mapbox-gl-XYZ.js", 500_000); // enormous, but must never win "largest lazy route chunk"
    writeAsset("assets/RouteEngine-DEF.js", 2000); // the real largest lazy ROUTE chunk

    const metrics = computeMetrics(dir);
    expect(metrics.largestLazyRouteChunk?.file).toBe("RouteEngine-DEF.js");
    expect(metrics.mapboxGl?.file).toBe("mapbox-gl-XYZ.js");
    expect(metrics.mapboxGl?.rawBytes).toBe(500_000);
  });

  it("never folds mapbox-gl bytes into any eager total, even in the (unrealistic) case it were referenced by index.html", () => {
    // mapbox-gl is never actually referenced by index.html in this
    // codebase (it only loads inside the lazy Route Planner page), but
    // this proves the exclusion is structural, not just "it happens to
    // never be eager in practice".
    writeIndexHtml(`<html><head><script type="module" src="/assets/index-ABC.js"></script></head></html>`);
    writeAsset("assets/index-ABC.js", 1000);
    writeAsset("assets/mapbox-gl-XYZ.js", 50_000);

    const metrics = computeMetrics(dir);
    expect(metrics.eagerJsRawBytes).toBe(1000);
    expect(metrics.mapboxGl?.rawBytes).toBe(50_000);
  });
});

describe("computeMetrics -- error handling", () => {
  it("throws a clear, specific error when dist/index.html is missing", () => {
    // dir exists (with an empty assets/) but no index.html was written.
    expect(() => computeMetrics(dir)).toThrow(/index\.html/);
    expect(() => computeMetrics(dir)).toThrow(/npm run build/);
  });

  it("throws a clear, specific error when index.html references an asset that doesn't exist on disk", () => {
    writeIndexHtml(`<html><head><script type="module" src="/assets/index-MISSING.js"></script></head></html>`);
    // Deliberately never write assets/index-MISSING.js.
    expect(() => computeMetrics(dir)).toThrow(/index-MISSING\.js/);
    expect(() => computeMetrics(dir)).toThrow(/does not exist/);
  });
});

describe("evaluateBudgets", () => {
  const passingMetrics = {
    eagerJsRawBytes: 100_000,
    eagerJsGzipBytes: 50 * 1024,
    eagerCssRawBytes: 10_000,
    eagerCssGzipBytes: 5 * 1024,
    totalEagerGzipBytes: 55 * 1024,
    largestEagerJsChunk: { file: "index-ABC.js", rawBytes: 100_000 },
    largestLazyRouteChunk: { file: "Route-DEF.js", rawBytes: 50_000, gzipBytes: 15_000 },
    mapboxGl: { file: "mapbox-gl-XYZ.js", rawBytes: 2_000_000, gzipBytes: 500_000 },
    totalChunks: 10,
  };

  it("passes when every metric is within budget", () => {
    const result = evaluateBudgets(passingMetrics, DEFAULT_BUDGETS);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("passes regardless of how large mapbox-gl is -- it is never budgeted", () => {
    const withHugeMapbox = { ...passingMetrics, mapboxGl: { file: "mapbox-gl-XYZ.js", rawBytes: 50_000_000, gzipBytes: 20_000_000 } };
    const result = evaluateBudgets(withHugeMapbox, DEFAULT_BUDGETS);
    expect(result.passed).toBe(true);
  });

  it("fails when eager JS gzip exceeds its budget, and reports exactly that failure", () => {
    const overBudget = { ...passingMetrics, eagerJsGzipBytes: 200 * 1024 };
    const result = evaluateBudgets(overBudget, DEFAULT_BUDGETS);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatch(/Initial eager JS \(gzip\)/);
  });

  it("fails when the largest eager JS chunk exceeds its raw-byte budget", () => {
    const overBudget = {
      ...passingMetrics,
      largestEagerJsChunk: { file: "index-HUGE.js", rawBytes: DEFAULT_BUDGETS.largestEagerJsChunkRawBytes + 1 },
    };
    const result = evaluateBudgets(overBudget, DEFAULT_BUDGETS);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f: string) => f.includes("index-HUGE.js"))).toBe(true);
  });

  it("reports every exceeded budget at once, not just the first one found", () => {
    const overBudget = {
      ...passingMetrics,
      eagerJsGzipBytes: 200 * 1024,
      eagerCssGzipBytes: 20 * 1024,
    };
    const result = evaluateBudgets(overBudget, DEFAULT_BUDGETS);
    expect(result.failures).toHaveLength(2);
  });
});

describe("formatReport -- concise output", () => {
  it("prints a PASS line with no failure list when the budget passes", () => {
    const metrics = {
      eagerJsRawBytes: 100_000,
      eagerJsGzipBytes: 50 * 1024,
      eagerCssRawBytes: 10_000,
      eagerCssGzipBytes: 5 * 1024,
      totalEagerGzipBytes: 55 * 1024,
      largestEagerJsChunk: { file: "index-ABC.js", rawBytes: 100_000 },
      largestLazyRouteChunk: { file: "Route-DEF.js", rawBytes: 50_000, gzipBytes: 15_000 },
      mapboxGl: null,
      totalChunks: 3,
    };
    const evaluation = evaluateBudgets(metrics, DEFAULT_BUDGETS);
    const report = formatReport(metrics, DEFAULT_BUDGETS, evaluation);
    expect(report).toContain("PASS");
    expect(report).not.toContain("FAIL");
    // Concise: a handful of lines, not a dump of every byte/file in the build.
    expect(report.split("\n").length).toBeLessThan(20);
  });

  it("prints a concise FAIL summary that names exactly which budget(s) were exceeded, without extra noise", () => {
    const metrics = {
      eagerJsRawBytes: 900_000,
      eagerJsGzipBytes: 300 * 1024,
      eagerCssRawBytes: 10_000,
      eagerCssGzipBytes: 5 * 1024,
      totalEagerGzipBytes: 305 * 1024,
      largestEagerJsChunk: { file: "index-HUGE.js", rawBytes: 900_000 },
      largestLazyRouteChunk: null,
      mapboxGl: null,
      totalChunks: 2,
    };
    const evaluation = evaluateBudgets(metrics, DEFAULT_BUDGETS);
    const report = formatReport(metrics, DEFAULT_BUDGETS, evaluation);
    expect(report).toContain("FAIL");
    expect(report).toContain("Initial eager JS (gzip)");
    expect(report).toContain("Total initial eager JS+CSS (gzip)");
    // Never dumps a stack trace, a file path outside dist/, or any
    // environment/secret-shaped value.
    expect(report).not.toMatch(/at .*:\d+:\d+/); // no stack-trace-shaped lines
    expect(report).not.toMatch(/[A-Za-z]:\\/); // no absolute Windows filesystem paths
    expect(report).not.toMatch(/process\.env/);
  });
});
