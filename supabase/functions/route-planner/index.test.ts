import { assertEquals, assertObjectMatch, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authUserResponse,
  captureHandler,
  FAKE_APPOINTMENT_ID,
  FAKE_APPOINTMENT_ID_2,
  FAKE_FOREIGN_APPOINTMENT_ID,
  FAKE_OTHER_WORKSPACE_ID,
  FAKE_WORKSPACE_ID,
  jsonRes,
  postRequest,
  stubFetch,
  workspaceRow,
} from "../_shared/edgeTestUtils.ts";

Deno.env.set("SUPABASE_URL", "https://fake.supabase.local");
Deno.env.set("SUPABASE_ANON_KEY", "fake-anon-key");
// MAPBOX_SECRET_TOKEN is deliberately left unset for most tests -- the
// handler checks route_too_large BEFORE the provider-configured check, and
// otherwise short-circuits to provider_unconfigured, which is exactly how
// "no real Mapbox calls" is proven for everything except the tests that
// specifically set a fake token and mock api.mapbox.com below.

const FUNCTION_URL = "https://fake.functions.local/route-planner";
const handler = await captureHandler(new URL("./index.ts", import.meta.url).href);

function authHeader(token = "faketoken") {
  return { Authorization: `Bearer ${token}` };
}

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FAKE_APPOINTMENT_ID,
    start_time: "2026-08-02T10:00:00.000Z",
    status: "confirmed",
    location_address: "123 Main St, Riyadh",
    clients: { full_name: "Amira Al-Fahad" },
    appointment_services: [{ services: { duration_minutes: 45 } }],
    ...overrides,
  };
}

Deno.test("rejects a request with no Authorization header", async () => {
  const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }));
  assertEquals(res.status, 401);
  assertObjectMatch(await res.json(), { ok: false, code: "unauthenticated" });
});

Deno.test("rejects an unsupported action", async () => {
  const restore = stubFetch({ "/auth/v1/user": () => authUserResponse("user-invalid-action") });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "delete_route", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "invalid_action" });
  } finally {
    restore();
  }
});

Deno.test("rejects an invalid date format", async () => {
  const restore = stubFetch({ "/auth/v1/user": () => authUserResponse("user-invalid-date") });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "08/02/2026" }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "invalid_date" });
  } finally {
    restore();
  }
});

Deno.test("enforces workspace membership -- 403 workspace_forbidden when the caller can't see the workspace", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-not-a-member"),
    "/rest/v1/workspaces": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_OTHER_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "workspace_forbidden" });
  } finally {
    restore();
  }
});

Deno.test("plan-gates the routing feature -- a Starter-plan workspace is rejected server-side", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-starter-plan"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow({ plan_tier: "Starter" })]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "feature_not_available" });
  } finally {
    restore();
  }
});

Deno.test("no real Mapbox calls occur when the provider isn't configured -- stubFetch has no route for api.mapbox.com", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-no-mapbox"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 503);
    assertObjectMatch(await res.json(), { ok: false, code: "provider_unconfigured" });
  } finally {
    restore();
  }
});

Deno.test("route_too_large: more routeable stops than MAX_STOPS(23)+2 is rejected before ever checking the Mapbox provider", async () => {
  const manyAppointments = Array.from({ length: 26 }, (_, i) => appointmentRow({
    id: `55555555-5555-5555-5555-55555555${String(i).padStart(4, "0")}`,
    start_time: `2026-08-02T${String(8 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}:00.000Z`,
  }));
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-too-many-stops"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes(manyAppointments),
  });
  try {
    // No MAPBOX_SECRET_TOKEN set -- if route_too_large fires correctly, we
    // never reach the provider_unconfigured branch at all for this request.
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "route_too_large" });
  } finally {
    restore();
  }
});

Deno.test("missing-address appointments are separated into missingAddress, never silently dropped or routed", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-missing-address"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow({ location_address: null })]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.missingAddress.length, 1);
    assertEquals(body.routeable.length, 0);
    assertEquals(body.unresolved.length, 0);
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("low-confidence geocode (relevance < 0.7) is treated as unresolved, not silently accepted", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-low-relevance"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow()]),
    "api.mapbox.com/geocoding": () => jsonRes({ features: [{ center: [46.6, 24.7], relevance: 0.4 }] }),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.unresolved.length, 1);
    assertEquals(body.routeable.length, 0);
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("secret Mapbox token never reaches the response body, even though it's sent in the outbound geocoding request", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "super-secret-mapbox-token-12345");
  let sawTokenInRequest = false;
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-token-leak-check"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow()]),
  });
  const originalFetch = globalThis.fetch;
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("api.mapbox.com")) {
      if (url.includes("super-secret-mapbox-token-12345")) sawTokenInRequest = true;
      return jsonRes({ features: [{ center: [46.6, 24.7], relevance: 0.95 }] });
    }
    return await inner(input, init);
  }) as typeof fetch;
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
    const bodyText = await res.text();
    assertEquals(sawTokenInRequest, true, "sanity check: the token really was sent to Mapbox");
    assertEquals(bodyText.includes("super-secret-mapbox-token-12345"), false);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("cancelled appointments are excluded at the query level -- the appointments request filters to pending/confirmed only", async () => {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("/auth/v1/user")) return authUserResponse("user-cancelled-check");
    if (url.includes("/rest/v1/workspaces")) return jsonRes([workspaceRow()]);
    if (url.includes("/rest/v1/appointments")) {
      capturedUrl = url;
      return jsonRes([]);
    }
    throw new Error(`Unmocked fetch: ${url}`);
  }) as typeof fetch;
  try {
    await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const decoded = decodeURIComponent(capturedUrl);
  assertStringIncludes(decoded, "status=in.(pending,confirmed)");
  assertEquals(decoded.includes("cancelled"), false);
});

