// Server-safe mirror of the plan -> feature rules.
//
// Source of truth (frontend, browser-only code -- cannot run in Deno/Edge
// Functions as-is): src/lib/plans.js (PLANS.<tier>.features) and
// src/services/subscription.ts (isTrialExpired / isTrial / isExpired /
// canAccessApplication / hasFeature). This file mirrors ONLY the pieces an
// Edge Function needs to make the same authorization decision server-side.
//
// If you change plan features or trial/expiry semantics in either of those
// two frontend files, update this file to match in the same change --
// this is the one place that intentionally duplicates that logic, and it
// exists only because the frontend files import React/browser APIs and
// can't be imported directly into the Edge Function runtime.
//
// Used by both ai-assistant (feature: "ai") and route-planner
// (feature: "routing").

export type WorkspaceSubscriptionFields = {
  plan_tier: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

// Mirrors PLANS.<tier>.features in src/lib/plans.js
const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  Starter: { ai: false, routing: false, staff: false, analytics: false, unlimitedClients: false },
  Pro: { ai: true, routing: true, staff: false, analytics: true, unlimitedClients: true },
  Studio: { ai: true, routing: true, staff: true, analytics: true, unlimitedClients: true },
};

// Mirrors isTrial() in src/services/subscription.ts
function isTrial(subscription: WorkspaceSubscriptionFields): boolean {
  return subscription.subscription_status === "trial";
}

// Mirrors isTrialExpired() in src/services/subscription.ts
function isTrialExpired(subscription: WorkspaceSubscriptionFields): boolean {
  if (!subscription.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at).getTime() < Date.now();
}

// Mirrors isExpired() in src/services/subscription.ts
function isExpired(subscription: WorkspaceSubscriptionFields): boolean {
  if (subscription.subscription_status === "expired") return true;
  return isTrial(subscription) && isTrialExpired(subscription);
}

// Mirrors hasFeature(subscription, featureName) in src/services/subscription.ts.
// Unknown/missing plan_tier falls back to Starter (the most restrictive
// plan), never to "everything allowed" -- same fail-closed default as the
// frontend copy.
export function hasFeature(subscription: WorkspaceSubscriptionFields, featureName: string): boolean {
  if (isExpired(subscription)) return false;
  const planTier = subscription.plan_tier ?? "Starter";
  return Boolean(PLAN_FEATURES[planTier]?.[featureName]);
}
