import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureGate } from "./FeatureGate";

// Deliberately uses the REAL hasFeature() from services/subscription.ts
// (not mocked) -- this test exists specifically to verify the component
// wiring honors the real plan-gating decision, not a stubbed one.

describe("FeatureGate", () => {
  it("renders children when the workspace's plan includes the feature", () => {
    render(
      <FeatureGate subscription={{ plan_tier: "Pro", subscription_status: "active" }} feature="ai">
        <span>AI panel</span>
      </FeatureGate>
    );
    expect(screen.getByText("AI panel")).toBeInTheDocument();
  });

  it("renders the fallback (default null) when the plan does not include the feature", () => {
    const { container } = render(
      <FeatureGate subscription={{ plan_tier: "Starter", subscription_status: "active" }} feature="ai">
        <span>AI panel</span>
      </FeatureGate>
    );
    expect(screen.queryByText("AI panel")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a custom fallback when provided and the feature is denied", () => {
    render(
      <FeatureGate
        subscription={{ plan_tier: "Starter", subscription_status: "active" }}
        feature="routing"
        fallback={<span>Upgrade to unlock routing</span>}
      >
        <span>Route planner</span>
      </FeatureGate>
    );
    expect(screen.queryByText("Route planner")).not.toBeInTheDocument();
    expect(screen.getByText("Upgrade to unlock routing")).toBeInTheDocument();
  });

  it("denies every feature once the subscription is expired, even on the Studio plan", () => {
    render(
      <FeatureGate subscription={{ plan_tier: "Studio", subscription_status: "expired" }} feature="staff">
        <span>Staff management</span>
      </FeatureGate>
    );
    expect(screen.queryByText("Staff management")).not.toBeInTheDocument();
  });
});
