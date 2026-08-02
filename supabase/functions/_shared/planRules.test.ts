import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasFeature } from "./planRules.ts";

// planRules.ts's own header comment states it mirrors src/lib/plans.js and
// src/services/subscription.ts's hasFeature() exactly, since those frontend
// files import React/browser-only modules (src/lib/supabase.js calls
// createClient() at import time using import.meta.env, which doesn't exist
// under Deno) and can't be imported directly into a Deno test. This table is
// hand-transcribed from src/lib/plans.js as it exists today -- Step 3's
// src/lib/plans.test.js and src/services/subscription.test.ts independently
// verify the frontend side of the same data, so this test is the other half
// of that consistency check, not a duplicate of it.
const FRONTEND_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  Starter: { ai: false, routing: false, staff: false, analytics: false, unlimitedClients: false },
  Pro: { ai: true, routing: true, staff: false, analytics: true, unlimitedClients: true },
  Studio: { ai: true, routing: true, staff: true, analytics: true, unlimitedClients: true },
};
const PLAN_ORDER = ["Starter", "Pro", "Studio"];

function sub(overrides: Record<string, unknown> = {}) {
  return { plan_tier: "Pro", subscription_status: "active", trial_ends_at: null, ...overrides };
}

Deno.test("hasFeature -- every supported tier x every feature matches the frontend plan definitions exactly", () => {
  for (const tier of PLAN_ORDER) {
    for (const feature of Object.keys(FRONTEND_PLAN_FEATURES.Starter)) {
      const expected = FRONTEND_PLAN_FEATURES[tier][feature];
      assertEquals(hasFeature(sub({ plan_tier: tier }), feature), expected, `${tier}/${feature}`);
    }
  }
});

Deno.test("hasFeature -- Starter denies every feature", () => {
  for (const feature of ["ai", "routing", "staff", "analytics", "unlimitedClients"]) {
    assertEquals(hasFeature(sub({ plan_tier: "Starter" }), feature), false);
  }
});

Deno.test("hasFeature -- Studio grants every feature, including staff", () => {
  for (const feature of ["ai", "routing", "staff", "analytics", "unlimitedClients"]) {
    assertEquals(hasFeature(sub({ plan_tier: "Studio" }), feature), true);
  }
});

Deno.test("hasFeature -- falls back to the Starter (most restrictive) feature set for an unknown/missing tier -- never fails open", () => {
  assertEquals(hasFeature(sub({ plan_tier: "NotARealTier" }), "ai"), false);
  assertEquals(hasFeature(sub({ plan_tier: null }), "routing"), false);
  assertEquals(hasFeature(sub({ plan_tier: undefined }), "staff"), false);
});

Deno.test("hasFeature -- denies every feature once explicitly expired, even on the Studio plan", () => {
  const expiredStudio = sub({ plan_tier: "Studio", subscription_status: "expired" });
  for (const feature of ["ai", "routing", "staff", "analytics", "unlimitedClients"]) {
    assertEquals(hasFeature(expiredStudio, feature), false);
  }
});

Deno.test("hasFeature -- denies every feature for an expired trial on the Studio plan", () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const expiredTrialStudio = sub({ plan_tier: "Studio", subscription_status: "trial", trial_ends_at: pastDate });
  assertEquals(hasFeature(expiredTrialStudio, "ai"), false);
  assertEquals(hasFeature(expiredTrialStudio, "routing"), false);
});

Deno.test("hasFeature -- allows features for a trial still within its window", () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const activeTrialPro = sub({ plan_tier: "Pro", subscription_status: "trial", trial_ends_at: futureDate });
  assertEquals(hasFeature(activeTrialPro, "ai"), true);
  assertEquals(hasFeature(activeTrialPro, "routing"), true);
});

Deno.test("hasFeature -- returns false for an unrecognized feature name on every tier (no accidental wildcard grant)", () => {
  for (const tier of PLAN_ORDER) {
    assertEquals(hasFeature(sub({ plan_tier: tier }), "notARealFeature"), false);
  }
});
