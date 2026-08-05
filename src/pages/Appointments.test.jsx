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

// Appointments.jsx resolves its initial "active day" in a SEPARATE render
// pass from the data fetch itself: a useEffect derives `dates` from the
// freshly-fetched appointments, then a second useEffect sets `active` to
// dates[0] once dates is non-empty. Until that second effect fires,
// `dayAppts` (filtered by `active`, still null) is empty, so the UI
// genuinely renders "Nothing booked yet" for one transient render before
// the real list appears -- not a bug (real users see this converge in
// milliseconds), but it means finding a client's name shortly after mount
// depends on two render passes converging, not one. That normally
// completes well within testing-library's default 1000ms findBy timeout,
// but can occasionally exceed it under load (e.g. CI running many test
// files/workers at once), causing a false failure on an otherwise-correct
// render. Traced during the Phase 13 Step 2 CI investigation. This widens
// the search window for exactly that convergence, not a blanket timeout
// increase -- component logic itself is untouched.
const APPOINTMENT_CONVERGENCE_OPTIONS = { timeout: 3000 };

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

    expect(await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS)).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("REGRESSION (Phase 13 Step 4): memoizing dayAppts does not change which appointments show for each day -- switching days still filters correctly", async () => {
    const dayOne = APPT_ROW({ id: "a1", start_time: "2026-08-02T10:00:00.000Z", clients: { full_name: "Amira Al-Fahad" } });
    const dayTwo = APPT_ROW({ id: "a2", start_time: "2026-08-03T09:00:00.000Z", clients: { full_name: "Bayan Saleh" } });
    getAppointmentsMock.mockResolvedValue([dayOne, dayTwo]);
    const user = userEvent.setup();
    renderAppointments();

    // Defaults to the earliest date's tab -- only that day's appointment shows.
    expect(await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS)).toBeInTheDocument();
    expect(screen.queryByText("Bayan Saleh")).not.toBeInTheDocument();

    // Day tabs render before the "New booking" button in DOM order, so the
    // second button here is the second day's tab -- avoids depending on the
    // exact locale-formatted date label text.
    const dayTabs = screen.getAllByRole("button").filter((b) => b.textContent !== "New booking");
    await user.click(dayTabs[1]);

    expect(await screen.findByText("Bayan Saleh")).toBeInTheDocument();
    expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument();
  });

  it("REGRESSION: still asks the service layer for the page's own bounded range (workspaceId only) -- getAppointments() computes its rolling window internally, not something this page passes or narrows to a single day itself", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    renderAppointments();
    await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS);

    // Same call shape as before Phase 13 Step 3 -- the date window is an
    // internal implementation detail of getAppointments() (see
    // services/appointments.test.ts for that proof), not something this
    // page needs to know about or pass itself, so its own call site is
    // untouched.
    expect(getAppointmentsMock).toHaveBeenCalledWith("ws-1");
    expect(getAppointmentsMock).toHaveBeenCalledTimes(1);
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
    await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS);

    await user.click(screen.getByText("Amira Al-Fahad"));
    const modalHeading = await screen.findByText("Edit booking");
    // The underlying appointment row (still rendered behind the modal) also
    // contains the text "Haircut" -- scope the query to the modal form so it
    // can't match the wrong element.
    const form = modalHeading.closest("form");
    // Each service button now has its own real accessible name (fixed via
    // fieldset/legend -- see the regression test below), so it can be found
    // by role/name like any other button.
    const serviceChip = within(form).getByRole("button", { name: "Haircut · 45min" });
    // The service Haircut (s1, from serviceIds) should render as selected --
    // conveyed both visually (bg-wine class) and to assistive tech (aria-pressed).
    expect(serviceChip.className).toContain("bg-wine");
    expect(serviceChip).toHaveAttribute("aria-pressed", "true");
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
    await user.click(screen.getByRole("button", { name: "Haircut · 45min" }));
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    await waitFor(() => expect(createAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: "ws-1", client_id: "c1", status: "pending" })
    ));
    expect(setAppointmentServicesMock).toHaveBeenCalledWith("new-appt-1", ["s1"]);
  });

  it("REGRESSION (accessibility, fixed): each service control has its own distinct accessible name, not all named 'Services'", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    getServicesMock.mockResolvedValue([
      { id: "s1", name: "Haircut", duration_minutes: 45, is_active: true },
      { id: "s2", name: "Blowout", duration_minutes: 30, is_active: true },
      { id: "s3", name: "Color", duration_minutes: 90, is_active: true },
    ]);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Nothing booked yet");

    await user.click(screen.getByRole("button", { name: "New booking" }));
    await screen.findByRole("heading", { name: "New booking" });

    // The old defect: Field wrapped every service button in one shared
    // <label>, so every button's accessible name resolved to "Services"
    // (the field's own label), making them indistinguishable to a screen
    // reader. Each button below must now be independently findable by its
    // own real accessible name.
    const haircut = screen.getByRole("button", { name: "Haircut · 45min" });
    const blowout = screen.getByRole("button", { name: "Blowout · 30min" });
    const color = screen.getByRole("button", { name: "Color · 90min" });
    expect(haircut).toBeInTheDocument();
    expect(blowout).toBeInTheDocument();
    expect(color).toBeInTheDocument();

    // None of them should be named "Services" -- that name now belongs only
    // to the group as a whole (the fieldset/legend), not to any individual button.
    expect(screen.queryByRole("button", { name: "Services" })).not.toBeInTheDocument();

    // The group itself is still correctly labeled "Services" via a native
    // fieldset/legend, exposed as an accessible group -- this is what keeps
    // the field's own label meaningfully associated at the group level.
    expect(screen.getByRole("group", { name: "Services" })).toBeInTheDocument();

    // Each button toggles independently and reflects its own pressed state.
    await user.click(blowout);
    expect(blowout).toHaveAttribute("aria-pressed", "true");
    expect(haircut).toHaveAttribute("aria-pressed", "false");
    expect(color).toHaveAttribute("aria-pressed", "false");
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
    await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalledWith("a1", { status: "cancelled" }));
    expect(await screen.findByText("cancelled")).toBeInTheDocument();
  });

  it("hides the Cancel action for an appointment that is already cancelled", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW({ status: "cancelled" })]);
    renderAppointments();
    await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("deletes an appointment", async () => {
    getAppointmentsMock.mockResolvedValueOnce([APPT_ROW()]).mockResolvedValueOnce([]);
    deleteAppointmentMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAppointments();
    await screen.findByText("Amira Al-Fahad", {}, APPOINTMENT_CONVERGENCE_OPTIONS);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirmCard = screen.getByText("Delete this appointment?").parentElement;
    await user.click(within(confirmCard).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAppointmentMock).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText("Nothing booked yet")).toBeInTheDocument();
  });
});
