import { describe, expect, it } from "vitest";
import { buildMonthlySeries } from "./monthSeries";

describe("buildMonthlySeries", () => {
  it("returns exactly `months` buckets, oldest to newest, ending at referenceDate's month", () => {
    const result = buildMonthlySeries([], {
      dateField: "processed_at",
      valueField: "net_total",
      months: 6,
      referenceDate: new Date("2026-08-15T12:00:00.000Z"),
    });

    expect(result.map((b) => b.monthKey)).toEqual([
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
    expect(result.map((b) => b.label)).toEqual(["Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
    expect(result.every((b) => b.total === 0)).toBe(true);
  });

  it("sums matching rows into the correct month bucket", () => {
    const rows = [
      { processed_at: "2026-08-02T10:00:00.000Z", net_total: 100 },
      { processed_at: "2026-08-20T10:00:00.000Z", net_total: 50.5 },
      { processed_at: "2026-07-01T00:00:00.000Z", net_total: 75 },
    ];
    const result = buildMonthlySeries(rows, {
      dateField: "processed_at",
      valueField: "net_total",
      months: 6,
      referenceDate: new Date("2026-08-15T12:00:00.000Z"),
    });

    const aug = result.find((b) => b.monthKey === "2026-08");
    const jul = result.find((b) => b.monthKey === "2026-07");
    expect(aug.total).toBe(150.5);
    expect(jul.total).toBe(75);
  });

  it("gives every empty month a real 0, not a missing bucket", () => {
    const result = buildMonthlySeries([{ processed_at: "2026-08-01T00:00:00.000Z", net_total: 10 }], {
      dateField: "processed_at",
      valueField: "net_total",
      months: 3,
      referenceDate: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(result).toHaveLength(3);
    expect(result.find((b) => b.monthKey === "2026-06").total).toBe(0);
    expect(result.find((b) => b.monthKey === "2026-07").total).toBe(0);
  });

  it("treats a null/malformed value as 0 rather than producing NaN", () => {
    const result = buildMonthlySeries([{ processed_at: "2026-08-01T00:00:00.000Z", net_total: null }], {
      dateField: "processed_at",
      valueField: "net_total",
      months: 1,
      referenceDate: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(result[0].total).toBe(0);
    expect(Number.isNaN(result[0].total)).toBe(false);
  });

  it("skips a row with no date rather than throwing", () => {
    const result = buildMonthlySeries([{ processed_at: null, net_total: 10 }], {
      dateField: "processed_at",
      valueField: "net_total",
      months: 1,
      referenceDate: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(result[0].total).toBe(0);
  });

  it("ignores a row whose date falls outside the requested window instead of corrupting a bucket", () => {
    const result = buildMonthlySeries([{ processed_at: "2020-01-01T00:00:00.000Z", net_total: 999 }], {
      dateField: "processed_at",
      valueField: "net_total",
      months: 2,
      referenceDate: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(result.every((b) => b.total === 0)).toBe(true);
  });

  it("works with a different dateField/valueField pair (e.g. expenses' incurred_at/amount)", () => {
    const result = buildMonthlySeries([{ incurred_at: "2026-08-05", amount: "42.00" }], {
      dateField: "incurred_at",
      valueField: "amount",
      months: 1,
      referenceDate: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(result[0].total).toBe(42);
  });
});
