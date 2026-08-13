import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// New safety net (Phase 1 design migration, design-system-dashboard-shell):
// Layout had no test file before this reskin. Sidebar itself is fully
// covered in Sidebar.test.jsx, so this mocks it out here to keep these
// tests focused on what Layout itself is responsible for: rendering
// children/title/subtitle, hosting TrialBanner, and not owning any routing
// or business logic of its own.
const useSessionMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));

import Layout from "./Layout";

function renderLayout(props = {}) {
  return render(
    <MemoryRouter>
      <Layout {...props}>
        <div>Real page content</div>
      </Layout>
    </MemoryRouter>
  );
}

describe("Layout", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    useWorkspaceContextMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara Al-Otaibi" }, loading: false });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { subscription_status: "active" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({
      workspaces: [{ id: "ws-1", name: "Sara's Studio" }],
      workspace: { id: "ws-1", name: "Sara's Studio" },
      workspaceId: "ws-1",
      selectWorkspace: vi.fn(),
      loading: false,
      error: null,
    });
  });

  it("renders its children -- the real routed page content, not a placeholder", () => {
    renderLayout();
    expect(screen.getByText("Real page content")).toBeInTheDocument();
  });

  it("renders the title and Arabic title when provided", () => {
    renderLayout({ title: "Good to see you, Sara", titleAr: "أهلاً بك" });
    expect(screen.getByText("Good to see you, Sara")).toBeInTheDocument();
    expect(screen.getByText("أهلاً بك")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    renderLayout({ subtitle: "Your route, your day." });
    expect(screen.getByText("Your route, your day.")).toBeInTheDocument();
  });

  it("renders no page heading at all when neither title nor subtitle is passed -- doesn't invent one", () => {
    renderLayout();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("hosts the Sidebar as a real navigation landmark", () => {
    renderLayout();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("shows the TrialBanner when the workspace is on an active trial", () => {
    useSubscriptionMock.mockReturnValue({
      subscription: { subscription_status: "trial", trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      loading: false,
    });
    renderLayout();
    expect(screen.getByText(/free trial ends/)).toBeInTheDocument();
  });

  it("does not show the TrialBanner for an active, non-trial subscription", () => {
    renderLayout();
    expect(screen.queryByText(/free trial ends/)).not.toBeInTheDocument();
    expect(screen.queryByText(/trial has ended/)).not.toBeInTheDocument();
  });
});
