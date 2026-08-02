import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessStep } from "./BusinessStep";

const EMPTY = { businessType: "freelancer", fullName: "", businessName: "", phone: "", city: "", avatarFile: null, avatarPreviewUrl: "" };

// BusinessStep is a controlled component (value/onChange) -- a stateful
// wrapper is needed so typed input is actually reflected back into it
// across multiple interactions, the same way the real Onboarding.jsx page
// drives it.
function Harness({ initial = EMPTY, onNext = () => {}, onBack = () => {} }) {
  const [value, setValue] = useState(initial);
  return <BusinessStep value={value} onChange={setValue} onNext={onNext} onBack={onBack} />;
}

describe("BusinessStep", () => {
  it("renders both business-type options and the required fields", () => {
    render(<Harness />);
    expect(screen.getByText("Freelancer / mobile professional")).toBeInTheDocument();
    expect(screen.getByText("Salon / studio")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Business name")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
  });

  it("shows validation errors and does not call onNext when required fields are empty", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Business name is required.")).toBeInTheDocument();
    expect(screen.getByText("City is required.")).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("does not require a phone number", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);

    await user.type(screen.getByLabelText("Full name"), "Sara Al-Otaibi");
    await user.type(screen.getByLabelText("Business name"), "Sara's Beauty Studio");
    await user.type(screen.getByLabelText("City"), "Riyadh");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("submits business info (calls onNext) once all required fields are filled", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);

    await user.type(screen.getByLabelText("Full name"), "Sara Al-Otaibi");
    await user.type(screen.getByLabelText("Business name"), "Sara's Beauty Studio");
    await user.type(screen.getByLabelText("Phone number"), "+966500000000");
    await user.type(screen.getByLabelText("City"), "Riyadh");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("toggles business type between freelancer and salon", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const salonButton = screen.getByRole("button", { name: "Salon / studio" });
    const freelancerButton = screen.getByRole("button", { name: "Freelancer / mobile professional" });

    await user.click(salonButton);
    // Selected state is style-driven (no aria-pressed in source) -- assert
    // via the actual style attribute the component sets on selection.
    expect(salonButton).toHaveStyle({ color: "var(--ivory-100)" });
    expect(freelancerButton).not.toHaveStyle({ color: "var(--ivory-100)" });
  });

  it("calls onBack when Back is clicked, without requiring valid fields", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<Harness onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
