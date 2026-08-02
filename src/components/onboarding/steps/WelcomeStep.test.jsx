import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeStep } from "./WelcomeStep";

describe("WelcomeStep", () => {
  it("renders the welcome copy and a 'Get started' action", () => {
    render(<WelcomeStep onNext={() => {}} />);
    expect(screen.getByText("Welcome to BeautyRoute")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
  });

  it("calls onNext when 'Get started' is clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeStep onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
