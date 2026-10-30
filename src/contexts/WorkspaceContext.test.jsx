import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getWorkspacesMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("../services/workspaces", () => ({
  getWorkspaces: () => getWorkspacesMock(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => onAuthStateChangeMock(cb),
      getSession: () => getSessionMock(),
    },
  },
}));

function signedInAs(userId) {
  getSessionMock.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

import { WorkspaceProvider } from "./WorkspaceContext";
import { useWorkspaceContext } from "./useWorkspaceContext";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";

function wrapper({ children }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

describe("useWorkspaceContext / WorkspaceProvider", () => {
  beforeEach(() => {
    getWorkspacesMock.mockReset();
    onAuthStateChangeMock.mockReset();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("throws when used outside a WorkspaceProvider", () => {
    // Suppress the expected React error-boundary console noise for this
    // specific negative test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWorkspaceContext())).toThrow(
      "useWorkspaceContext must be used within a WorkspaceProvider"
    );
    spy.mockRestore();
  });

  it("starts loading, then resolves the workspace list and auto-selects the first workspace", async () => {
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-1", name: "Jane's Salon" },
      { id: "ws-2", name: "Second Location" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspaces).toHaveLength(2);
    expect(result.current.workspaceId).toBe("ws-1");
    expect(result.current.workspace).toEqual({ id: "ws-1", name: "Jane's Salon" });
  });

  it("resolves to an empty state (no crash) when the user has no workspaces", async () => {
    getWorkspacesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaces).toEqual([]);
    expect(result.current.workspaceId).toBeNull();
    expect(result.current.workspace).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("surfaces a fetch error without crashing", async () => {
    getWorkspacesMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.workspaces).toEqual([]);
  });

  it("selectWorkspace switches the active workspace and persists the choice to localStorage", async () => {
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-1", name: "First" },
      { id: "ws-2", name: "Second" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspaceId).toBe("ws-1");

    act(() => result.current.selectWorkspace("ws-2"));

    expect(result.current.workspaceId).toBe("ws-2");
    expect(localStorage.getItem("br.selectedWorkspaceId")).toBe("ws-2");
  });

  it("restores a previously-persisted workspace selection on a fresh load, if still valid", async () => {
    localStorage.setItem("br.selectedWorkspaceId", "ws-2");
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-1", name: "First" },
      { id: "ws-2", name: "Second" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-2");
  });

  it("falls back to the first workspace when the persisted id no longer belongs to the user", async () => {
    localStorage.setItem("br.selectedWorkspaceId", "ws-deleted");
    getWorkspacesMock.mockResolvedValue([{ id: "ws-1", name: "First" }]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-1");
  });

  it("with no saved choice, defaults to the first workspace the user OWNS, not the first workspace listed", async () => {
    signedInAs("user-1");
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-salon", name: "Someone else's salon", owner_id: "owner-9" },
      { id: "ws-own", name: "My business", owner_id: "user-1" },
      { id: "ws-own-2", name: "My second", owner_id: "user-1" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-own");
  });

  it("keeps a valid saved choice even when it is a workspace the user does not own", async () => {
    signedInAs("user-1");
    localStorage.setItem("br.selectedWorkspaceId", "ws-salon");
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-own", name: "My business", owner_id: "user-1" },
      { id: "ws-salon", name: "Salon I work at", owner_id: "owner-9" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-salon");
  });

  it("ignores a saved choice the user no longer belongs to and falls back to an owned workspace", async () => {
    signedInAs("user-1");
    localStorage.setItem("br.selectedWorkspaceId", "ws-left");
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-salon", name: "Salon", owner_id: "owner-9" },
      { id: "ws-own", name: "My business", owner_id: "user-1" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-own");
  });

  it("when the user owns none of their workspaces, defaults to the first in the service's fixed order", async () => {
    signedInAs("user-1");
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-a", name: "Salon A", owner_id: "owner-8" },
      { id: "ws-b", name: "Salon B", owner_id: "owner-9" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-a");
  });

  it("is deterministic: the same list and user always produce the same default, across refreshes", async () => {
    signedInAs("user-1");
    const list = [
      { id: "ws-salon", name: "Salon", owner_id: "owner-9" },
      { id: "ws-own", name: "My business", owner_id: "user-1" },
    ];
    getWorkspacesMock.mockResolvedValue(list);

    const first = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    const second = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(first.result.current.workspaceId).toBe("ws-own");
    expect(second.result.current.workspaceId).toBe("ws-own");
  });

  it("still resolves (first in order) if the session lookup fails -- the preference is never load-bearing", async () => {
    getSessionMock.mockRejectedValue(new Error("storage unavailable"));
    getWorkspacesMock.mockResolvedValue([
      { id: "ws-salon", name: "Salon", owner_id: "owner-9" },
      { id: "ws-own", name: "My business", owner_id: "user-1" },
    ]);

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.workspaceId).toBe("ws-salon");
  });

  it("re-fetches on auth state changes (e.g. sign-in after an initial signed-out load)", async () => {
    getWorkspacesMock.mockResolvedValue([]);
    let authCallback;
    onAuthStateChangeMock.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: () => {} } } };
    });

    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getWorkspacesMock).toHaveBeenCalledTimes(1);

    getWorkspacesMock.mockResolvedValue([{ id: "ws-1", name: "New workspace" }]);
    await act(async () => {
      authCallback();
    });

    await waitFor(() => expect(result.current.workspaceId).toBe("ws-1"));
    expect(getWorkspacesMock).toHaveBeenCalledTimes(2);
  });

  it("REGRESSION (Phase 13 Step 4): the context value is memoized -- unchanged fields keep the same object identity across an unrelated re-render", async () => {
    getWorkspacesMock.mockResolvedValue([{ id: "ws-1", name: "Jane's Salon" }]);

    const { result, rerender } = renderHook(() => useWorkspaceContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });
});

describe("useCurrentWorkspace (thin wrapper over useWorkspaceContext)", () => {
  beforeEach(() => {
    getWorkspacesMock.mockReset();
    onAuthStateChangeMock.mockReset();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: null } });
  });

  it("exposes the same workspace/workspaceId/loading/error/refresh shape as the context", async () => {
    getWorkspacesMock.mockResolvedValue([{ id: "ws-1", name: "Jane's Salon" }]);

    const { result } = renderHook(() => useCurrentWorkspace(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-1");
    expect(result.current.workspace).toEqual({ id: "ws-1", name: "Jane's Salon" });
    expect(typeof result.current.refresh).toBe("function");
  });

  it("throws outside a WorkspaceProvider, same as the underlying context (no separate no-provider fallback)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCurrentWorkspace())).toThrow(
      "useWorkspaceContext must be used within a WorkspaceProvider"
    );
    spy.mockRestore();
  });
});
