import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getSubscriptionMock = vi.fn();
vi.mock("../services/subscription", async () => {
  const actual = await vi.importActual<typeof import("../services/subscription")>("../services/subscription");
  return { ...actual, getSubscription: (id: string) => getSubscriptionMock(id) };
});

import { useSubscription } from "./useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    getSubscriptionMock.mockReset();
  });

  it("no-ops (not loading, null subscription) when workspaceId is null -- doesn't fetch", async () => {
    const { result } = renderHook(() => useSubscription(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toBeNull();
    expect(getSubscriptionMock).not.toHaveBeenCalled();
  });

  it("starts loading and resolves the subscription for a given workspaceId", async () => {
    getSubscriptionMock.mockResolvedValue({ id: "ws-1", plan_tier: "Pro", subscription_status: "active" });

    const { result } = renderHook(() => useSubscription("ws-1"));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toEqual({ id: "ws-1", plan_tier: "Pro", subscription_status: "active" });
    expect(result.current.error).toBeNull();
    expect(getSubscriptionMock).toHaveBeenCalledWith("ws-1");
  });

  it("surfaces an error without crashing, leaving subscription null", async () => {
    getSubscriptionMock.mockRejectedValue(new Error("workspace not found"));

    const { result } = renderHook(() => useSubscription("ws-missing"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.subscription).toBeNull();
  });

  it("re-fetches when workspaceId changes", async () => {
    getSubscriptionMock.mockResolvedValue({ id: "ws-1", plan_tier: "Starter", subscription_status: "trial" });
    const { result, rerender } = renderHook(({ id }) => useSubscription(id), { initialProps: { id: "ws-1" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSubscriptionMock).toHaveBeenCalledWith("ws-1");

    getSubscriptionMock.mockResolvedValue({ id: "ws-2", plan_tier: "Studio", subscription_status: "active" });
    rerender({ id: "ws-2" });

    await waitFor(() => expect(result.current.subscription?.id).toBe("ws-2"));
    expect(getSubscriptionMock).toHaveBeenCalledWith("ws-2");
  });
});
