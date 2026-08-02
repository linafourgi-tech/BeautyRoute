import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

import { RouteUnavailableError, planRoute, rerouteRoute } from "./route";

function fakeErrorContext(payload: unknown) {
  return {
    clone: () => ({ json: async () => payload }),
  };
}

describe("Route service layer (mocked route-planner Edge Function boundary)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invokeMock.mockReset();
    // route.ts's entire reason for existing is that the frontend never talks
    // to Mapbox directly -- assert that boundary holds by failing hard if
    // fetch is ever touched here.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("route.ts must never make a real network request directly -- it must go through supabase.functions.invoke");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("request payloads", () => {
    beforeEach(() => {
      invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    });

    it("planRoute sends action=plan with workspaceId, date, and optional start/end locations", async () => {
      await planRoute("ws-1", "2026-08-02", "123 Start St", "456 End Ave");
      expect(invokeMock).toHaveBeenCalledWith("route-planner", {
        body: { action: "plan", workspaceId: "ws-1", date: "2026-08-02", startLocation: "123 Start St", endLocation: "456 End Ave" },
      });
    });

    it("planRoute omits start/end as undefined when not provided (not silently defaulted to empty strings)", async () => {
      await planRoute("ws-1", "2026-08-02");
      expect(invokeMock).toHaveBeenCalledWith("route-planner", {
        body: { action: "plan", workspaceId: "ws-1", date: "2026-08-02", startLocation: undefined, endLocation: undefined },
      });
    });

    it("rerouteRoute sends action=reroute with workspaceId, date, and the requested stop order", async () => {
      await rerouteRoute("ws-1", "2026-08-02", ["appt-3", "appt-1", "appt-2"], "123 Start St");
      expect(invokeMock).toHaveBeenCalledWith("route-planner", {
        body: {
          action: "reroute",
          workspaceId: "ws-1",
          date: "2026-08-02",
          order: ["appt-3", "appt-1", "appt-2"],
          startLocation: "123 Start St",
          endLocation: undefined,
        },
      });
    });
  });

  describe("success response shaping", () => {
    it("planRoute returns the raw data payload as-is (typed, not reshaped)", async () => {
      const payload = { ok: true, workspaceName: "Jane's Salon", routeable: [], missingAddress: [], unresolved: [] };
      invokeMock.mockResolvedValue({ data: payload, error: null });
      const result = await planRoute("ws-1", "2026-08-02");
      expect(result).toEqual(payload);
    });
  });

  describe("error propagation", () => {
    it("throws RouteUnavailableError with the code/message from a parseable error context (e.g. route_too_large)", async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { context: fakeErrorContext({ ok: false, code: "route_too_large", error: "This route has too many stops to optimize at once (max 23)." }) },
      });

      await expect(planRoute("ws-1", "2026-08-02")).rejects.toMatchObject({
        code: "route_too_large",
        message: "This route has too many stops to optimize at once (max 23).",
      });
      await expect(planRoute("ws-1", "2026-08-02")).rejects.toBeInstanceOf(RouteUnavailableError);
    });

    it("throws RouteUnavailableError('stale_route', ...) for a rejected reroute, without special-casing it client-side", async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { context: fakeErrorContext({ ok: false, code: "stale_route", error: "This route no longer matches the workspace's current appointments. Please reload the route for this date." }) },
      });

      await expect(rerouteRoute("ws-1", "2026-08-02", ["foreign-id"])).rejects.toMatchObject({ code: "stale_route" });
    });

    it("throws a generic RouteUnavailableError when the error has no context to parse", async () => {
      invokeMock.mockResolvedValue({ data: null, error: {} });
      await expect(planRoute("ws-1", "2026-08-02")).rejects.toMatchObject({
        code: "unknown",
        message: "The route planner is unavailable right now.",
      });
    });

    it("throws RouteUnavailableError using data.code/data.error when invoke resolves without error but data.ok is false", async () => {
      invokeMock.mockResolvedValue({ data: { ok: false, code: "workspace_forbidden", error: "You don't have access to this workspace." }, error: null });
      await expect(planRoute("ws-1", "2026-08-02")).rejects.toMatchObject({
        code: "workspace_forbidden",
        message: "You don't have access to this workspace.",
      });
    });
  });
});
