import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const sendAssistantMessageMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/ai", async () => {
  const actual = await vi.importActual("../services/ai");
  return { ...actual, sendAssistantMessage: (...a) => sendAssistantMessageMock(...a) };
});

import AIEngine from "./AIEngine";

function renderWithLocale(locale) {
  const workspace = { id: "ws-1", name: "Sara's Studio", locale };
  useWorkspaceContextMock.mockReturnValue({ workspaces: [workspace], workspace, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
  useCurrentWorkspaceMock.mockReturnValue({ workspace, workspaceId: "ws-1", loading: false });
  return render(
    <MemoryRouter initialEntries={["/ai"]}>
      <AIEngine />
    </MemoryRouter>
  );
}

describe("AIEngine chat bubbles (text direction)", () => {
  let fetchSpy;
  const originalScrollTo = Element.prototype.scrollTo;

  beforeEach(() => {
    // jsdom doesn't implement Element.scrollTo, which the page calls to keep
    // the latest message in view -- a no-op stand-in for this test file only.
    Element.prototype.scrollTo = vi.fn();
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    sendAssistantMessageMock.mockReset();
    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara" }, loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { plan_tier: "Pro", subscription_status: "active" }, loading: false });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("AIEngine must never make a real network request -- only the mocked service layer");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    Element.prototype.scrollTo = originalScrollTo;
  });

  it("renders an Arabic reply in a dir=\"auto\" bubble in an Arabic workspace, and sends only workspaceId/message/history (no language field)", async () => {
    sendAssistantMessageMock.mockResolvedValue({ text: "لديك موعدان اليوم." });
    renderWithLocale("ar");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("رسالة"), "What's on today?");
    await user.click(screen.getByRole("button", { name: "إرسال" }));

    const reply = await screen.findByText("لديك موعدان اليوم.");
    expect(reply).toHaveAttribute("dir", "auto");
    expect(screen.getByText("What's on today?")).toHaveAttribute("dir", "auto");
    expect(sendAssistantMessageMock).toHaveBeenCalledWith("ws-1", "What's on today?", []);
  });

  it("renders an English reply in a dir=\"auto\" bubble in an English workspace", async () => {
    sendAssistantMessageMock.mockResolvedValue({ text: "You have two appointments today." });
    renderWithLocale("en");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message"), "ما هي مواعيد اليوم؟");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("You have two appointments today.")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("ما هي مواعيد اليوم؟")).toHaveAttribute("dir", "auto");
  });
});
