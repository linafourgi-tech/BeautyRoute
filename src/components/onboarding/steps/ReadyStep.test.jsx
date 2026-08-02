import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadyStep } from "./ReadyStep";

const BUSINESS = { businessName: "Sara's Beauty Studio", businessType: "freelancer", city: "Riyadh", fullName: "Sara Al-Otaibi", phone: "+966500000000" };
const AVAILABILITY = { days: { mon: true, tue: true, wed: false, thu: false, fri: false, sat: false, sun: false }, startTime: "09:00", endTime: "18:00" };

function renderReady(overrides = {}) {
  const props = {
    business: BUSINESS,
    services: [],
    availability: AVAILABILITY,
    onFinish: vi.fn(),
    onBack: vi.fn(),
    saving: false,
    error: "",
    ...overrides,
  };
  return { ...render(<ReadyStep {...props} />), props };
}

describe("ReadyStep", () => {
  it("renders a summary of the business, services, and availability entered so far", () => {
    renderReady({ services: [{ templateId: "tpl-1", name: "Haircut", duration: 45, price: 80 }] });

    expect(screen.getByText("Sara's Beauty Studio")).toBeInTheDocument();
    expect(screen.getByText(/Freelancer \/ mobile professional/)).toBeInTheDocument();
    expect(screen.getByText(/Riyadh/)).toBeInTheDocument();
    expect(screen.getByText(/Sara Al-Otaibi/)).toBeInTheDocument();
    expect(screen.getByText("Haircut · 45min · SAR 80")).toBeInTheDocument();
    expect(screen.getByText(/Mon, Tue/)).toBeInTheDocument();
    expect(screen.getByText(/09:00–18:00/)).toBeInTheDocument();
  });

  it("shows a placeholder message when no services were selected", () => {
    renderReady({ services: [] });
    expect(screen.getByText("No services selected yet — you can add these anytime.")).toBeInTheDocument();
  });

  it("shows a placeholder message when no working days were selected", () => {
    renderReady({ availability: { days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false }, startTime: "09:00", endTime: "18:00" } });
    expect(screen.getByText("No working days selected yet.")).toBeInTheDocument();
  });

  it("calls onFinish (the final submission) when the finish button is clicked", async () => {
    const { props } = renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to my dashboard" }));
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it("disables both actions and shows a saving label while the finish request is in flight", () => {
    renderReady({ saving: true });
    expect(screen.getByRole("button", { name: "Setting things up…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("shows the error message when the finish request has failed", () => {
    renderReady({ error: "Something went wrong while setting up your workspace." });
    expect(screen.getByText("Something went wrong while setting up your workspace.")).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const { props } = renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
