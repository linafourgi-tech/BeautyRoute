import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingProgress } from "./OnboardingProgress";

describe("OnboardingProgress", () => {
  it("shows the label for the current step", () => {
    render(<OnboardingProgress step={0} />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("shows the correct label for each step index", () => {
    const labels = ["Welcome", "Business", "Services", "Availability", "Ready!"];
    labels.forEach((label, step) => {
      const { unmount } = render(<OnboardingProgress step={step} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it("renders one dot per step, labeled for accessibility", () => {
    render(<OnboardingProgress step={2} />);
    expect(screen.getByLabelText("Welcome")).toBeInTheDocument();
    expect(screen.getByLabelText("Business")).toBeInTheDocument();
    expect(screen.getByLabelText("Services")).toBeInTheDocument();
    expect(screen.getByLabelText("Availability")).toBeInTheDocument();
    expect(screen.getByLabelText("Ready!")).toBeInTheDocument();
  });
});