Deno.test("timezone-aware date boundaries: a workspace in Asia/Riyadh (UTC+3) queries local-midnight-to-local-midnight, not UTC midnight", async () => {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("/auth/v1/user")) return authUserResponse("user-tz-check");
    if (url.includes("/rest/v1/workspaces")) return jsonRes([workspaceRow({ timezone: "Asia/Riyadh" })]);
    if (url.includes("/rest/v1/appointments")) {
      capturedUrl = url;
      return jsonRes([]);
    }
    throw new Error(`Unmocked fetch: ${url}`);
  }) as typeof fetch;
  try {
    await handler(postRequest(FUNCTION_URL, { action: "plan", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02" }, authHeader()));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const decoded = decodeURIComponent(capturedUrl);
  // Asia/Riyadh is UTC+3 with no DST -- 2026-08-02 00:00 local = 2026-08-01T21:00:00 UTC.
  assertStringIncludes(decoded, "2026-08-01T21:00:00");
  assertStringIncludes(decoded, "2026-08-02T20:59:59");
});

Deno.test("reroute rejects a foreign/nonexistent appointment id as stale_route", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-foreign-id"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "reroute", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02", order: [FAKE_FOREIGN_APPOINTMENT_ID] }, authHeader()));
    assertEquals(res.status, 409);
    assertObjectMatch(await res.json(), { ok: false, code: "stale_route" });
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("reroute rejects a duplicate-id order as stale_route", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-duplicate-id"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow(), appointmentRow({ id: FAKE_APPOINTMENT_ID_2, start_time: "2026-08-02T11:00:00.000Z" })]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "reroute", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02", order: [FAKE_APPOINTMENT_ID, FAKE_APPOINTMENT_ID] }, authHeader()));
    assertEquals(res.status, 409);
    assertObjectMatch(await res.json(), { ok: false, code: "stale_route" });
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("reroute rejects an empty order as stale_route", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-empty-order"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([appointmentRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "reroute", workspaceId: FAKE_WORKSPACE_ID, date: "2026-08-02", order: [] }, authHeader()));
    assertEquals(res.status, 409);
    assertObjectMatch(await res.json(), { ok: false, code: "stale_route" });
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});

Deno.test("reroute accepts a valid SUBSET reorder (client only resubmits successfully-geocoded stops, not every addressed appointment)", async () => {
  Deno.env.set("MAPBOX_SECRET_TOKEN", "fake-mapbox-token");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-valid-subset"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/appointments": () => jsonRes([
      appointmentRow({ id: FAKE_APPOINTMENT_ID, start_time: "2026-08-02T10:00:00.000Z" }),
      appointmentRow({ id: FAKE_APPOINTMENT_ID_2, start_time: "2026-08-02T11:00:00.000Z" }),
      appointmentRow({ id: FAKE_FOREIGN_APPOINTMENT_ID, start_time: "2026-08-02T12:00:00.000Z" }),
    ]),
    "api.mapbox.com/geocoding": () => jsonRes({ features: [{ center: [46.6, 24.7], relevance: 0.95 }] }),
    "api.mapbox.com/directions/v5": () => jsonRes({
      routes: [{ geometry: { type: "LineString", coordinates: [] }, distance: 5000, duration: 900, legs: [{ duration: 900 }, { duration: 900 }] }],
    }),
  });
  try {
    // 3 addressed appointments exist for the day; the client only resubmits
    // 2 of them, reversed -- a legitimate subset in a different order, not
    // the full exact-length set (which the old, buggy check would have
    // rejected -- see Phase 12's Bug 2).
    const res = await handler(postRequest(FUNCTION_URL, {
      action: "reroute",
      workspaceId: FAKE_WORKSPACE_ID,
      date: "2026-08-02",
      order: [FAKE_APPOINTMENT_ID_2, FAKE_APPOINTMENT_ID],
    }, authHeader()));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.order, [FAKE_APPOINTMENT_ID_2, FAKE_APPOINTMENT_ID]);
  } finally {
    restore();
    Deno.env.delete("MAPBOX_SECRET_TOKEN");
  }
});
