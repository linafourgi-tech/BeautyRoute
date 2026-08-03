// Durable, shared rate limiting backed by Postgres (see
// supabase/migrations/20260803140000_durable_rate_limiting.sql for the
// check_rate_limit() function and rate_limit_events table this calls).
// Replaces the previous per-isolate in-memory Map, which reset on every
// cold isolate and could be exceeded by fanning requests across enough of
// them -- Edge Function isolates are ephemeral and can run in more than
// one region, so that in-memory count was never a durable, global
// guarantee.
//
// The underlying database function scopes every check to auth.uid() and
// the given function name internally -- this helper never passes a
// caller-supplied user id, so one user can never check or consume another
// user's quota, and two different Edge Functions (e.g. "ai-assistant" and
// "route-planner") never collide on the same counter.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type RateLimitResult = { allowed: boolean; failedOpen: boolean };

// If the check itself throws (e.g. a transient database connectivity
// issue), this fails OPEN: allowed=true, failedOpen=true -- rather than
// blocking every legitimate user because one abuse-mitigation query
// hiccuped. This is a deliberate choice, not an oversight: every other
// check in these functions (auth, workspace membership, plan gating) fails
// closed, because getting those wrong is a real authorization bypass; a
// rate limiter is an abuse-mitigation control, not an authorization
// boundary, so unavailability of its own backend shouldn't take the whole
// feature down for every legitimate user. The failure is surfaced via
// failedOpen so the caller can log it (operational metadata only, never
// request content) instead of it being silently swallowed.
export async function checkRateLimit(
  supabase: SupabaseClient,
  functionName: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_function_name: functionName,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    });
    if (error) throw error;
    return { allowed: Boolean(data), failedOpen: false };
  } catch {
    return { allowed: true, failedOpen: true };
  }
}
