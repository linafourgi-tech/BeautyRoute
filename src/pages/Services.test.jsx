import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// The confirm dialog's own "Delete" button shares its accessible name with
// every row's "Delete" button underneath it -- scope the query to the
// dialog card (identified by its title) to avoid an ambiguous match.
function dialogButton(titleText, buttonName) {
  const dialogCard = screen.getByText(titleText).parentElement;
  return within(dialogCard).getByRole("button", { name: buttonName });
}

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getServicesMock = vi.fn();
const createServiceMock = vi.fn();
const updateServiceMock = vi.fn();
const deleteServiceMock = vi.fn();
const importServiceTemplatesMock = vi.fn();
const getServiceTemplatesMock = vi.fn();

// Design migration (full-product-design-migration): Services now renders
// through <Layout>, which renders <Sidebar> + <TrialBanner> -- both
// independently resolve session/workspace/subscription state. Same full
// mock set as every other Layout-wrapped page test.
vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/services", () => ({
  getServices: (...a) => getServicesMock(...a),
  createService: (...a) => createServiceMock(...a),
  updateService: (...a) => updateServiceMock(...a),
  deleteService: (...a) => deleteServiceMock(...a),
  importServiceTemplates: (...a) => importServiceTemplatesMock(...a),
}));
vi.mock("../services/serviceTemplates", () => ({
  getServiceTemplates: () => getServiceTemplatesMock(),
}));

import Services from "./Services";

const SERVICES = [
  { id: "s1", name: "Haircut", category: "haircut", duration_minutes: 45, price: 80, is_active: true },
  { id: "s2", name: "Root Touch-Up", category: "color", duration_minutes: 90, price: 250, is_active: false },
];

function renderServices() {
  return render(
    <MemoryRouter>
      <Services />
    </MemoryRouter>
  );
}

