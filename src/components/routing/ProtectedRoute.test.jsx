import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const useSessionMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();

vi.mock("../../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));

import { ProtectedRoute } from "./ProtectedRoute";

function renderProtected({ initialEntry = "/dashboard" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/onboarding" element={<div>Onboarding page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Protected dashboard content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
  });

  it("shows the loading screen while the session is still resolving, without redirecting", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: true });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderProtected();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("redirects to /login when signed out", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderProtected();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects to /onboarding when signed in but onboarding is not completed", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: false }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderProtected();
    expect(screen.getByText("Onboarding page")).toBeInTheDocument();
  });

  it("shows the loading screen while workspace/subscription are still resolving for an onboarded user (never guesses)", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: true });
    useSubscriptionMock.mockReturnValue({ subscription: null, loading: false });

    renderProtected();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders UpgradeRequired instead of the gated content when the subscription is expired", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "expired" }, loading: false });

    renderProtected();
    expect(screen.getByText("Your trial has ended")).toBeInTheDocument();
    expect(screen.queryByText("Protected dashboard content")).not.toBeInTheDocument();
  });

  it("renders the protected content when signed in, onboarded, and subscription is active", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });

    renderProtected();
    expect(screen.getByText("Protected dashboard content")).toBeInTheDocument();
  });
});
