// Nearest-neighbor construction + 2-opt local-search improvement.
//
// This is a HEURISTIC, not an exact solver -- it does not guarantee a
// globally shortest route, only a reasonable improvement over a naive
// order. Callers must present it as an estimate, never as "optimal."
// Operates purely on a travel-time matrix already fetched from the server
// (see src/services/route.ts) -- no network calls happen here, so it's
// safe to re-run instantly as the user experiments.
//
// `stopIds` must be in the same order the matrix rows/columns were built in
// (chronological, per route-planner's `plan` response). `hasStart` shifts
// the matrix index by 1 if a starting-location row/column is present.
export function optimizeStopOrder(stopIds, matrix, hasStart) {
  const n = stopIds.length;
  if (n <= 2 || !matrix?.durations) return stopIds.slice();

  const offset = hasStart ? 1 : 0;
  const dur = (i, j) => matrix.durations[offset + i]?.[offset + j] ?? 0;

  function totalCost(order) {
    let sum = 0;
    for (let i = 0; i < order.length - 1; i++) sum += dur(order[i], order[i + 1]);
    return sum;
  }

  // Nearest-neighbor construction, starting from stop 0 (first appointment
  // chronologically -- appointments are never skipped, only reordered
  // among themselves).
  const visited = new Array(n).fill(false);
  let order = [0];
  visited[0] = true;
  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let best = -1;
    let bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const cost = dur(last, j);
      if (cost < bestCost) {
        bestCost = cost;
        best = j;
      }
    }
    order.push(best);
    visited[best] = true;
  }

  // 2-opt improvement, bounded so this stays fast even at the max stop count.
  const MAX_ITERATIONS = 2000;
  let iterations = 0;
  let improved = true;
  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    outer: for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        iterations++;
        if (iterations > MAX_ITERATIONS) break outer;
        const candidate = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
        if (totalCost(candidate) < totalCost(order) - 0.01) {
          order = candidate;
          improved = true;
        }
      }
    }
  }

  return order.map((idx) => stopIds[idx]);
}
