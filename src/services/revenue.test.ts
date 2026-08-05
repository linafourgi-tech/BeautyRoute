import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getMonthlyRevenue, getRevenueSeries } from "./revenue";

function buildFromChain(result: { data: unknown; error: unknown }) {
  const lt = vi.fn().mockResolvedValue(result);
  const gte = vi.fn(() => ({ lt }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, gte, lt };
}

describe("getMonthlyRevenue (service-layer, mocked Supabase boundary)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("getMonthlyRevenue must not make a real network request in this test");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("queries the revenues table scoped by workspace_id and the current month's bounds, summing net_total", async () => {
    const rows = [{ net_total: 100 }, { net_total: 250.5 }, { net_total: 49.5 }];
    const chain = buildFromChain({ data: rows, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const referenceDate = new Date("2026-08-15T12:00:00.000Z");
    const result = await getMonthlyRevenue("ws-1", referenceDate);

    expect(fromMock).toHaveBeenCalledWith("revenues");
    expect(chain.select).toHaveBeenCalledWith("net_total");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(chain.gte).toHaveBeenCalledWith("processed_at", "2026-08-01T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("processed_at", "2026-09-01T00:00:00.000Z");
    expect(result.totalNet).toBe(400);
    expect(result.currency).toBe("SAR");
  });

  it("sums to 0 (a real, honest empty state) when there are no revenue rows this month", async () => {
    const chain = buildFromChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getMonthlyRevenue("ws-1", new Date("2026-08-15T00:00:00.000Z"));
    expect(result.totalNet).toBe(0);
  });

  it("treats a null/malformed net_total as 0 rather than producing NaN", async () => {
    const chain = buildFromChain({ data: [{ net_total: null }, { net_total: 100 }], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getMonthlyRevenue("ws-1", new Date("2026-08-15T00:00:00.000Z"));
    expect(result.totalNet).toBe(100);
    expect(Number.isNaN(result.totalNet)).toBe(false);
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildFromChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getMonthlyRevenue("ws-1", new Date("2026-08-15T00:00:00.000Z"))).rejects.toThrow("connection lost");
  });

  it("computes different month boundaries for a different reference date -- not a fixed window", async () => {
    const chain = buildFromChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getMonthlyRevenue("ws-1", new Date("2026-02-10T00:00:00.000Z"));
    expect(chain.gte).toHaveBeenCalledWith("processed_at", "2026-02-01T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("processed_at", "2026-03-01T00:00:00.000Z");
  });
});

describe("getRevenueSeries (service-layer, mocked Supabase boundary)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("queries revenues scoped by workspace_id across the full N-month window in one call, and buckets by month", async () => {
    const rows = [
      { net_total: 100, processed_at: "2026-08-02T10:00:00.000Z" },
      { net_total: 50, processed_at: "2026-08-20T10:00:00.000Z" },
      { net_total: 75, processed_at: "2026-03-15T10:00:00.000Z" },
    ];
    const chain = buildFromChain({ data: rows, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const referenceDate = new Date("2026-08-15T12:00:00.000Z");
    const result = await getRevenueSeries("ws-1", 6, referenceDate);

    expect(fromMock).toHaveBeenCalledWith("revenues");
    expect(chain.select).toHaveBeenCalledWith("net_total, processed_at");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    // One query spanning the whole 6-month window, not one per month.
    expect(chain.gte).toHaveBeenCalledWith("processed_at", "2026-03-01T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("processed_at", "2026-09-01T00:00:00.000Z");
    expect(fromMock).toHaveBeenCalledTimes(1);

    expect(result).toHaveLength(6);
    expect(result.map((p) => p.monthKey)).toEqual([
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
    expect(result.find((p) => p.monthKey === "2026-08").total).toBe(150);
    expect(result.find((p) => p.monthKey === "2026-03").total).toBe(75);
    expect(result.find((p) => p.monthKey === "2026-04").total).toBe(0);
  });

  it("defaults to a 6-month series ending at the current month when months/referenceDate are omitted", async () => {
    const chain = buildFromChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getRevenueSeries("ws-1");
    expect(result).toHaveLength(6);
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildFromChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getRevenueSeries("ws-1", 6, new Date("2026-08-15T00:00:00.000Z"))).rejects.toThrow("connection lost");
  });
});
