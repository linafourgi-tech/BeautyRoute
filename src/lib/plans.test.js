import { describe, expect, it } from "vitest";
import { PLANS, PLAN_ORDER } from "./plans";

const KNOWN_TIERS = ["Starter", "Pro", "Studio"];
const FEATURE_FLAGS = ["ai", "routing", "staff", "analytics", "unlimitedClients"];

describe("PLANS / PLAN_ORDER static data", () => {
  it("defines exactly the three known tiers, in ascending-privilege order", () => {
    expect(PLAN_ORDER).toEqual(KNOWN_TIERS);
    expect(Object.keys(PLANS).sort()).toEqual([...KNOWN_TIERS].sort());
  });

  it("keys each plan entry's own id to match its object key (no copy/paste drift)", () => {
    for (const tier of PLAN_ORDER) {
      expect(PLANS[tier].id).toBe(tier);
    }
  });

  it("defines every known feature flag, as a boolean, on every tier", () => {
    for (const tier of PLAN_ORDER) {
      for (const flag of FEATURE_FLAGS) {
        expect(typeof PLANS[tier].features[flag]).toBe("boolean");
      }
    }
  });

  it("Starter grants no gated features", () => {
    expect(PLANS.Starter.features).toEqual({
      ai: false,
      routing: false,
      staff: false,
      analytics: false,
      unlimitedClients: false,
    });
  });

  it("Pro grants ai/routing/analytics/unlimitedClients but not staff", () => {
    expect(PLANS.Pro.features).toEqual({
      ai: true,
      routing: true,
      staff: false,
      analytics: true,
      unlimitedClients: true,
    });
  });

  it("Studio grants every feature, including staff", () => {
    expect(PLANS.Studio.features).toEqual({
      ai: true,
      routing: true,
      staff: true,
      analytics: true,
      unlimitedClients: true,
    });
  });

  it("never grants a feature to a lower tier that a higher tier doesn't also grant (monotonic privilege, no escalation past a higher tier)", () => {
    for (const flag of FEATURE_FLAGS) {
      for (let i = 0; i < PLAN_ORDER.length - 1; i++) {
        const lower = PLANS[PLAN_ORDER[i]].features[flag];
        const higher = PLANS[PLAN_ORDER[i + 1]].features[flag];
        // lower tier granting a feature (true) while the next tier up denies
        // it (false) would be a privilege inversion in the pricing model.
        if (lower) {
          expect(higher).toBe(true);
        }
      }
    }
  });

  it("returns undefined (not a default plan) for an unknown/missing tier key -- callers are responsible for the Starter fallback (see src/services/subscription.ts hasFeature)", () => {
    expect(PLANS["NotARealTier"]).toBeUndefined();
    expect(PLANS[""]).toBeUndefined();
    expect(PLANS[undefined]).toBeUndefined();
  });
});
