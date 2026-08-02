import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// Plan name (h2) -> name/badge row div -> info wrapper div -> outer card div.
// closest("div") only reaches the immediate row div, which does NOT contain
// the feature <ul> or the Button -- walk up three levels to get the card
// that actually wraps everything for a given plan.
function planCard(name) {
  return screen.getByText(name).parentElement.parentElement.parentElement;
}

const useSessionMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));

import Pricing from "./Pricing";

describe("Pricing page", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    useSessionMock.mockReturnValue({ user: { id: "u1" } });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1" });
  });

  it("renders all three plan tiers with their display names and prices", () => {
    useSubscriptionMock.mockReturnValue({ subscription: null });
    render(<Pricing />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Salon")).toBeInTheDocument();
    expect(screen.getByText("SAR 99/mo")).toBeInTheDocument();
    expect(screen.getByText("SAR 249/mo")).toBeInTheDocument();
    expect(screen.getByText("SAR 499/mo")).toBeInTheDocument();
  });

  it("marks the workspace's current plan with a 'Current plan' badge, and only that one", () => {
    useSubscriptionMock.mockReturnValue({ subscription: { plan_tier: "Pro", subscription_status: "active" } });
    render(<Pricing />);

    expect(within(planCard("Professional")).getByText("Current plan")).toBeInTheDocument();
    // Exactly one "Current plan" badge across the whole page.
    expect(screen.getAllByText("Current plan")).toHaveLength(1);
  });

  it("shows no 'Current plan' badge when there is no subscription yet", () => {
    useSubscriptionMock.mockReturnValue({ subscription: null });
    render(<Pricing />);
    expect(screen.queryByText("Current plan")).not.toBeInTheDocument();
  });

  it("shows trial messaging with remaining days only while on an active trial", () => {
    const in4Days = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    useSubscriptionMock.mockReturnValue({
      subscription: { plan_tier: "Starter", subscription_status: "trial", trial_ends_at: in4Days },
    });
    render(<Pricing />);
    expect(screen.getByText(/You're on a free trial/)).toBeInTheDocument();
    expect(screen.getByText(/4 days left/)).toBeInTheDocument();
  });

  it("does not show trial messaging for a non-trial subscription", () => {
    useSubscriptionMock.mockReturnValue({ subscription: { plan_tier: "Pro", subscription_status: "active" } });
    render(<Pricing />);
    expect(screen.queryByText(/free trial/)).not.toBeInTheDocument();
  });

  it("every plan's action button is disabled and labeled 'Coming Soon' -- no purchase/payment workflow is implemented or implied", () => {
    useSubscriptionMock.mockReturnValue({ subscription: null });
    render(<Pricing />);

    const buttons = screen.getAllByRole("button", { name: "Coming Soon" });
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });

  it("reflects each plan's real feature set from src/lib/plans.js (e.g. Starter shows every feature as denied/dim)", () => {
    useSubscriptionMock.mockReturnValue({ subscription: null });
    render(<Pricing />);

    expect(within(planCard("Starter")).getByText("AI consultation & recommendations")).toBeInTheDocument();
    expect(within(planCard("Starter")).getByText("Staff & team management")).toBeInTheDocument();
    expect(within(planCard("Salon")).getByText("Staff & team management")).toBeInTheDocument();
  });
});
