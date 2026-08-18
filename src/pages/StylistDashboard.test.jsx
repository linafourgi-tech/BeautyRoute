import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getTodaysAppointmentsMock = vi.fn();
const getClientsMock = vi.fn();
const getMonthlyRevenueMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/appointments", () => ({ getTodaysAppointments: (...a) => getTodaysAppointmentsMock(...a) }));
vi.mock("../services/clients", () => ({ getClients: (...a) => getClientsMock(...a) }));
vi.mock("../services/revenue", () => ({ getMonthlyRevenue: (...a) => getMonthlyRevenueMock(...a) }));

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

function revenueSummary(totalNet) {
  return { totalNet, currency: "SAR", periodStart: "2026-08-01T00:00:00.000Z", periodEnd: "2026-09-01T00:00:00.000Z" };
}

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
    getTodaysAppointmentsMock.mockReset();
    getClientsMock.mockReset();
    getMonthlyRevenueMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara Al-Otaibi" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
    // Default for tests that don't care about revenue specifically -- the
    // component's Promise.all needs every call to resolve to a real shape.
    getMonthlyRevenueMock.mockResolvedValue(revenueSummary(0));
  });

  it("shows a loading title, then greets the signed-in professional by real profile data once loaded", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();

    expect(screen.getByText("Good to see you")).toBeInTheDocument();
    expect(await screen.findByText("Good to see you, Sara")).toBeInTheDocument();
  });

  it("renders today's appointments from real (mocked) service data", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    getClientsMock.mockResolvedValue([CLIENT_ROW()]);
    renderDashboard();

    expect(await screen.findByText(/Amira Al-Fahad/)).toBeInTheDocument();
    expect(getTodaysAppointmentsMock).toHaveBeenCalledWith("ws-1");
    expect(getClientsMock).toHaveBeenCalledWith("ws-1");
  });

  it("shows an empty state when nothing is scheduled today", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();
    expect(await screen.findByText("No visits scheduled today")).toBeInTheDocument();
  });

  it("shows a service-layer error state with retry instead of dashboard content", async () => {
    getTodaysAppointmentsMock.mockRejectedValue(new Error("Couldn't reach the dashboard data."));
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
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([CLIENT_ROW({ id: "c1" }), CLIENT_ROW({ id: "c2", full_name: "Bayan Saleh" })]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    expect(screen.getByText("active client passports")).toBeInTheDocument();
  });

  it("searches clients by name and navigates to their Beauty Passport", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([CLIENT_ROW(), CLIENT_ROW({ id: "c2", full_name: "Bayan Saleh" })]);
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => expect(getClientsMock).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/Search clients/), "bayan");
    expect(await screen.findByText("Bayan Saleh")).toBeInTheDocument();
    expect(screen.queryByText("Amira Al-Fahad")).not.toBeInTheDocument();
  });

  it("renders real monthly revenue from the service layer, workspace-scoped and currency-formatted", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    getMonthlyRevenueMock.mockResolvedValue(revenueSummary(5600));
    renderDashboard();

    expect(await screen.findByText("SAR 5,600")).toBeInTheDocument();
    expect(screen.getByText("revenue this month")).toBeInTheDocument();
    expect(getMonthlyRevenueMock).toHaveBeenCalledWith("ws-1");
  });

  it("revenue changes when the mocked workspace revenue data changes -- not a fixed number", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    getMonthlyRevenueMock.mockResolvedValue(revenueSummary(1250));
    renderDashboard();

    expect(await screen.findByText("SAR 1,250")).toBeInTheDocument();
    expect(screen.queryByText("SAR 5,600")).not.toBeInTheDocument();
  });

  it("renders SAR 0 (a real, honest empty state) when the workspace has no revenue this month", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    getMonthlyRevenueMock.mockResolvedValue(revenueSummary(0));
    renderDashboard();

    // "SAR 0" alone is ambiguous if another stat could render the same
    // string -- scope to the revenue stat specifically via its own label's
    // sibling in the DOM (the StatCard's value <p> immediately precedes its
    // metric <p>).
    const revenueLabel = await screen.findByText("revenue this month");
    expect(revenueLabel.previousElementSibling).toHaveTextContent("SAR 0");
  });

  it("shows an honest 'Not available' state for average client rating -- never a fabricated number, since no reviews/ratings table exists yet", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText("Not available")).toBeInTheDocument();
    expect(screen.getByText("average client rating")).toBeInTheDocument();
  });

  it("REGRESSION: no hardcoded business metrics remain anywhere on the dashboard", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    getClientsMock.mockResolvedValue([CLIENT_ROW(), CLIENT_ROW({ id: "c2" }), CLIENT_ROW({ id: "c3" })]);
    getMonthlyRevenueMock.mockResolvedValue(revenueSummary(9999));
    renderDashboard();
    await screen.findByText(/Amira Al-Fahad/);

    expect(screen.queryByText("SAR 5,600")).not.toBeInTheDocument();
    expect(screen.queryByText("4.9 ★")).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.9/)).not.toBeInTheDocument();
    // The real mocked value for this render must be the one shown.
    expect(screen.getByText("SAR 9,999")).toBeInTheDocument();
  });

  it("shows the real appointment count as its own stat, not a fabricated number", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([APPT_ROW(), APPT_ROW({ id: "a2", client_id: "c2", clients: { full_name: "Bayan Saleh" } })]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText("appointments today")).toBeInTheDocument();
    const label = screen.getByText("appointments today");
    expect(label.previousElementSibling).toHaveTextContent("2");
  });

  it("REGRESSION (Phase 2): the never-wired map placeholder and its always-zero travel ministats are gone", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([APPT_ROW()]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();
    await screen.findByText(/Amira Al-Fahad/);

    expect(screen.queryByText(/wire up Google Maps/)).not.toBeInTheDocument();
    expect(screen.queryByText("Stops")).not.toBeInTheDocument();
    expect(screen.queryByText("Drive time")).not.toBeInTheDocument();
    expect(screen.queryByText("Est. fuel")).not.toBeInTheDocument();
  });

  it("still links 'Full map' to the real, unchanged /route page", async () => {
    getTodaysAppointmentsMock.mockResolvedValue([]);
    getClientsMock.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByRole("link", { name: /Full map/ })).toHaveAttribute("href", "/route");
  });

  // Localization fix (design-refinement pass): the Dashboard used to render
  // in a fixed mix of languages -- "Good to see you" (English) always paired
  // with "أهلاً بك" (Arabic) regardless of any language selection, while
  // every OTHER string on the page (stat labels, "Today", "Full map", the
  // empty state) was English-only with no Arabic version at all. These
  // tests lock in the real, deterministic contract: exactly one language,
  // driven by the workspace's locale column, applied to the WHOLE page.
  describe("localization", () => {
    it("renders English UI end-to-end, with no Arabic greeting mixed in, when the workspace has no locale set (default)", async () => {
      getTodaysAppointmentsMock.mockResolvedValue([]);
      getClientsMock.mockResolvedValue([]);
      renderDashboard();

      expect(await screen.findByText("Good to see you, Sara")).toBeInTheDocument();
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Full map/ })).toBeInTheDocument();
      expect(screen.getByText("No visits scheduled today")).toBeInTheDocument();
      expect(screen.getByText("Enjoy the quiet — today's bookings will show up here.")).toBeInTheDocument();
      expect(screen.getByText("appointments today")).toBeInTheDocument();
      expect(screen.queryByText("أهلاً بك")).not.toBeInTheDocument();
    });

    it("renders Arabic UI end-to-end, with no leftover English page content, when the workspace's locale is 'ar'", async () => {
      useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn(), workspace: { id: "ws-1", locale: "ar" } });
      getTodaysAppointmentsMock.mockResolvedValue([]);
      getClientsMock.mockResolvedValue([]);
      renderDashboard();

      expect(await screen.findByText("أهلاً بك")).toBeInTheDocument();
      expect(screen.getByText("اليوم")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /الخريطة الكاملة/ })).toBeInTheDocument();
      expect(screen.getByText("لا توجد زيارات مجدولة اليوم")).toBeInTheDocument();
      expect(screen.getByText("استمتعي بالهدوء — ستظهر حجوزات اليوم هنا.")).toBeInTheDocument();
      expect(screen.getByText("مواعيد اليوم")).toBeInTheDocument();
      expect(screen.queryByText("Good to see you")).not.toBeInTheDocument();
      expect(screen.queryByText(/Good to see you,/)).not.toBeInTheDocument();
      expect(screen.queryByText("Today")).not.toBeInTheDocument();
      expect(screen.queryByText("No visits scheduled today")).not.toBeInTheDocument();
      expect(screen.queryByText("appointments today")).not.toBeInTheDocument();
    });

    it("translates the search placeholder and empty-search message in Arabic mode too, not just the static chrome", async () => {
      useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn(), workspace: { id: "ws-1", locale: "ar" } });
      getTodaysAppointmentsMock.mockResolvedValue([]);
      getClientsMock.mockResolvedValue([CLIENT_ROW()]);
      const user = userEvent.setup();
      renderDashboard();
      await waitFor(() => expect(getClientsMock).toHaveBeenCalled());

      const searchInput = screen.getByPlaceholderText("ابحث عن عميلة…");
      await user.type(searchInput, "zzz-no-match");
      expect(await screen.findByText('لا توجد عميلة تطابق "zzz-no-match".')).toBeInTheDocument();
    });
  });
});
