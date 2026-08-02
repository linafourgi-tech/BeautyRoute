import { useWorkspaceContext } from '../contexts/useWorkspaceContext'

// Phase 9: now backed by the shared WorkspaceContext instead of an
// independent per-component fetch, so switching workspaces in the sidebar
// updates every consumer at once. Same import path, same return shape as
// before -- ProtectedRoute, TrialBanner, Pricing, Appointments, RouteEngine,
// StylistDashboard, Clients, and Services all needed zero changes for this.
export function useCurrentWorkspace() {
  const { workspace, workspaceId, loading, error, refresh } = useWorkspaceContext()
  return { workspace, workspaceId, loading, error, refresh }
}
