import { useCallback, useEffect, useRef, useState } from 'react'
import { getSubscription, type Subscription } from '../services/subscription'

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

  const refresh = useCallback(async () => {
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

  useEffect(() => {
    refresh()
  }, [refresh])

  return { subscription, loading, error, refresh }
}
