import { useSessionContext } from '../contexts/useSessionContext'

// Phase 13 Step 2: now backed by the shared SessionContext instead of an
// independent per-component fetch (see contexts/SessionContext.jsx for
// why). Same import path, same return shape ({ user, profile, loading,
// refresh }) as before -- every existing caller needed zero changes.
export function useSession() {
  return useSessionContext()
}
