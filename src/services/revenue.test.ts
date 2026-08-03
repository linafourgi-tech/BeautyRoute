import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getMonthlyRevenue } from "./revenue";

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
