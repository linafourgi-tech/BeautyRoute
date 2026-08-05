import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getClientsMock = vi.fn();
const getRevenueSeriesMock = vi.fn();
const getExpensesSeriesMock = vi.fn();

// Layout renders Sidebar + TrialBanner, which independently resolve
// session/workspace/subscription state (see StylistDashboard.test.jsx for
// the same full mock set -- Layout is shared by both pages).
vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/clients", () => ({ getClients: (...a) => getClientsMock(...a) }));
vi.mock("../services/revenue", () => ({ getRevenueSeries: (...a) => getRevenueSeriesMock(...a) }));
vi.mock("../services/expenses", () => ({ getExpensesSeries: (...a) => getExpensesSeriesMock(...a) }));

import BusinessEngine from "./BusinessEngine";

const CLIENT_ROW = (overrides = {}) => ({
  id: "c1",
  full_name: "Amira Al-Fahad",
  created_at: "2024-01-15T00:00:00.000Z",
  ...overrides,
});

const SERIES_POINT = (overrides = {}) => ({ monthKey: "2026-08", label: "Aug", total: 0, ...overrides });

function renderPage() {
  return render(
    <MemoryRouter>
      <BusinessEngine />
    </MemoryRouter>
  );
}

describe("BusinessEngine page", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    getClientsMock.mockReset();
    getRevenueSeriesMock.mockReset();
    getExpensesSeriesMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara Al-Otaibi" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
    getClientsMock.mockResolvedValue([]);
    getRevenueSeriesMock.mockResolvedValue([]);
    getExpensesSeriesMock.mockResolvedValue([]);
  });

  it("renders real revenue/expense totals summed from the (mocked) service-layer series, not fixed numbers", async () => {
    getRevenueSeriesMock.mockResolvedValue([SERIES_POINT({ monthKey: "2026-07", label: "Jul", total: 4200 }), SERIES_POINT({ total: 5600 })]);
    getExpensesSeriesMock.mockResolvedValue([SERIES_POINT({ monthKey: "2026-07", label: "Jul", total: 900 }), SERIES_POINT({ total: 1200 })]);
    renderPage();

    expect(await screen.findByText("SAR 9,800")).toBeInTheDocument(); // revenue: 4200 + 5600
    expect(screen.getByText("SAR 2,100")).toBeInTheDocument(); // expenses: 900 + 1200
    expect(screen.getByText("SAR 7,700")).toBeInTheDocument(); // net: 9800 - 2100
    expect(getRevenueSeriesMock).toHaveBeenCalledWith("ws-1");
    expect(getExpensesSeriesMock).toHaveBeenCalledWith("ws-1");
  });

  it("renders SAR 0 (a real, honest empty state) when a new workspace has no revenue or expenses yet", async () => {
    getRevenueSeriesMock.mockResolvedValue([SERIES_POINT({ total: 0 })]);
    getExpensesSeriesMock.mockResolvedValue([SERIES_POINT({ total: 0 })]);
    renderPage();

    expect(await screen.findByText("Revenue (6 mo)")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("SAR 0").length).toBeGreaterThan(0));
  });

  it("lists real clients under 'Longest-standing clients', ordered by earliest created_at, not the old fixed mock order", async () => {
    getClientsMock.mockResolvedValue([CLIENT_ROW()]);
    renderPage();
    expect(await screen.findByText("Longest-standing clients")).toBeInTheDocument();
    // Must never be mislabeled as a loyalty/engagement measure -- ranking
    // is tenure-only (created_at), not visit count or any real loyalty signal.
    expect(screen.queryByText(/loyal/i)).not.toBeInTheDocument();
  });

  it("orders longest-standing clients by earliest created_at, not the old fixed mock order", async () => {
    getClientsMock.mockResolvedValue([
      CLIENT_ROW({ id: "c1", full_name: "Newest Client", created_at: "2026-06-01T00:00:00.000Z" }),
      CLIENT_ROW({ id: "c2", full_name: "Oldest Client", created_at: "2023-01-01T00:00:00.000Z" }),
    ]);
    renderPage();

    const oldest = await screen.findByText("Oldest Client");
    const newest = await screen.findByText("Newest Client");
    // Oldest (longest-standing) must appear before Newest in document order.
    expect(oldest.compareDocumentPosition(newest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("client since 2023-01-01")).toBeInTheDocument();
  });

  it("shows an empty state when the workspace has no clients yet", async () => {
    getClientsMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No clients yet")).toBeInTheDocument();
  });

  it("shows a service-layer error state with retry instead of business content", async () => {
    getRevenueSeriesMock.mockRejectedValue(new Error("Couldn't reach the business data."));
    const refresh = vi.fn();
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false, error: null, refresh });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Couldn't reach the business data.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not query anything when there is no current workspace yet", async () => {
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: null, loading: false, error: null, refresh: vi.fn() });
    renderPage();

    await waitFor(() => expect(screen.getByText("No clients yet")).toBeInTheDocument());
    expect(getRevenueSeriesMock).not.toHaveBeenCalled();
    expect(getExpensesSeriesMock).not.toHaveBeenCalled();
    expect(getClientsMock).not.toHaveBeenCalled();
  });

  it("REGRESSION: no hardcoded mock revenue/client data remains on the page", async () => {
    getRevenueSeriesMock.mockResolvedValue([SERIES_POINT({ total: 9999 })]);
    getExpensesSeriesMock.mockResolvedValue([SERIES_POINT({ total: 1500 })]);
    getClientsMock.mockResolvedValue([CLIENT_ROW({ full_name: "Real Client From Supabase" })]);
    renderPage();

    expect(await screen.findByText("Real Client From Supabase")).toBeInTheDocument();
    expect(screen.queryByText("Nour Al-Faisal")).not.toBeInTheDocument();
    expect(screen.queryByText("Rana Bakhsh")).not.toBeInTheDocument();
    expect(screen.queryByText("Dana Al-Qahtani")).not.toBeInTheDocument();
    expect(screen.getByText("SAR 9,999")).toBeInTheDocument(); // revenue
    expect(screen.getByText("SAR 1,500")).toBeInTheDocument(); // expenses
    expect(screen.getByText("SAR 8,499")).toBeInTheDocument(); // net
  });
});
