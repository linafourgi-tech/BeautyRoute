// Groups timestamped rows into an ordered, contiguous series of calendar
// months (oldest -> newest, always exactly `months` entries even when some
// have no rows at all -- a real zero, not a missing bucket), keyed by each
// row's UTC year-month. Shared by services/revenue.ts's getRevenueSeries()
// and services/expenses.ts's getExpensesSeries() so the Business Engine's
// revenue-vs-expenses chart lines up on identical month buckets without
// either service knowing about the other.
export function buildMonthlySeries(rows, { dateField, valueField, months, referenceDate }) {
  const endYear = referenceDate.getUTCFullYear();
  const endMonth = referenceDate.getUTCMonth();

  const buckets = Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const d = new Date(Date.UTC(endYear, endMonth - offset, 1));
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    return { monthKey, label, total: 0 };
  });

  const byKey = new Map(buckets.map((b) => [b.monthKey, b]));

  for (const row of rows) {
    const raw = row[dateField];
    if (!raw) continue;
    const d = new Date(raw);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(monthKey);
    // Outside the requested window -- shouldn't happen given the caller's
    // own query bounds, but don't let a boundary edge case corrupt a
    // different month's total by falling through to it.
    if (!bucket) continue;
    bucket.total += Number(row[valueField]) || 0;
  }

  return buckets;
}
