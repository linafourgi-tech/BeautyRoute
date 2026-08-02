import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getServiceTemplatesMock = vi.fn();
vi.mock("../../../services/serviceTemplates", () => ({
  getServiceTemplates: () => getServiceTemplatesMock(),
}));

import { ServicesStep } from "./ServicesStep";

const TEMPLATES = [
  { id: "tpl-1", category: "Hair", name: "Haircut", default_duration: 45, default_price: 80 },
  { id: "tpl-2", category: "Hair", name: "Blowout", default_duration: 30, default_price: 60 },
  { id: "tpl-3", category: "Nails", name: "Manicure", default_duration: 40, default_price: 70 },
];

function Harness({ initial = [], onNext = () => {}, onBack = () => {} }) {
  const [value, setValue] = useState(initial);
  return <ServicesStep value={value} onChange={setValue} onNext={onNext} onBack={onBack} />;
}

describe("ServicesStep", () => {
  beforeEach(() => {
    getServiceTemplatesMock.mockReset();
  });

  it("shows nothing but the loading placeholder while templates are being fetched -- no EmptyState, no template tags yet", () => {
    getServiceTemplatesMock.mockReturnValue(new Promise(() => {}));
    render(<Harness />);
    // EmptyState explicitly requires !loading in the source -- it must not
    // appear yet, even though there are zero selected services right now.
    expect(screen.queryByText("No services selected yet")).not.toBeInTheDocument();
    // Only the always-present Back/Continue buttons should exist -- no
    // template tags have rendered yet.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("shows an error message when loading templates fails", async () => {
    getServiceTemplatesMock.mockRejectedValue(new Error("Could not reach the catalog."));
    render(<Harness />);
    expect(await screen.findByText("Could not reach the catalog.")).toBeInTheDocument();
  });

  it("groups and renders templates by category once loaded", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    render(<Harness />);

    expect(await screen.findByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Blowout")).toBeInTheDocument();
    expect(screen.getByText("Manicure")).toBeInTheDocument();
    expect(screen.getByText("Hair")).toBeInTheDocument();
    expect(screen.getByText("Nails")).toBeInTheDocument();
  });

  it("shows the empty-selection hint when nothing is selected yet", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    render(<Harness />);
    expect(await screen.findByText("No services selected yet")).toBeInTheDocument();
  });

  it("selecting a service template (Tag, keyboard-accessible) adds it to the selected list with its default duration/price", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    const user = userEvent.setup();
    render(<Harness />);

    const haircutTag = await screen.findByRole("button", { name: "Haircut" });
    expect(haircutTag).toHaveAttribute("aria-pressed", "false");

    haircutTag.focus();
    await user.keyboard("{Enter}");

    expect(haircutTag).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected (1)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Haircut")).toBeInTheDocument();
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
    expect(screen.getByDisplayValue("80")).toBeInTheDocument();
  });

  it("deselecting a template removes it from the selected list", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    const user = userEvent.setup();
    render(<Harness />);

    const haircutTag = await screen.findByRole("button", { name: "Haircut" });
    await user.click(haircutTag);
    expect(screen.getByText("Selected (1)")).toBeInTheDocument();

    await user.click(haircutTag);
    expect(screen.queryByText("Selected (1)")).not.toBeInTheDocument();
    expect(screen.getByText("No services selected yet")).toBeInTheDocument();
  });

  it("allows editing a selected service's name/duration/price before continuing", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    const user = userEvent.setup();
    render(<Harness />);

    const haircutTag = await screen.findByRole("button", { name: "Haircut" });
    await user.click(haircutTag);

    const nameInput = screen.getByDisplayValue("Haircut");
    await user.clear(nameInput);
    await user.type(nameInput, "Deluxe Haircut");
    expect(screen.getByDisplayValue("Deluxe Haircut")).toBeInTheDocument();
  });

  it("continuing (service selection submission) does not require any service to be selected", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);

    await screen.findByText("Haircut");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", async () => {
    getServiceTemplatesMock.mockResolvedValue(TEMPLATES);
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<Harness onBack={onBack} />);

    await screen.findByText("Haircut");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
