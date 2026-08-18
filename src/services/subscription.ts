import { supabase } from '../lib/supabase'
import { PLANS } from '../lib/plans'

const TRIAL_WARNING_DAYS = 3

export type Subscription = {
  id: string
  plan_tier: string
  subscription_status: string
  trial_started_at: string | null
  trial_ends_at: string | null
}

// Performance fix (full-product-design-migration navigation-lag
// investigation): useSubscription(workspaceId) is called independently by
// ProtectedRoute, TrialBanner (inside Layout), and -- on RouteEngine,
// AIEngine, BeautyPassport, Pricing -- the page itself too. On a single
// page load that's up to 3 simultaneous, identical
// `getSubscription(workspaceId)` calls, each its own real Supabase round
// trip. Rather than restructure useSubscription into a context (a bigger
// change to its public contract, and to the already-passing hook-level
// test that fetches per arbitrary workspaceId, not a single "current"
// one), this coalesces only genuinely-concurrent in-flight requests for
// the same workspaceId into one real network call -- every caller still
// awaits its own promise and gets the same result, but only one request
// reaches Supabase.
const inFlightSubscriptionRequests = new Map<string, Promise<Subscription>>()

// Performance fix (design-refinement pass, navigation-lag investigation,
// measured): the coalescing above only collapses SIMULTANEOUS calls on one
// page load -- it does nothing across separate navigations. App.jsx's flat
// route structure means ProtectedRoute (and, on RouteEngine/AIEngine/
// BeautyPassport, the page itself) fully unmounts and remounts on every
// navigation, so useSubscription's mount effect fires a brand-new
// getSubscription() every single time, even though plan_tier/
// subscription_status/trial dates essentially never change while someone
// is actively navigating between pages. ProtectedRoute blocks rendering on
// this fetch (shows RouteLoading until it resolves) -- confirmed, not
// speculative: this is the mechanism behind the loading flash between
// pages. A short TTL cache eliminates that redundant round trip for the
// common case (repeat navigation within a session) while still bounding
// how stale a real change could ever be. There is no realtime channel/
// webhook for plan changes, so this is the same kind of "good enough,
// bounded staleness" tradeoff already used elsewhere in this app (see
// WorkspaceContext/SessionContext's own fetch-once-per-session pattern).
const SUBSCRIPTION_CACHE_TTL_MS = 30_000
const subscriptionCache = new Map<string, { promise: Promise<Subscription>; expiresAt: number }>()

// 1. Get a workspace's subscription-relevant fields
export function getSubscription(workspaceId: string): Promise<Subscription> {
  const cached = subscriptionCache.get(workspaceId)
  if (cached && cached.expiresAt > Date.now()) return cached.promise

  const existing = inFlightSubscriptionRequests.get(workspaceId)
  if (existing) return existing

  // `.finally(cleanup)` is chained onto the fetch itself -- not a separate
  // branch off it -- so by the time ANY consumer (this function's own
  // cache-set below, or the caller awaiting the returned promise) observes
  // `request` as settled, the in-flight map is already guaranteed clean.
  // A separate sibling branch (`request.then(...).finally(cleanup)`) would
  // let a caller's `await` resume before that branch's own `.finally()`
  // had actually run, leaving a stale in-flight entry that a rapid
  // next call could incorrectly reuse instead of re-fetching -- exactly
  // the kind of back-to-back timing a real second navigation doesn't
  // normally hit, but a test (or a very fast double-click) could.
  const request = fetchSubscription(workspaceId).finally(() => {
    inFlightSubscriptionRequests.delete(workspaceId)
  })
  inFlightSubscriptionRequests.set(workspaceId, request)

  request.then(
    () => {
      subscriptionCache.set(workspaceId, { promise: request, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS })
    },
    () => {
      // A failed fetch is never cached -- the next call should retry
      // against Supabase, not keep returning the same rejected promise.
    }
  )
  return request
}

// Explicit cache invalidation for a caller that needs guaranteed-fresh
// data right now (e.g. a real upgrade/downgrade flow, once one exists --
// Pricing's plan actions are all "Coming Soon" today, so nothing calls
// this yet). Omit workspaceId to clear every cached entry (used by tests
// for isolation between cases).
export function invalidateSubscriptionCache(workspaceId?: string): void {
  if (workspaceId) subscriptionCache.delete(workspaceId)
  else subscriptionCache.clear()
}

async function fetchSubscription(workspaceId: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, plan_tier, subscription_status, trial_started_at, trial_ends_at')
    .eq('id', workspaceId)
    .single()

  if (error) throw error
  return data
}

// 2. Days left in the trial window (0 once it's over, never negative)
export function getRemainingTrialDays(subscription: Subscription | null | undefined): number {
  if (!subscription?.trial_ends_at) return 0
  const msRemaining = new Date(subscription.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
}

// 3. Has the trial window elapsed, regardless of what subscription_status
// currently says? (Nothing flips subscription_status over time without a
// scheduled job/webhook, which is out of scope until Stripe -- so "expired"
// has to be computed from the date, not just read from the status column.)
export function isTrialExpired(subscription: Subscription | null | undefined): boolean {
  if (!subscription?.trial_ends_at) return false
  return new Date(subscription.trial_ends_at).getTime() < Date.now()
}

export function isTrial(subscription: Subscription | null | undefined): boolean {
  return subscription?.subscription_status === 'trial'
}

export function isActive(subscription: Subscription | null | undefined): boolean {
  return subscription?.subscription_status === 'active'
}

// 4. True if the workspace is expired -- either explicitly marked so, or a
// trial that has run past its trial_ends_at.
export function isExpired(subscription: Subscription | null | undefined): boolean {
  if (!subscription) return false
  if (subscription.subscription_status === 'expired') return true
  return isTrial(subscription) && isTrialExpired(subscription)
}

export function isTrialEndingSoon(subscription: Subscription | null | undefined): boolean {
  return isTrial(subscription) && !isExpired(subscription) && getRemainingTrialDays(subscription) <= TRIAL_WARNING_DAYS
}

// 5. Can this workspace use gated application features right now? Expired
// workspaces still authenticate, view their profile, and (later) manage
// billing -- this only gates feature usage, never sign-in itself.
export function canAccessApplication(subscription: Subscription | null | undefined): boolean {
  return !isExpired(subscription)
}

// 6. Feature gate -- the single place page code should ask "can I show this?"
// Unknown/missing plan_tier falls back to Starter (the most restrictive
// plan), never to "everything allowed".
export function hasFeature(subscription: Subscription | null | undefined, featureName: string): boolean {
  if (!canAccessApplication(subscription)) return false
  const plan = PLANS[subscription?.plan_tier as string] ?? PLANS.Starter
  return Boolean(plan.features[featureName as keyof typeof plan.features])
}
