import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getCurrentUserMock = vi.fn();
const getProfileMock = vi.fn();

vi.mock("../services/auth", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));
vi.mock("../services/profiles", () => ({
  getProfile: (id: string) => getProfileMock(id),
}));

import { useSession } from "./useSession";

describe("useSession", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getProfileMock.mockReset();
  });

  it("starts in a loading state", () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSession());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("resolves user and profile together on success", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1", email: "jane@example.com" });
    getProfileMock.mockResolvedValue({ id: "user-1", full_name: "Jane Doe", onboarding_completed: true });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual({ id: "user-1", email: "jane@example.com" });
    expect(result.current.profile).toEqual({ id: "user-1", full_name: "Jane Doe", onboarding_completed: true });
    expect(getProfileMock).toHaveBeenCalledWith("user-1");
  });

  it("resolves to a signed-out state when getCurrentUser rejects (e.g. AuthSessionMissingError)", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("Auth session missing!"));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it("does not fetch a profile when there is no current user", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it("refresh() re-resolves user and profile on demand", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: false });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);

    getProfileMock.mockResolvedValue({ id: "user-1", onboarding_completed: true });
    await result.current.refresh();

    await waitFor(() => expect(result.current.profile).toEqual({ id: "user-1", onboarding_completed: true }));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
  });
});
