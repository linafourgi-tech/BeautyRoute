import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilityStep } from "./AvailabilityStep";

const DEFAULT = {
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  startTime: "09:00",
  endTime: "18:00",
};

function Harness({ initial = DEFAULT, onNext = () => {}, onBack = () => {} }) {
  const [value, setValue] = useState(initial);
  return <AvailabilityStep value={value} onChange={setValue} onNext={onNext} onBack={onBack} />;
}

describe("AvailabilityStep", () => {
  it("renders all seven days and the start/end time inputs, reflecting the initial value", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Monday")).toBeChecked();
    expect(screen.getByLabelText("Saturday")).not.toBeChecked();
    expect(screen.getByLabelText("Sunday")).not.toBeChecked();
    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End time")).toHaveValue("18:00");
  });

  it("toggles a day off/on via keyboard-accessible checkbox (Space)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const monday = screen.getByLabelText("Monday");
    expect(monday).toBeChecked();
    monday.focus();
    await user.keyboard(" ");
    expect(monday).not.toBeChecked();

    const saturday = screen.getByLabelText("Saturday");
    expect(saturday).not.toBeChecked();
    saturday.focus();
    await user.keyboard(" ");
    expect(saturday).toBeChecked();
  });

  it("updates start and end time via the time inputs", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const start = screen.getByLabelText("Start time");
    await user.clear(start);
    await user.type(start, "08:30");
    expect(start).toHaveValue("08:30");
  });

  it("submits availability (calls onNext) when Continue is clicked -- no required-selection validation exists", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<Harness onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
