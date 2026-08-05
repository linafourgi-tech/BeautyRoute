import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getExpensesSeries } from "./expenses";

function buildFromChain(result: { data: unknown; error: unknown }) {
  const lt = vi.fn().mockResolvedValue(result);
  const gte = vi.fn(() => ({ lt }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, gte, lt };
}

describe("getExpensesSeries (service-layer, mocked Supabase boundary)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("getExpensesSeries must not make a real network request in this test");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("queries expenses scoped by workspace_id across the full N-month window as plain date strings, and buckets by month", async () => {
    const rows = [
      { amount: "120.00", incurred_at: "2026-08-05" },
      { amount: "30.50", incurred_at: "2026-08-18" },
      { amount: "45.00", incurred_at: "2026-03-02" },
    ];
    const chain = buildFromChain({ data: rows, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const referenceDate = new Date("2026-08-15T12:00:00.000Z");
    const result = await getExpensesSeries("ws-1", 6, referenceDate);

    expect(fromMock).toHaveBeenCalledWith("expenses");
    expect(chain.select).toHaveBeenCalledWith("amount, incurred_at");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    // incurred_at is a `date` column -- bounds must be plain YYYY-MM-DD, not
    // full ISO timestamps (unlike revenues.processed_at, a timestamptz).
    expect(chain.gte).toHaveBeenCalledWith("incurred_at", "2026-03-01");
    expect(chain.lt).toHaveBeenCalledWith("incurred_at", "2026-09-01");
    expect(fromMock).toHaveBeenCalledTimes(1);

    expect(result).toHaveLength(6);
    expect(result.find((p) => p.monthKey === "2026-08").total).toBe(150.5);
    expect(result.find((p) => p.monthKey === "2026-03").total).toBe(45);
    expect(result.find((p) => p.monthKey === "2026-04").total).toBe(0);
  });

  it("sums to 0 (a real, honest empty state) when there are no expense rows in the window", async () => {
    const chain = buildFromChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getExpensesSeries("ws-1", 6, new Date("2026-08-15T00:00:00.000Z"));
    expect(result.every((p) => p.total === 0)).toBe(true);
  });

  it("defaults to a 6-month series ending at the current month when months/referenceDate are omitted", async () => {
    const chain = buildFromChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getExpensesSeries("ws-1");
    expect(result).toHaveLength(6);
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildFromChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getExpensesSeries("ws-1", 6, new Date("2026-08-15T00:00:00.000Z"))).rejects.toThrow("connection lost");
  });
});
