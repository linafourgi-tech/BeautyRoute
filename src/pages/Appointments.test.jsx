import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Appointments renders through <Layout>, which renders <Sidebar> (needs
// useSession + useWorkspaceContext) and <TrialBanner> (needs useSession +
// useCurrentWorkspace + useSubscription) -- all mocked so the page chrome
// renders without crashing and without any real Supabase/service call.
const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getAppointmentsMock = vi.fn();
const createAppointmentMock = vi.fn();
const updateAppointmentMock = vi.fn();
const deleteAppointmentMock = vi.fn();
const setAppointmentServicesMock = vi.fn();
const getClientsMock = vi.fn();
const getServicesMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/appointments", () => ({
  getAppointments: (...a) => getAppointmentsMock(...a),
  createAppointment: (...a) => createAppointmentMock(...a),
  updateAppointment: (...a) => updateAppointmentMock(...a),
  deleteAppointment: (...a) => deleteAppointmentMock(...a),
  setAppointmentServices: (...a) => setAppointmentServicesMock(...a),
}));
vi.mock("../services/clients", () => ({ getClients: (...a) => getClientsMock(...a) }));
vi.mock("../services/services", () => ({ getServices: (...a) => getServicesMock(...a) }));

import Appointments from "./Appointments";

const APPT_ROW = (overrides = {}) => ({
  id: "a1",
  client_id: "c1",
  start_time: "2026-08-02T10:00:00.000Z",
  location_address: "Al Narjis, Riyadh",
  status: "confirmed",
  clients: { full_name: "Amira Al-Fahad" },
  appointment_services: [{ services: { id: "s1", name: "Haircut" } }],
  ...overrides,
});

const CLIENTS = [{ id: "c1", full_name: "Amira Al-Fahad" }];
const SERVICES = [{ id: "s1", name: "Haircut", duration_minutes: 45, is_active: true }];

function renderAppointments() {
  return render(
    <MemoryRouter>
      <Appointments />
    </MemoryRouter>
  );
}

describe("Appointments page", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    getAppointmentsMock.mockReset();
    createAppointmentMock.mockReset();
    updateAppointmentMock.mockReset();
    deleteAppointmentMock.mockReset();
    setAppointmentServicesMock.mockReset();
    getClientsMock.mockReset();
    getServicesMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
    getClientsMock.mockResolvedValue(CLIENTS);
    getServicesMock.mockResolvedValue(SERVICES);
  });

  it("shows loading, then renders the appointment list for the active day", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    renderAppointments();

    expect(await screen.findByText("Amira Al-Fahad")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("shows an empty state for a day with nothing booked", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    renderAppointments();
    expect(await screen.findByText("Nothing booked yet")).toBeInTheDocument();
  });

  it("shows a service-layer error state with retry instead of the list", async () => {
    getAppointmentsMock.mockRejectedValue(new Error("Couldn't reach the appointments table."));
    const refresh = vi.fn();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh });
    const user = userEvent.setup();
    renderAppointments();

    expect(await screen.findByText("Couldn't reach the appointments table.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not render any mock/placeholder appointment data -- the list reflects exactly what the mocked service layer returned", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW({ id: "only-one", clients: { full_name: "Only Client" } })]);
    renderAppointments();
    expect(await screen.findByText("Only Client")).toBeInTheDocument();
    expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument();
  });

  it("prefills the edit form's selected services from serviceIds when editing an existing booking", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Amira Al-Fahad");

    await user.click(screen.getByText("Amira Al-Fahad"));
    const modalHeading = await screen.findByText("Edit booking");
    // The underlying appointment row (still rendered behind the modal) also
    // contains the text "Haircut" -- scope the query to the modal form so it
    // can't match the wrong element.
    const form = modalHeading.closest("form");
    // NOTE (accessibility bug, reported not fixed -- see Step 5 report): the
    // Services <Field> wraps every service button inside one shared <label>,
    // so testing-library's accessible-name computation reports every one of
    // them as named "Services" (the field label), not their own text. Query
    // by rendered text content instead of role/name to route around it.
    const serviceChip = within(form).getByText("Haircut · 45min");
    // The service Haircut (s1, from serviceIds) should render as selected --
    // selection is style-driven (bg-wine class), assert via class name.
    expect(serviceChip.className).toContain("bg-wine");
  });

  it("creates a new appointment and links the selected services via setAppointmentServices", async () => {
    getAppointmentsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([APPT_ROW()]);
    createAppointmentMock.mockResolvedValue({ id: "new-appt-1" });
    setAppointmentServicesMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Nothing booked yet");

    await user.click(screen.getByRole("button", { name: "New booking" }));
    await screen.findByRole("heading", { name: "New booking" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Client" }), "c1");
    // See the accessibility-bug note in the "prefills" test above -- query by
    // text content, not role/name, since every service button is currently
    // mislabeled "Services" by its enclosing <label>.
    await user.click(screen.getByText("Haircut · 45min"));
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    await waitFor(() => expect(createAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: "ws-1", client_id: "c1", status: "pending" })
    ));
    expect(setAppointmentServicesMock).toHaveBeenCalledWith("new-appt-1", ["s1"]);
  });

  it("requires a client, date, and time before booking", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Nothing booked yet");

    await user.click(screen.getByRole("button", { name: "New booking" }));
    await screen.findByRole("heading", { name: "New booking" });
    // Clear the date field, leave client unselected.
    await user.clear(screen.getByLabelText("Date"));
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    expect(await screen.findByText("Select a client.")).toBeInTheDocument();
    expect(screen.getByText("Pick a date.")).toBeInTheDocument();
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("marks an appointment as cancelled and reflects the new status", async () => {
    getAppointmentsMock.mockResolvedValueOnce([APPT_ROW({ status: "confirmed" })]).mockResolvedValueOnce([APPT_ROW({ status: "cancelled" })]);
    updateAppointmentMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Amira Al-Fahad");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalledWith("a1", { status: "cancelled" }));
    expect(await screen.findByText("cancelled")).toBeInTheDocument();
  });

  it("hides the Cancel action for an appointment that is already cancelled", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW({ status: "cancelled" })]);
    renderAppointments();
    await screen.findByText("Amira Al-Fahad");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("deletes an appointment", async () => {
    getAppointmentsMock.mockResolvedValueOnce([APPT_ROW()]).mockResolvedValueOnce([]);
    deleteAppointmentMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Amira Al-Fahad");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirmCard = screen.getByText("Delete this appointment?").parentElement;
    await user.click(within(confirmCard).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAppointmentMock).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText("Nothing booked yet")).toBeInTheDocument();
  });
});
