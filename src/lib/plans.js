// Plan definitions. Keyed by the EXISTING workspaces.plan_tier enum values
// (Starter | Pro | Studio) -- no schema change needed. displayName is what
// the UI shows ("Professional", "Salon"); id/the object key is what's
// actually stored in the database.
//
// Mirrored server-side: this file can't be imported into the ai-assistant
// Edge Function (Deno runtime, no browser/React deps), so the "ai" feature
// flag is duplicated -- deliberately and only there -- in
// supabase/functions/_shared/planRules.ts. If you change PLANS.*.features.ai
// here, update that file in the same change.
export const PLANS = {
  Starter: {
    id: "Starter",
    displayName: "Starter",
    tagline: "For a single mobile stylist just getting started.",
    price: "SAR 99/mo",
    features: {
      ai: false,
      routing: false,
      staff: false,
      analytics: false,
      unlimitedClients: false,
    },
  },
  Pro: {
    id: "Pro",
    displayName: "Professional",
    tagline: "For an independent professional ready to grow.",
    price: "SAR 249/mo",
    features: {
      ai: true,
      routing: true,
      staff: false,
      analytics: true,
      unlimitedClients: true,
    },
  },
  Studio: {
    id: "Studio",
    displayName: "Salon",
    tagline: "For a salon or studio with a team.",
    price: "SAR 499/mo",
    features: {
      ai: true,
      routing: true,
      staff: true,
      analytics: true,
      unlimitedClients: true,
    },
  },
};

export const PLAN_ORDER = ["Starter", "Pro", "Studio"];
