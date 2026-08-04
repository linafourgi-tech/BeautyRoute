import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getAppointments, getTodaysAppointments } from "./appointments";

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const lt = vi.fn(() => ({ order }));
  const gte = vi.fn(() => ({ lt }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, gte, lt, order };
}

describe("getTodaysAppointments (dashboard query, Phase 13 Step 3)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("REGRESSION: scopes the query to a single UTC calendar day, not the workspace's entire history", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T15:30:00.000Z"));
    await getTodaysAppointments("ws-1");

    expect(fromMock).toHaveBeenCalledWith("appointments");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(chain.gte).toHaveBeenCalledWith("start_time", "2026-08-04T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("start_time", "2026-08-05T00:00:00.000Z");
  });

  it("REGRESSION: workspace isolation -- never sends another workspace's id", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getTodaysAppointments("ws-2");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-2");
  });

  it("computes a fresh day boundary for a different system date -- not a fixed window", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:00:00.000Z"));
    await getTodaysAppointments("ws-1");

    expect(chain.gte).toHaveBeenCalledWith("start_time", "2026-12-31T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("start_time", "2027-01-01T00:00:00.000Z");
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildSelectChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getTodaysAppointments("ws-1")).rejects.toThrow("connection lost");
  });
});

describe("getAppointments (Appointments page, bounded rolling window, Phase 13 Step 3)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("REGRESSION: bounds the query to a rolling window around today instead of the workspace's entire history", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const now = new Date("2026-08-04T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await getAppointments("ws-1");

    // Mirrors the exact arithmetic in services/appointments.ts (90 days
    // back, 180 days forward) rather than hardcoding pre-computed calendar
    // dates, so this test can't drift out of sync with the production
    // constants without also failing loudly.
    const expectedStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const expectedEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();

    expect(fromMock).toHaveBeenCalledWith("appointments");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(chain.gte).toHaveBeenCalledWith("start_time", expectedStart);
    expect(chain.lt).toHaveBeenCalledWith("start_time", expectedEnd);
  });

  it("REGRESSION: the window is bounded, not unbounded -- start and end are both finite, real timestamps, not omitted", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getAppointments("ws-1");

    expect(chain.gte).toHaveBeenCalledTimes(1);
    expect(chain.lt).toHaveBeenCalledTimes(1);
    const [, startArg] = chain.gte.mock.calls[0];
    const [, endArg] = chain.lt.mock.calls[0];
    expect(Number.isNaN(new Date(startArg as string).getTime())).toBe(false);
    expect(Number.isNaN(new Date(endArg as string).getTime())).toBe(false);
  });

  it("REGRESSION: workspace isolation -- never sends another workspace's id", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getAppointments("ws-2");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-2");
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildSelectChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getAppointments("ws-1")).rejects.toThrow("connection lost");
  });
});
