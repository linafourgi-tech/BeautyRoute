import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const useSessionMock = vi.fn();
vi.mock("../../hooks/useSession", () => ({ useSession: () => useSessionMock() }));

import { OnboardingRoute } from "./OnboardingRoute";

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <div>Onboarding wizard content</div>
            </OnboardingRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingRoute", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("shows the loading screen while the session is resolving", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: true });
    renderGuarded();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("redirects to /login when signed out", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: false });
    renderGuarded();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects an already-onboarded user to /dashboard instead of re-running the wizard", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: true }, loading: false });
    renderGuarded();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("renders the onboarding wizard for a signed-in, not-yet-onboarded user", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { onboarding_completed: false }, loading: false });
    renderGuarded();
    expect(screen.getByText("Onboarding wizard content")).toBeInTheDocument();
  });

  it("renders the onboarding wizard when profile is null (new user, profile row not created/loaded yet)", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: null, loading: false });
    renderGuarded();
    expect(screen.getByText("Onboarding wizard content")).toBeInTheDocument();
  });
});
