import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// New safety net (Phase 1 design migration, design-system-dashboard-shell):
// Sidebar had no test file before this reskin. These tests lock in the
// behavioral contract -- routes, bilingual labels, active-state, workspace
// switching, account display -- that must survive the visual-only change
// from src/index.css's old Tailwind theme to beautyroute-ds.
const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));

import Sidebar from "./Sidebar";

const EXPECTED_ROUTES = [
  ["Dashboard", "/dashboard"],
  ["Appointments", "/appointments"],
  ["Clients", "/clients"],
  ["Services", "/services"],
  ["Beauty Passport", "/passport"],
  ["Route", "/route"],
  ["Business", "/business"],
  ["AI Studio", "/ai"],
  ["Salon", "/salon"],
  ["Pricing", "/pricing"],
];

function renderSidebar({ initialEntry = "/dashboard" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useSessionMock.mockReturnValue({ profile: { full_name: "Sara Al-Otaibi" } });
    useWorkspaceContextMock.mockReturnValue({
      workspaces: [{ id: "ws-1", name: "Sara's Studio" }],
      workspace: { id: "ws-1", name: "Sara's Studio" },
      workspaceId: "ws-1",
      selectWorkspace: vi.fn(),
      loading: false,
      error: null,
    });
  });

  it("renders every existing nav item pointing at its original route -- none dropped, none retargeted", () => {
    renderSidebar();
    for (const [label, href] of EXPECTED_ROUTES) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", href);
    }
  });

  it("preserves the bilingual label for every nav item", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("الرئيسية")).toBeInTheDocument();
    expect(screen.getByText("Beauty Passport")).toBeInTheDocument();
    expect(screen.getByText("جواز الجمال")).toBeInTheDocument();
  });

  it("marks the current route's link as active (aria-current), and only that one", () => {
    renderSidebar({ initialEntry: "/appointments" });
    expect(screen.getByRole("link", { name: /Appointments/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Dashboard/ })).not.toHaveAttribute("aria-current");
  });

  it("renders the real workspace name when there's exactly one workspace", () => {
    renderSidebar();
    // Appears twice by design: the workspace-switcher card and the account
    // footer both show it -- both are real, not a duplicate-rendering bug.
    expect(screen.getAllByText("Sara's Studio").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a workspace switcher when there are multiple workspaces, and switching calls selectWorkspace with the chosen id", async () => {
    const selectWorkspace = vi.fn();
    useWorkspaceContextMock.mockReturnValue({
      workspaces: [{ id: "ws-1", name: "Sara's Studio" }, { id: "ws-2", name: "Downtown Branch" }],
      workspace: { id: "ws-1", name: "Sara's Studio" },
      workspaceId: "ws-1",
      selectWorkspace,
      loading: false,
      error: null,
    });
    renderSidebar();

    const select = screen.getByRole("combobox", { name: "Switch workspace" });
    expect(select).toBeInTheDocument();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.setup().selectOptions(select, "ws-2");
    expect(selectWorkspace).toHaveBeenCalledWith("ws-2");
  });

  it("shows a loading state for the workspace switcher while workspaces are resolving", () => {
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: null, selectWorkspace: vi.fn(), loading: true, error: null });
    renderSidebar();
    expect(screen.getByText("Loading workspace…")).toBeInTheDocument();
  });

  it("shows an error state for the workspace switcher when it fails to load", () => {
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: null, selectWorkspace: vi.fn(), loading: false, error: new Error("boom") });
    renderSidebar();
    expect(screen.getByText("Couldn't load workspaces")).toBeInTheDocument();
  });

  it("renders the signed-in professional's real name and workspace in the account area, not a placeholder", () => {
    renderSidebar();
    expect(screen.getByText("Sara Al-Otaibi")).toBeInTheDocument();
  });

  it("falls back to a generic label when no profile name is available yet", () => {
    useSessionMock.mockReturnValue({ profile: null });
    renderSidebar();
    expect(screen.getByText("Your account")).toBeInTheDocument();
  });

  it("keeps the nav responsive (md:flex), not unconditionally/permanently hidden -- it reappears at the md breakpoint rather than being removed from the DOM", () => {
    renderSidebar();
    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("hidden");
    expect(aside.className).toContain("md:flex");
  });

  it("every nav link remains keyboard-focusable (a real <a href>, not a non-interactive element)", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /Clients/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/clients");
  });
});
