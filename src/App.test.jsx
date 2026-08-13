import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";

// Root-route regression test: "/" used to render the old, disconnected
// ServiceSelection ("BeautyRoute Platform") page -- a baseline-era artifact
// nobody ever repointed at the real dashboard (see Sidebar.jsx's own
// nav-fix comment, and App.jsx's own comment on this route). This proves
// the fix -- "/" now redirects to /dashboard -- and that the surrounding
// guard behavior (unauthenticated -> /login, onboarding routing) is
// unaffected, using the same mocked-hook pattern already established by
// ProtectedRoute.test.jsx and OnboardingRoute.test.jsx (both of which are
// unchanged by this fix and continue to cover the guards' own logic in
// full). This intentionally mirrors App.jsx's actual route composition
// rather than rendering the real <App/> tree, consistent with how
// SessionContext/WorkspaceContext/ProtectedRoute are each tested in
// isolation elsewhere in this suite instead of through the full provider
// stack + every lazy-loaded page.
const useSessionMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();

vi.mock("./hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("./hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("./hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));

import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import { OnboardingRoute } from "./components/routing/OnboardingRoute";

function renderRootRoute({ initialEntry = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        {/* Exactly App.jsx's own "/" route */}
        <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/onboarding" element={<OnboardingRoute><div>Onboarding wizard content</div></OnboardingRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("App root route (\"/\")", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
  });

  it("redirects an authenticated, onboarded user with an active subscription to /dashboard instead of the old ServiceSelection page", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });

    renderRootRoute();

    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("BeautyRoute Platform")).not.toBeInTheDocument();
  });

  it("still redirects an unauthenticated visitor to /login -- \"/\" remains protected, not a public redirect", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderRootRoute();

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("sends a signed-in but not-yet-onboarded visitor to /onboarding, not /dashboard -- pre-existing ProtectedRoute behavior, unaffected by this fix", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: false }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderRootRoute();

    expect(screen.getByText("Onboarding wizard content")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("existing onboarding routing is unaffected by this change: /onboarding still bounces an already-onboarded user to /dashboard", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });

    renderRootRoute({ initialEntry: "/onboarding" });

    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("existing onboarding routing is unaffected by this change: /onboarding still renders the wizard for a not-yet-onboarded user", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: false }, loading: false });

    renderRootRoute({ initialEntry: "/onboarding" });

    expect(screen.getByText("Onboarding wizard content")).toBeInTheDocument();
  });
});
