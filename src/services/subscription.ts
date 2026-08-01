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

// 1. Get a workspace's subscription-relevant fields
export async function getSubscription(workspaceId: string): Promise<Subscription> {
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
