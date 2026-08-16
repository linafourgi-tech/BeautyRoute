import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase client boundary before importing the module under test --
// src/lib/supabase.js calls createClient() at import time, which throws
// without real VITE_SUPABASE_URL/ANON_KEY env vars. Mocking here also
// guarantees zero real network access from this test file.
const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  getSubscription,
  invalidateSubscriptionCache,
  getRemainingTrialDays,
  isTrialExpired,
  isTrial,
  isActive,
  isExpired,
  isTrialEndingSoon,
  canAccessApplication,
  hasFeature,
  type Subscription,
} from "./subscription";

function buildFromChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

describe("getSubscription (service-layer, mocked Supabase boundary)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    invalidateSubscriptionCache(); // isolate tests -- see the cache describe block below
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("getSubscription must not make a real network request in this test");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("queries the workspaces table by id and returns the row on success", async () => {
    const row = {
      id: "ws-1",
      plan_tier: "Pro",
      subscription_status: "active",
      trial_started_at: null,
      trial_ends_at: null,
    };
    const chain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getSubscription("ws-1");

    expect(fromMock).toHaveBeenCalledWith("workspaces");
    expect(chain.select).toHaveBeenCalledWith("id, plan_tier, subscription_status, trial_started_at, trial_ends_at");
    expect(chain.eq).toHaveBeenCalledWith("id", "ws-1");
    expect(result).toEqual(row);
  });

  it("propagates the Supabase error instead of swallowing it", async () => {
    const dbError = new Error("row not found");
    const chain = buildFromChain({ data: null, error: dbError });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getSubscription("missing-ws")).rejects.toThrow("row not found");
  });
});

