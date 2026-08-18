import { useCallback, useEffect, useRef, useState } from 'react'
import { getSubscription, invalidateSubscriptionCache, type Subscription } from '../services/subscription'

// Centralizes the workspaceId -> getSubscription() pattern that TrialBanner,
// Pricing, and the route guards all need. Pass null while the workspace is
// still being resolved -- this hook just no-ops until it has a real id.
export function useSubscription(workspaceId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(Boolean(workspaceId))
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!workspaceId) {
      setSubscription(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sub = await getSubscription(workspaceId)
      if (mountedRef.current) setSubscription(sub)
    } catch (err) {
      if (mountedRef.current) setError(err as Error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [workspaceId])

  // Runs on every mount (i.e. every navigation, given App.jsx's current
  // flat routes) -- deliberately reuses getSubscription()'s short-lived
  // cache rather than forcing a fresh fetch every time. See
  // services/subscription.ts for why.
  useEffect(() => {
    load()
  }, [load])

  // Exposed for a caller that needs guaranteed-fresh data on demand (e.g.
  // right after a real upgrade/downgrade action). Unlike the automatic
  // mount-triggered load() above, this explicitly invalidates the cache
  // first, so it never returns a stale cached read.
  const refresh = useCallback(async () => {
    if (workspaceId) invalidateSubscriptionCache(workspaceId)
    await load()
  }, [workspaceId, load])

  return { subscription, loading, error, refresh }
}
