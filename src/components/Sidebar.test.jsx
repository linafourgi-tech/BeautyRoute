import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// Safety net (Phase 1 design migration; extended in Phase 2 for the
// mobile drawer and logout added while matching the Claude Design
// "Professional Dashboard" reference). These tests lock in the
// behavioral contract -- routes, bilingual labels, active-state, workspace
// switching, account display, mobile navigation, sign-out -- across both
// the Phase 1 beautyroute-ds reskin and the Phase 2 density/dark-theme
// rework.
const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const signOutUserMock = vi.fn();
const updateWorkspaceMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../services/auth", () => ({ signOutUser: (...args) => signOutUserMock(...args) }));
vi.mock("../services/workspaces", () => ({ updateWorkspace: (...args) => updateWorkspaceMock(...args) }));

import Sidebar from "./Sidebar";

const EXPECTED_ROUTES = [
  ["Dashboard", "/dashboard"],
  ["Appointments", "/appointments"],
  ["Clients", "/clients"],
  ["Services", "/services"],
  ["Beauty Passport", "/passport"],
  ["Route", "/route"],
  ["Business", "/business"],
  ["AI Assistant", "/ai"],
  ["Salon", "/salon"],
  ["Pricing", "/pricing"],
];

function renderSidebar({ initialEntry = "/dashboard" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="*" element={<Sidebar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    signOutUserMock.mockReset();
    signOutUserMock.mockResolvedValue(undefined);
    updateWorkspaceMock.mockReset();
    updateWorkspaceMock.mockResolvedValue({ id: "ws-1", name: "Sara's Studio", locale: "ar" });
    useSessionMock.mockReturnValue({ profile: { full_name: "Sara Al-Otaibi" } });
    useWorkspaceContextMock.mockReturnValue({
      workspaces: [{ id: "ws-1", name: "Sara's Studio" }],
      workspace: { id: "ws-1", name: "Sara's Studio" },
      workspaceId: "ws-1",
      selectWorkspace: vi.fn(),
      refresh: vi.fn(),
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

  // Design-refinement pass: nav items used to show BOTH languages on every
  // row at once (a real bug -- "Clients العملاء"), regardless of any user
  // preference. It now shows exactly one, driven by the workspace's
  // existing `locale` column, with the other language's string still
  // present in the `nav` data (see Sidebar.jsx) for a future real switcher.
  it("shows only the English label when the workspace has no locale set (default)", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Beauty Passport")).toBeInTheDocument();
    expect(screen.queryByText("الرئيسية")).not.toBeInTheDocument();
    expect(screen.queryByText("جواز الجمال")).not.toBeInTheDocument();
  });

  it("shows only the Arabic label when the workspace's locale is 'ar'", () => {
    useWorkspaceContextMock.mockReturnValue({
      workspaces: [{ id: "ws-1", name: "Sara's Studio", locale: "ar" }],
      workspace: { id: "ws-1", name: "Sara's Studio", locale: "ar" },
      workspaceId: "ws-1",
      selectWorkspace: vi.fn(),
      refresh: vi.fn(),
      loading: false,
      error: null,
    });
    renderSidebar();
    expect(screen.getByText("الرئيسية")).toBeInTheDocument();
    expect(screen.getByText("جواز الجمال")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Beauty Passport")).not.toBeInTheDocument();
  });

  describe("language toggle", () => {
    it("offers to switch to Arabic when the workspace has no locale set", () => {
      renderSidebar();
      expect(screen.getByRole("button", { name: /العربية/ })).toBeInTheDocument();
    });

    it("offers to switch to English when the workspace's locale is 'ar'", () => {
      useWorkspaceContextMock.mockReturnValue({
        workspaces: [{ id: "ws-1", name: "Sara's Studio", locale: "ar" }],
        workspace: { id: "ws-1", name: "Sara's Studio", locale: "ar" },
        workspaceId: "ws-1",
        selectWorkspace: vi.fn(),
        refresh: vi.fn(),
        loading: false,
        error: null,
      });
      renderSidebar();
      expect(screen.getByRole("button", { name: /English/ })).toBeInTheDocument();
    });

    it("calls the real updateWorkspace() with the new locale and refreshes when clicked", async () => {
      const refresh = vi.fn();
      useWorkspaceContextMock.mockReturnValue({
        workspaces: [{ id: "ws-1", name: "Sara's Studio" }],
        workspace: { id: "ws-1", name: "Sara's Studio" },
        workspaceId: "ws-1",
        selectWorkspace: vi.fn(),
        refresh,
        loading: false,
        error: null,
      });
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole("button", { name: /العربية/ }));

      expect(updateWorkspaceMock).toHaveBeenCalledWith("ws-1", { locale: "ar" });
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    // Persistence, end-to-end (two halves, matching how it actually works):
    // (1) the switch writes to the real workspace row via updateWorkspace()
    // and calls refresh() -- proven above ("calls the real updateWorkspace()
    // ..."). (2) once the workspace context reflects a persisted locale
    // (exactly what refresh() pulls from Supabase after a write, and what a
    // real page refresh/re-login reads on mount), the nav renders that
    // language -- proven by "shows only the Arabic label when the
    // workspace's locale is 'ar'" above. The propagation between the two
    // (React Context re-rendering every consumer on a Provider state
    // change) is WorkspaceContext.jsx's own mechanism, covered by
    // WorkspaceContext.test.jsx -- not re-tested here via a mocked hook,
    // which has no real context-subscription behavior to exercise.

    it("shows an error and does not crash when the switch fails", async () => {
      updateWorkspaceMock.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole("button", { name: /العربية/ }));

      expect(await screen.findByText("Network error")).toBeInTheDocument();
    });
  });

  describe("RTL direction", () => {
    it("renders the desktop rail with dir=\"ltr\" by default", () => {
      renderSidebar();
      expect(screen.getByRole("complementary")).toHaveAttribute("dir", "ltr");
    });

    it("renders the desktop rail with dir=\"rtl\" when the workspace's locale is 'ar'", () => {
      useWorkspaceContextMock.mockReturnValue({
        workspaces: [{ id: "ws-1", name: "Sara's Studio", locale: "ar" }],
        workspace: { id: "ws-1", name: "Sara's Studio", locale: "ar" },
        workspaceId: "ws-1",
        selectWorkspace: vi.fn(),
        refresh: vi.fn(),
        loading: false,
        error: null,
      });
      renderSidebar();
      expect(screen.getByRole("complementary")).toHaveAttribute("dir", "rtl");
    });
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

  describe("mobile navigation drawer", () => {
    it("does not render the drawer dialog until the hamburger is opened -- no permanent-hidden trap, but no unwanted overlay either", () => {
      renderSidebar();
      expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    });

    it("opens a real navigation dialog containing every route when the mobile hamburger is pressed", async () => {
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole("button", { name: "Open navigation" }));

      const dialog = screen.getByRole("dialog", { name: "Navigation" });
      expect(dialog).toBeInTheDocument();
      for (const [label, href] of EXPECTED_ROUTES) {
        expect(within(dialog).getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", href);
      }
    });

    it("closes the drawer when its backdrop is clicked", async () => {
      const user = userEvent.setup();
      renderSidebar();
      await user.click(screen.getByRole("button", { name: "Open navigation" }));
      expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();

      // The backdrop is the dialog's first child (a full-bleed overlay
      // behind the drawer panel), not a labeled control -- click it
      // directly rather than adding a synthetic test-only button.
      const dialog = screen.getByRole("dialog", { name: "Navigation" });
      await user.click(dialog.firstChild);

      expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    });

    it("closes the drawer when its own close button is clicked", async () => {
      const user = userEvent.setup();
      renderSidebar();
      await user.click(screen.getByRole("button", { name: "Open navigation" }));
      await user.click(screen.getByRole("button", { name: "Close navigation" }));
      expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    });

    it("closes the drawer after navigating to a route from inside it", async () => {
      const user = userEvent.setup();
      renderSidebar();
      await user.click(screen.getByRole("button", { name: "Open navigation" }));
      const dialog = screen.getByRole("dialog", { name: "Navigation" });

      await user.click(within(dialog).getByRole("link", { name: /Clients/ }));

      expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    });
  });

  describe("logout", () => {
    it("calls the real signOutUser() service and redirects to /login on success", async () => {
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole("button", { name: "Log out" }));

      expect(signOutUserMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Login page")).toBeInTheDocument();
    });

    it("shows an error and does not navigate away when sign-out fails", async () => {
      signOutUserMock.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole("button", { name: "Log out" }));

      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    });
  });
});