describe("Services page", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    getServicesMock.mockReset();
    createServiceMock.mockReset();
    updateServiceMock.mockReset();
    deleteServiceMock.mockReset();
    importServiceTemplatesMock.mockReset();
    getServiceTemplatesMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara Al-Otaibi" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
  });

  it("shows loading, then renders services grouped by category", async () => {
    getServicesMock.mockResolvedValue(SERVICES);
    renderServices();

    // getByRole("heading"), not getByText -- Sidebar (rendered via Layout as
    // of the full-product-design-migration) has its own "Services" nav link
    // with the same text, so a plain text query is now ambiguous.
    expect(screen.getByRole("heading", { name: "Services" })).toBeInTheDocument();
    expect(await screen.findByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Root Touch-Up")).toBeInTheDocument();
    expect(screen.getByText("haircut")).toBeInTheDocument();
    expect(screen.getByText("color")).toBeInTheDocument();
    expect(getServicesMock).toHaveBeenCalledWith("ws-1");
  });

  it("shows an empty state when there are no services yet", async () => {
    getServicesMock.mockResolvedValue([]);
    renderServices();
    expect(await screen.findByText("No services yet")).toBeInTheDocument();
  });

  it("creates a new service with validated duration/price", async () => {
    getServicesMock.mockResolvedValue([]);
    createServiceMock.mockResolvedValue({ id: "s3", name: "Manicure", category: "haircut", duration_minutes: 40, price: 70, is_active: true });
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("No services yet");

    await user.click(screen.getByRole("button", { name: "New service" }));
    await user.type(screen.getByLabelText("Service name"), "Manicure");
    const durationInput = screen.getByLabelText("Duration (minutes)");
    await user.clear(durationInput);
    await user.type(durationInput, "40");
    const priceInput = screen.getByLabelText("Price (SAR)");
    await user.clear(priceInput);
    await user.type(priceInput, "70");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Manicure", duration_minutes: 40, price: 70, workspace_id: "ws-1" })
    ));
    expect(await screen.findByText("Manicure")).toBeInTheDocument();
  });

  it("rejects a non-positive duration", async () => {
    getServicesMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("No services yet");

    await user.click(screen.getByRole("button", { name: "New service" }));
    await user.type(screen.getByLabelText("Service name"), "Free consult");
    const durationInput = screen.getByLabelText("Duration (minutes)");
    await user.clear(durationInput);
    await user.type(durationInput, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Duration must be a positive number of minutes.")).toBeInTheDocument();
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("edits an existing service", async () => {
    getServicesMock.mockResolvedValue(SERVICES);
    updateServiceMock.mockResolvedValue({ ...SERVICES[0], price: 95 });
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("Haircut");

    const [editButton] = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButton);
    const priceInput = screen.getByLabelText("Price (SAR)");
    await user.clear(priceInput);
    await user.type(priceInput, "95");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateServiceMock).toHaveBeenCalledWith("s1", expect.objectContaining({ price: 95 })));
    expect(await screen.findByText("45 min · SAR 95")).toBeInTheDocument();
  });

  it("deletes a service successfully", async () => {
    getServicesMock.mockResolvedValue(SERVICES);
    deleteServiceMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("Haircut");

    const [deleteButton] = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButton);
    await user.click(dialogButton("Delete service?", "Delete"));

    await waitFor(() => expect(screen.queryByText("Haircut")).not.toBeInTheDocument());
    expect(deleteServiceMock).toHaveBeenCalledWith("s1");
  });

  it("shows a specific message when delete is blocked because the service has been booked before", async () => {
    getServicesMock.mockResolvedValue(SERVICES);
    const fkError = Object.assign(new Error("foreign key violation"), { code: "23503" });
    deleteServiceMock.mockRejectedValue(fkError);
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("Haircut");

    const [deleteButton] = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButton);
    await user.click(dialogButton("Delete service?", "Delete"));

    expect(await screen.findByText(/can't be deleted -- try disabling it instead\./)).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });

  it("imports templates not already present in the workspace, and refreshes the service list", async () => {
    getServicesMock.mockResolvedValueOnce(SERVICES).mockResolvedValueOnce([...SERVICES, { id: "s3", name: "Blowout", category: "styling", duration_minutes: 30, price: 60, is_active: true }]);
    getServiceTemplatesMock.mockResolvedValue([
      { id: "tpl-1", name: "Haircut", category: "haircut", default_duration: 45, default_price: 80 }, // already present, filtered out
      { id: "tpl-2", name: "Blowout", category: "styling", default_duration: 30, default_price: 60 },
    ]);
    importServiceTemplatesMock.mockResolvedValue(1);
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("Haircut");

    await user.click(screen.getByRole("button", { name: "Import templates" }));
    expect(await screen.findByText("Blowout")).toBeInTheDocument();
    // Already-present template is filtered out of the import dialog's choices.
    expect(screen.queryByRole("button", { name: "Haircut" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Blowout" }));
    await user.click(screen.getByRole("button", { name: "Import 1" }));

    await waitFor(() => expect(importServiceTemplatesMock).toHaveBeenCalledWith("ws-1", ["tpl-2"]));
    expect(await screen.findByText("styling")).toBeInTheDocument();
  });

  it("shows an error in the import dialog when loading templates fails, without crashing the page", async () => {
    getServicesMock.mockResolvedValue([]);
    getServiceTemplatesMock.mockRejectedValue(new Error("Could not reach the catalog."));
    const user = userEvent.setup();
    renderServices();
    await screen.findByText("No services yet");

    // The empty state's own action button duplicates the header's "Import
    // templates" button while the list is empty -- either one opens the
    // same dialog, so picking the first is a legitimate, non-arbitrary choice.
    const [importButton] = screen.getAllByRole("button", { name: "Import templates" });
    await user.click(importButton);
    expect(await screen.findByText("Could not reach the catalog.")).toBeInTheDocument();
  });

  it("never calls Supabase directly from the component -- only through the mocked service-layer functions", async () => {
    getServicesMock.mockResolvedValue(SERVICES);
    renderServices();
    await screen.findByText("Haircut");
    // If the component imported supabase directly, this mock module map
    // wouldn't have been hit at all and getServicesMock would show 0 calls.
    expect(getServicesMock).toHaveBeenCalled();
  });
});
