import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const useSessionMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();

vi.mock("../../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));

import { TrialBanner } from "./TrialBanner";

function renderBanner() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<TrialBanner />} />
        <Route path="/pricing" element={<div>Pricing page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function futureIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("TrialBanner", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1" });
  });

  it("renders nothing while the session is loading", () => {
    useSessionMock.mockReturnValue({ user: null, loading: true });
    useSubscriptionMock.mockReturnValue({ subscription: null });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a signed-out visitor", () => {
    useSessionMock.mockReturnValue({ user: null, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: null });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an active (non-trial, non-expired) subscription", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" } });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows remaining trial days, correctly pluralized, for an active trial", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    useSubscriptionMock.mockReturnValue({
      subscription: { subscription_status: "trial", trial_ends_at: futureIso(5) },
    });
    renderBanner();
    expect(screen.getByText("Your free trial ends in 5 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View plans" })).toBeInTheDocument();
  });

  it("uses singular 'day' when exactly one day remains", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    useSubscriptionMock.mockReturnValue({
      subscription: { subscription_status: "trial", trial_ends_at: futureIso(1) },
    });
    renderBanner();
    expect(screen.getByText("Your free trial ends in 1 day.")).toBeInTheDocument();
  });

  it("shows an ended-trial message and 'Upgrade Now' for an expired subscription", () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "expired" } });
    renderBanner();
    expect(screen.getByText("Your trial has ended.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade Now" })).toBeInTheDocument();
  });

  it("navigates to /pricing when the CTA is clicked", async () => {
    useSessionMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "expired" } });
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: "Upgrade Now" }));
    expect(await screen.findByText("Pricing page")).toBeInTheDocument();
  });
});
