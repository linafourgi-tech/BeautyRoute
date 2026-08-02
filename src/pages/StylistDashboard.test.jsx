import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getAppointmentsMock = vi.fn();
const getClientsMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/WorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/appointments", () => ({ getAppointments: (...a) => getAppointmentsMock(...a) }));
vi.mock("../services/clients", () => ({ getClients: (...a) => getClientsMock(...a) }));

import StylistDashboard from "./StylistDashboard";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

const APPT_ROW = (overrides = {}) => ({
  id: "a1",
  client_id: "c1",
  start_time: `${todayISODate()}T10:00:00.000Z`,
  location_address: "Al Narjis, Riyadh",
  status: "confirmed",
  clients: { full_name: "Amira Al-Fahad" },
  appointment_services: [{ services: { name: "Haircut" } }],
  ...overrides,
});

const CLIENT_ROW = (overrides = {}) => ({ id: "c1", full_name: "Amira Al-Fahad", last_visit_at: null, ...overrides });

function renderDashboard() {
  return render(
    <MemoryRouter>
      <StylistDashboard />
    </MemoryRouter>
  );
}

describe("StylistDashboard page", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    getAppointmentsMock.mockReset();
    getClientsMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara Al-Otaibi" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
  });

  it("shows a loading title, then greets the signed-in professional by real profile data once loaded", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();

    expect(screen.getByText("Good to see you")).toBeInTheDocument();
    expect(await screen.findByText("Good to see you, Sara")).toBeInTheDocument();
  });

  it("renders today's appointments from real (mocked) service data", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    getClientsMock.mockResolvedValue([CLIENT_ROW()]);
    renderDashboard();

    expect(await screen.findByText(/Amira Al-Fahad/)).toBeInTheDocument();
    expect(getAppointmentsMock).toHaveBeenCalledWith("ws-1");
    expect(getClientsMock).toHaveBeenCalledWith("ws-1");
  });

  it("shows an empty state when nothing is scheduled today", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();
    expect(await screen.findByText("No visits scheduled today")).toBeInTheDocument();
  });

  it("shows a service-layer error state with retry instead of dashboard content", async () => {
    getAppointmentsMock.mockRejectedValue(new Error("Couldn't reach the dashboard data."));
    getClientsMock.mockResolvedValue([]);
    const refresh = vi.fn();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh });
    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByText("Couldn't reach the dashboard data.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reflects the real client count in 'active client passports', not a fixed number", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([CLIENT_ROW({ id: "c1" }), CLIENT_ROW({ id: "c2", full_name: "Bayan Saleh" })]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    expect(screen.getByText("active client passports")).toBeInTheDocument();
  });

  it("searches clients by name and navigates to their Beauty Passport", async () => {
    getAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([CLIENT_ROW(), CLIENT_ROW({ id: "c2", full_name: "Bayan Saleh" })]);
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => expect(getClientsMock).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/Search a client's Beauty Passport/), "bayan");
    expect(await screen.findByText("Bayan Saleh")).toBeInTheDocument();
    expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument();
  });

  it("DESIGN ISSUE (reported, not fixed): 'revenue so far' and the average rating are hardcoded, not derived from any real data -- they don't change no matter what the mocked services return", async () => {
    getAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    getClientsMock.mockResolvedValue([CLIENT_ROW(), CLIENT_ROW({ id: "c2" }), CLIENT_ROW({ id: "c3" })]);
    renderDashboard();
    await screen.findByText(/Amira Al-Fahad/);

    // Regardless of the 3 real clients and 1 real appointment supplied above,
    // these two values are static string literals in StylistDashboard.jsx --
    // see the Step 5 report for full detail. This test exists to make that
    // fact visible and catch it if it silently changes, not to certify it as
    // correct behavior.
    expect(screen.getByText("SAR 5,600")).toBeInTheDocument();
    expect(screen.getByText("revenue so far")).toBeInTheDocument();
    expect(screen.getByText("4.9 ★")).toBeInTheDocument();
    expect(screen.getByText("average client rating")).toBeInTheDocument();
  });
});
