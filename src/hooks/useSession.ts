import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentUser } from '../services/auth'
import { getProfile } from '../services/profiles'

// Resolves the signed-in user + their profile (including onboarding_completed)
// in one place, so route guards can wait for a single "loading" flag instead
// of each page re-deriving this independently.
export function useSession() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const currentUser = await getCurrentUser()
      if (!mountedRef.current) return
      setUser(currentUser as Record<string, unknown> | null)

      if (currentUser) {
        const currentProfile = await getProfile((currentUser as { id: string }).id)
        if (mountedRef.current) setProfile(currentProfile)
      } else if (mountedRef.current) {
        setProfile(null)
      }
    } catch {
      // getCurrentUser() throws AuthSessionMissingError when there's no
      // active session -- an expected state for a signed-out visitor, not a
      // real failure. Treat it as "no user" rather than letting it surface
      // as an uncaught rejection.
      if (mountedRef.current) {
        setUser(null)
        setProfile(null)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { user, profile, loading, refresh }
}
