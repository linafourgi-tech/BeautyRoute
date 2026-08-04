import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getCurrentUserMock = vi.fn();
const getProfileMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock("../services/auth", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));
vi.mock("../services/profiles", () => ({
  getProfile: (id) => getProfileMock(id),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => onAuthStateChangeMock(cb),
    },
  },
}));

import { SessionProvider } from "./SessionContext";
import { useSessionContext } from "./useSessionContext";
import { useSession } from "../hooks/useSession";

function wrapper({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe("useSessionContext / SessionProvider", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getProfileMock.mockReset();
    onAuthStateChangeMock.mockReset();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
  });

  it("throws when used outside a SessionProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSessionContext())).toThrow(
      "useSessionContext must be used within a SessionProvider"
    );
    spy.mockRestore();
  });

  it("starts in a loading state", () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSessionContext(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("resolves user and profile together on success", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1", email: "jane@example.com" });
    getProfileMock.mockResolvedValue({ id: "user-1", full_name: "Jane Doe", onboarding_completed: true });

    const { result } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual({ id: "user-1", email: "jane@example.com" });
    expect(result.current.profile).toEqual({ id: "user-1", full_name: "Jane Doe", onboarding_completed: true });
    expect(getProfileMock).toHaveBeenCalledWith("user-1");
  });

  it("resolves to a signed-out state when getCurrentUser rejects (e.g. AuthSessionMissingError)", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("Auth session missing!"));

    const { result } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it("does not fetch a profile when there is no current user", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it("refresh() re-resolves user and profile on demand", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: false });

    const { result } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);

    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: true });
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.profile).toEqual({ id: "user-1", onboarding_completed: true }));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
  });

  it("REGRESSION: re-fetches on auth state changes, same as WorkspaceProvider's pattern", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    let authCallback;
    onAuthStateChangeMock.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: () => {} } } };
    });

    const { result } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);

    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: true });
    await act(async () => {
      authCallback();
    });

    await waitFor(() => expect(result.current.user).toEqual({ id: "user-1" }));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
  });

  it("REGRESSION: the context value is memoized -- unchanged fields keep the same object identity across an unrelated re-render", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: true });

    const { result, rerender } = renderHook(() => useSessionContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });
});

describe("useSession (thin wrapper over useSessionContext)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getProfileMock.mockReset();
    onAuthStateChangeMock.mockReset();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
  });

  it("exposes the same user/profile/loading/refresh shape as the context", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1", full_name: "Jane Doe" });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual({ id: "user-1" });
    expect(result.current.profile).toEqual({ id: "user-1", full_name: "Jane Doe" });
    expect(typeof result.current.refresh).toBe("function");
  });

  it("throws outside a SessionProvider, same as the underlying context (no separate no-provider fallback)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSession())).toThrow("useSessionContext must be used within a SessionProvider");
    spy.mockRestore();
  });

  it("REGRESSION: two components consuming useSession() share one fetch instead of each fetching independently", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1" });

    function useTwoConsumers() {
      const a = useSession();
      const b = useSession();
      return { a, b };
    }

    const { result } = renderHook(() => useTwoConsumers(), { wrapper });
    await waitFor(() => expect(result.current.a.loading).toBe(false));

    // Both call sites see the same resolved data, from exactly one
    // underlying getCurrentUser()/getProfile() call pair -- not two.
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(getProfileMock).toHaveBeenCalledTimes(1);
    expect(result.current.a.user).toEqual(result.current.b.user);
  });
});
