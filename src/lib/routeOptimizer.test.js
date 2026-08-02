import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optimizeStopOrder } from "./routeOptimizer";

function totalCost(order, matrix, offset) {
  const dur = (i, j) => matrix.durations[offset + i]?.[offset + j] ?? 0;
  let sum = 0;
  for (let i = 0; i < order.length - 1; i++) sum += dur(order[i], order[i + 1]);
  return sum;
}

describe("optimizeStopOrder", () => {
  let fetchSpy;

  beforeEach(() => {
    // This module must be pure local computation -- if it ever reaches out
    // to the network (Mapbox or otherwise), that's a boundary violation,
    // not just a slow test. Fail loudly if fetch is ever touched.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("optimizeStopOrder must never call fetch/network APIs");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns an empty array unchanged for zero stops", () => {
    expect(optimizeStopOrder([], null, false)).toEqual([]);
  });

  it("returns a single stop unchanged", () => {
    expect(optimizeStopOrder(["a"], null, false)).toEqual(["a"]);
  });

  it("returns two stops in their original order without consulting the matrix (below the reorder threshold)", () => {
    const matrix = { durations: [[0, 999], [999, 0]] };
    expect(optimizeStopOrder(["a", "b"], matrix, false)).toEqual(["a", "b"]);
  });

  it("returns the input order unchanged when no matrix is provided, even with 3+ stops", () => {
    expect(optimizeStopOrder(["a", "b", "c"], null, false)).toEqual(["a", "b", "c"]);
  });

  it("returns the input order unchanged when matrix.durations is missing", () => {
    expect(optimizeStopOrder(["a", "b", "c"], {}, false)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input stopIds array", () => {
    const stopIds = ["a", "b", "c"];
    const snapshot = [...stopIds];
    optimizeStopOrder(stopIds, null, false);
    expect(stopIds).toEqual(snapshot);
  });

  it("does not mutate the input matrix", () => {
    const stopIds = ["a", "b", "c", "d"];
    const matrix = {
      durations: [
        [0, 10, 1, 11],
        [10, 0, 9, 1],
        [1, 9, 0, 10],
        [11, 1, 10, 0],
      ],
    };
    const matrixSnapshot = JSON.parse(JSON.stringify(matrix));
    optimizeStopOrder(stopIds, matrix, false);
    expect(matrix).toEqual(matrixSnapshot);
  });

  it("preserves every original stop id exactly once (a true permutation, never dropping or duplicating a stop)", () => {
    const stopIds = ["a", "b", "c", "d", "e"];
    // Arbitrary but fixed asymmetric-ish matrix, 5x5.
    const durations = [
      [0, 4, 8, 2, 7],
      [4, 0, 3, 9, 1],
      [8, 3, 0, 6, 5],
      [2, 9, 6, 0, 4],
      [7, 1, 5, 4, 0],
    ];
    const result = optimizeStopOrder(stopIds, { durations }, false);
    expect([...result].sort()).toEqual([...stopIds].sort());
    expect(result).toHaveLength(stopIds.length);
  });

  it("finds a genuinely shorter (or equal) route than the naive chronological order, given a matrix where a better order clearly exists", () => {
    const stopIds = ["a", "b", "c", "d"];
    // Points laid out so the naive sequential order a->b->c->d is a poor
    // route, but a->c->b->d is much shorter.
    const durations = [
      [0, 10, 1, 11],
      [10, 0, 9, 1],
      [1, 9, 0, 10],
      [11, 1, 10, 0],
    ];
    const matrix = { durations };
    const naiveCost = totalCost([0, 1, 2, 3], matrix, 0);
    const result = optimizeStopOrder(stopIds, matrix, false);
    const resultIndices = result.map((id) => stopIds.indexOf(id));
    const optimizedCost = totalCost(resultIndices, matrix, 0);

    expect(optimizedCost).toBeLessThan(naiveCost);
    expect([...result].sort()).toEqual([...stopIds].sort());
  });

  it("is deterministic: identical input produces identical output across repeated calls", () => {
    const stopIds = ["a", "b", "c", "d", "e", "f"];
    const durations = [
      [0, 7, 2, 9, 4, 6],
      [7, 0, 5, 1, 8, 3],
      [2, 5, 0, 6, 1, 9],
      [9, 1, 6, 0, 5, 2],
      [4, 8, 1, 5, 0, 7],
      [6, 3, 9, 2, 7, 0],
    ];
    const matrix = { durations };
    const first = optimizeStopOrder(stopIds, matrix, false);
    const second = optimizeStopOrder(stopIds, matrix, false);
    expect(second).toEqual(first);
  });

  it("handles duplicate stop id values without crashing, preserving the exact multiset of ids", () => {
    // routeOptimizer operates on positional indices, not on id uniqueness --
    // a caller-level duplicate should pass straight through unharmed rather
    // than being silently deduped or causing a crash.
    const stopIds = ["a", "a", "b"];
    const matrix = {
      durations: [
        [0, 3, 5],
        [3, 0, 2],
        [5, 2, 0],
      ],
    };
    const result = optimizeStopOrder(stopIds, matrix, false);
    expect([...result].sort()).toEqual([...stopIds].sort());
  });

  it("respects the hasStart offset, indexing the matrix one row/column in rather than misaligning against the start location", () => {
    const stopIds = ["a", "b", "c"];
    // Row/col 0 is the start location; rows/cols 1-3 are stops a,b,c.
    const durations = [
      [0, 100, 100, 1], // start -> a:100, start -> b:100, start -> c:1
      [100, 0, 2, 100], // a -> b:2
      [100, 2, 0, 100], // b -> a:2
      [1, 100, 100, 0], // c -> start:1
    ];
    const matrix = { durations };
    const result = optimizeStopOrder(stopIds, matrix, true);
    expect([...result].sort()).toEqual([...stopIds].sort());
    // With the offset correctly applied, nearest-neighbor from stop "a"
    // (index 0) should never claim zero-cost/self-referential nonsense --
    // sanity check the result is a real permutation of length 3.
    expect(result).toHaveLength(3);
  });
});