// Navigation-lag investigation (design-refinement pass): App.jsx's flat
// routes mean ProtectedRoute (and, on some pages, the page itself) fully
// unmounts and remounts on every navigation, so a naive getSubscription()
// would re-hit Supabase on every single page change even though the data
// essentially never changes mid-session. These tests lock in the two real
// mechanisms that prevent that: in-flight coalescing (simultaneous callers
// on one page load share a single request) and a short TTL cache (repeat
// navigations within the window reuse the same resolved value, no network
// call at all).
describe("getSubscription -- in-flight coalescing and short-TTL cache", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    invalidateSubscriptionCache();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("getSubscription must not make a real network request in this test");
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it("coalesces simultaneous calls for the same workspaceId into a single Supabase query (e.g. ProtectedRoute + TrialBanner mounting together)", async () => {
    const row = { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null };
    const chain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const [a, b, c] = await Promise.all([getSubscription("ws-1"), getSubscription("ws-1"), getSubscription("ws-1")]);

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(row);
    expect(b).toEqual(row);
    expect(c).toEqual(row);
  });

  it("does NOT coalesce calls for different workspaceIds -- each gets its own real query", async () => {
    const chain1 = buildFromChain({ data: { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null }, error: null });
    const chain2 = buildFromChain({ data: { id: "ws-2", plan_tier: "Starter", subscription_status: "active", trial_started_at: null, trial_ends_at: null }, error: null });
    fromMock.mockReturnValueOnce({ select: chain1.select }).mockReturnValueOnce({ select: chain2.select });

    const [a, b] = await Promise.all([getSubscription("ws-1"), getSubscription("ws-2")]);

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(a.id).toBe("ws-1");
    expect(b.id).toBe("ws-2");
  });

  it("reuses the cached result for a repeat call within the TTL window -- the core navigation-lag fix: no second Supabase query", async () => {
    const row = { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null };
    const chain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const first = await getSubscription("ws-1");
    const second = await getSubscription("ws-1"); // simulates the next navigation's fresh ProtectedRoute mount

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("fetches fresh again once the TTL window has elapsed", async () => {
    const row = { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null };
    const chain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getSubscription("ws-1");
    vi.setSystemTime(Date.now() + 31_000); // just past the 30s TTL
    await getSubscription("ws-1");

    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed request -- the next call retries against Supabase instead of repeating the same rejection", async () => {
    const dbError = new Error("temporary outage");
    const failingChain = buildFromChain({ data: null, error: dbError });
    fromMock.mockReturnValueOnce({ select: failingChain.select });
    await expect(getSubscription("ws-1")).rejects.toThrow("temporary outage");

    const row = { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null };
    const okChain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValueOnce({ select: okChain.select });
    const result = await getSubscription("ws-1");

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(row);
  });

  it("invalidateSubscriptionCache(workspaceId) forces the next call to hit Supabase again, for a caller that needs guaranteed-fresh data", async () => {
    const row = { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null };
    const chain = buildFromChain({ data: row, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getSubscription("ws-1");
    invalidateSubscriptionCache("ws-1");
    await getSubscription("ws-1");

    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("invalidateSubscriptionCache(workspaceId) only clears that workspace's entry, not every cached workspace", async () => {
    const chain1 = buildFromChain({ data: { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null }, error: null });
    const chain2 = buildFromChain({ data: { id: "ws-2", plan_tier: "Starter", subscription_status: "active", trial_started_at: null, trial_ends_at: null }, error: null });
    const chain1Again = buildFromChain({ data: { id: "ws-1", plan_tier: "Pro", subscription_status: "active", trial_started_at: null, trial_ends_at: null }, error: null });
    fromMock
      .mockReturnValueOnce({ select: chain1.select })
      .mockReturnValueOnce({ select: chain2.select })
      .mockReturnValueOnce({ select: chain1Again.select });

    await getSubscription("ws-1");
    await getSubscription("ws-2");
    invalidateSubscriptionCache("ws-1");
    await getSubscription("ws-1"); // re-fetches
    await getSubscription("ws-2"); // still cached

    expect(fromMock).toHaveBeenCalledTimes(3);
  });
});

describe("subscription pure logic", () => {
  const NOW = new Date("2026-08-02T00:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function sub(overrides: Partial<Subscription> = {}): Subscription {
    return {
      id: "ws-1",
      plan_tier: "Pro",
      subscription_status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      ...overrides,
    };
  }

  describe("getRemainingTrialDays", () => {
    it("returns 0 when there is no trial_ends_at", () => {
      expect(getRemainingTrialDays(sub({ trial_ends_at: null }))).toBe(0);
      expect(getRemainingTrialDays(null)).toBe(0);
      expect(getRemainingTrialDays(undefined)).toBe(0);
    });

    it("returns 0, never negative, once the trial end date is in the past", () => {
      const past = new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(getRemainingTrialDays(sub({ trial_ends_at: past }))).toBe(0);
    });

    it("rounds up remaining whole days", () => {
      const in2point5Days = new Date(NOW + 2.5 * 24 * 60 * 60 * 1000).toISOString();
      expect(getRemainingTrialDays(sub({ trial_ends_at: in2point5Days }))).toBe(3);
    });
  });

  describe("isTrialExpired / isTrial / isActive", () => {
    it("isTrialExpired is false with no trial_ends_at set", () => {
      expect(isTrialExpired(sub({ trial_ends_at: null }))).toBe(false);
    });

    it("isTrialExpired is true once trial_ends_at is in the past", () => {
      const past = new Date(NOW - 1000).toISOString();
      expect(isTrialExpired(sub({ trial_ends_at: past }))).toBe(true);
    });

    it("isTrialExpired is false while trial_ends_at is still in the future", () => {
      const future = new Date(NOW + 1000).toISOString();
      expect(isTrialExpired(sub({ trial_ends_at: future }))).toBe(false);
    });

    it("isTrial / isActive read subscription_status directly", () => {
      expect(isTrial(sub({ subscription_status: "trial" }))).toBe(true);
      expect(isTrial(sub({ subscription_status: "active" }))).toBe(false);
      expect(isActive(sub({ subscription_status: "active" }))).toBe(true);
      expect(isActive(sub({ subscription_status: "trial" }))).toBe(false);
    });
  });

  describe("isExpired", () => {
    it("is false for a null/undefined subscription", () => {
      expect(isExpired(null)).toBe(false);
      expect(isExpired(undefined)).toBe(false);
    });

    it("is true when subscription_status is explicitly 'expired'", () => {
      expect(isExpired(sub({ subscription_status: "expired" }))).toBe(true);
    });

    it("is true for a trial whose trial_ends_at has passed", () => {
      const past = new Date(NOW - 1000).toISOString();
      expect(isExpired(sub({ subscription_status: "trial", trial_ends_at: past }))).toBe(true);
    });

    it("is false for a trial still within its window", () => {
      const future = new Date(NOW + 1000).toISOString();
      expect(isExpired(sub({ subscription_status: "trial", trial_ends_at: future }))).toBe(false);
    });

    it("is false for an active (non-trial) subscription regardless of trial_ends_at", () => {
      const past = new Date(NOW - 1000).toISOString();
      expect(isExpired(sub({ subscription_status: "active", trial_ends_at: past }))).toBe(false);
    });
  });

  describe("isTrialEndingSoon", () => {
    it("is true within the 3-day warning window", () => {
      const in2Days = new Date(NOW + 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTrialEndingSoon(sub({ subscription_status: "trial", trial_ends_at: in2Days }))).toBe(true);
    });

    it("is false with more than 3 days remaining", () => {
      const in10Days = new Date(NOW + 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTrialEndingSoon(sub({ subscription_status: "trial", trial_ends_at: in10Days }))).toBe(false);
    });

    it("is false once the trial has already expired (that's 'expired', not 'ending soon')", () => {
      const past = new Date(NOW - 1000).toISOString();
      expect(isTrialEndingSoon(sub({ subscription_status: "trial", trial_ends_at: past }))).toBe(false);
    });

    it("is false for a non-trial subscription", () => {
      const in1Day = new Date(NOW + 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTrialEndingSoon(sub({ subscription_status: "active", trial_ends_at: in1Day }))).toBe(false);
    });
  });

  describe("canAccessApplication", () => {
    it("is true for a non-expired subscription", () => {
      expect(canAccessApplication(sub({ subscription_status: "active" }))).toBe(true);
    });

    it("is false once expired", () => {
      expect(canAccessApplication(sub({ subscription_status: "expired" }))).toBe(false);
    });
  });

  describe("hasFeature -- security-relevant plan gating (mirrors supabase/functions/_shared/planRules.ts)", () => {
    it.each([
      ["Starter", "ai", false],
      ["Starter", "routing", false],
      ["Starter", "staff", false],
      ["Starter", "analytics", false],
      ["Starter", "unlimitedClients", false],
      ["Pro", "ai", true],
      ["Pro", "routing", true],
      ["Pro", "staff", false],
      ["Pro", "analytics", true],
      ["Pro", "unlimitedClients", true],
      ["Studio", "ai", true],
      ["Studio", "routing", true],
      ["Studio", "staff", true],
      ["Studio", "analytics", true],
      ["Studio", "unlimitedClients", true],
    ])("%s tier -> %s = %s", (plan_tier, feature, expected) => {
      expect(hasFeature(sub({ plan_tier, subscription_status: "active" }), feature)).toBe(expected);
    });

    it("falls back to the Starter (most restrictive) feature set for an unknown plan_tier -- never fails open", () => {
      expect(hasFeature(sub({ plan_tier: "NotARealPlan", subscription_status: "active" }), "ai")).toBe(false);
      expect(hasFeature(sub({ plan_tier: undefined as unknown as string, subscription_status: "active" }), "staff")).toBe(false);
    });

    it("denies every feature once the subscription is expired, even on the Studio plan (no privilege escalation via a stale plan_tier)", () => {
      const expiredStudio = sub({ plan_tier: "Studio", subscription_status: "expired" });
      for (const feature of ["ai", "routing", "staff", "analytics", "unlimitedClients"]) {
        expect(hasFeature(expiredStudio, feature)).toBe(false);
      }
    });

    it("denies every feature for an expired trial on the Studio plan", () => {
      const past = new Date(NOW - 1000).toISOString();
      const expiredTrialStudio = sub({ plan_tier: "Studio", subscription_status: "trial", trial_ends_at: past });
      expect(hasFeature(expiredTrialStudio, "ai")).toBe(false);
    });

    it("returns false for an unrecognized feature name on every tier (no accidental wildcard grant)", () => {
      for (const plan_tier of ["Starter", "Pro", "Studio"]) {
        expect(hasFeature(sub({ plan_tier, subscription_status: "active" }), "notARealFeature")).toBe(false);
      }
    });

    it("returns false for a null/undefined subscription", () => {
      expect(hasFeature(null, "ai")).toBe(false);
      expect(hasFeature(undefined, "routing")).toBe(false);
    });
  });
});
