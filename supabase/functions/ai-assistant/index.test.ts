import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authUserResponse,
  captureHandler,
  FAKE_CLIENT_ID,
  FAKE_OTHER_WORKSPACE_ID,
  FAKE_VISIT_ID,
  FAKE_WORKSPACE_ID,
  jsonRes,
  postRequest,
  stubFetch,
  workspaceRow,
} from "../_shared/edgeTestUtils.ts";

Deno.env.set("SUPABASE_URL", "https://fake.supabase.local");
Deno.env.set("SUPABASE_ANON_KEY", "fake-anon-key");
// ANTHROPIC_API_KEY is deliberately left unset for most tests -- see the
// "no real Anthropic calls" tests below for why that's the point, not an
// oversight: every non-Anthropic validation/authorization check in the
// handler is provable without ever reaching the point where a real
// Anthropic call could occur.

const FUNCTION_URL = "https://fake.functions.local/ai-assistant";
// import() inside captureHandler() resolves relative to edgeTestUtils.ts's
// own location, not this file's -- resolve an absolute URL here instead.
const handler = await captureHandler(new URL("./index.ts", import.meta.url).href);

function authHeader(token = "faketoken") {
  return { Authorization: `Bearer ${token}` };
}

Deno.test("rejects a request with no Authorization header", async () => {
  const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }));
  assertEquals(res.status, 401);
  assertObjectMatch(await res.json(), { ok: false, code: "unauthenticated" });
});

Deno.test("rejects an unsupported action", async () => {
  const restore = stubFetch({ "/auth/v1/user": () => authUserResponse("user-invalid-action") });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "delete_everything", workspaceId: FAKE_WORKSPACE_ID }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "invalid_action" });
  } finally {
    restore();
  }
});

Deno.test("rejects an invalid (non-UUID) workspaceId", async () => {
  const restore = stubFetch({ "/auth/v1/user": () => authUserResponse("user-invalid-ws") });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: "not-a-uuid", message: "hi" }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "invalid_workspace" });
  } finally {
    restore();
  }
});

Deno.test("rejects a session where the token doesn't resolve to a real user", async () => {
  const restore = stubFetch({ "/auth/v1/user": () => jsonRes({ msg: "invalid token" }, 401) });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 401);
    assertObjectMatch(await res.json(), { ok: false, code: "unauthenticated" });
  } finally {
    restore();
  }
});

Deno.test("enforces workspace membership -- a workspace the caller can't see via RLS (empty result) is 403 workspace_forbidden", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-not-a-member"),
    "/rest/v1/workspaces": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_OTHER_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "workspace_forbidden" });
  } finally {
    restore();
  }
});

Deno.test("plan-gates the ai feature -- a Starter-plan workspace is rejected server-side even if the frontend UI would have hidden the button", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-starter-plan"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow({ plan_tier: "Starter" })]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "feature_not_available" });
  } finally {
    restore();
  }
});

Deno.test("plan-gates an expired Pro-plan workspace the same as Starter (expiry overrides tier)", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-expired-plan"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow({ plan_tier: "Pro", subscription_status: "expired" })]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "feature_not_available" });
  } finally {
    restore();
  }
});

Deno.test("validates client ownership -- a client that doesn't belong to this workspace (RLS returns nothing) is 403 client_forbidden", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-client-check"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/clients": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "client_summary", workspaceId: FAKE_WORKSPACE_ID, clientId: FAKE_CLIENT_ID }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "client_forbidden" });
  } finally {
    restore();
  }
});

Deno.test("rejects an invalid (non-UUID) clientId before ever querying the database", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-bad-client-id"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "client_summary", workspaceId: FAKE_WORKSPACE_ID, clientId: "not-a-uuid" }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "invalid_client" });
  } finally {
    restore();
  }
});

Deno.test("validates visit ownership -- a visit that doesn't belong to this workspace is 403 visit_forbidden", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-visit-check"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/visits": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "aftercare", workspaceId: FAKE_WORKSPACE_ID, visitId: FAKE_VISIT_ID }, authHeader()));
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "visit_forbidden" });
  } finally {
    restore();
  }
});

Deno.test("aftercare with a valid visit but no linked service returns a specific, non-generic error", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-visit-no-service"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "/rest/v1/visits": () => jsonRes([{ id: FAKE_VISIT_ID, visit_date: "2026-07-01", summary_notes: null, formula_data: null, products_used: null, workspace_id: FAKE_WORKSPACE_ID, appointments: null }]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "aftercare", workspaceId: FAKE_WORKSPACE_ID, visitId: FAKE_VISIT_ID }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "no_service" });
  } finally {
    restore();
  }
});

Deno.test("rejects an empty chat message", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-empty-message"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "   " }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "empty_message" });
  } finally {
    restore();
  }
});

Deno.test("rejects a chat message over the length limit", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-long-message"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "x".repeat(2001) }, authHeader()));
    assertEquals(res.status, 400);
    assertObjectMatch(await res.json(), { ok: false, code: "message_too_long" });
  } finally {
    restore();
  }
});

Deno.test("a fully valid request payload passes every check and reaches the provider gate (no service-role key used anywhere)", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-valid-payload"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "What's on today?" }, authHeader()));
    // ANTHROPIC_API_KEY is unset in this test run -- reaching
    // provider_unconfigured (rather than any 4xx validation error) proves
    // every auth/workspace/plan/input check above it passed.
    assertEquals(res.status, 503);
    assertObjectMatch(await res.json(), { ok: false, code: "provider_unconfigured" });
  } finally {
    restore();
  }
});

Deno.test("never uses a service-role key -- the scoped Supabase client only ever forwards the caller's own Authorization header", async () => {
  let capturedAuthHeader: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("/auth/v1/user")) return authUserResponse("user-no-service-role");
    if (url.includes("/rest/v1/workspaces")) {
      capturedAuthHeader = new Headers(init?.headers).get("authorization");
      return jsonRes([workspaceRow()]);
    }
    throw new Error(`Unmocked fetch in test: ${url}`);
  }) as typeof fetch;
  try {
    await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader("caller-own-jwt")));
  } finally {
    globalThis.fetch = originalFetch;
  }
  // Never "Bearer <service-role-key>" -- always exactly the JWT the caller sent.
  assertEquals(capturedAuthHeader, "Bearer caller-own-jwt");
});

Deno.test("operational logging (console.log) never includes prompt text, message content, or model responses", async () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-log-check"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow({ plan_tier: "Starter" })]),
  });
  const secretMessage = "super-secret-client-detail-should-never-be-logged";
  try {
    await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: secretMessage }, authHeader()));
  } finally {
    console.log = originalLog;
    restore();
  }
  const joined = logs.join("\n");
  assertEquals(joined.includes(secretMessage), false);
  // Sanity: logging did actually happen (the feature_not_available path logs).
  assertEquals(logs.some((l) => l.includes("feature_not_available")), true);
});

Deno.test("no real Anthropic calls occur -- stubFetch throws if anything tries to reach api.anthropic.com", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-no-anthropic"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    // Deliberately no route for api.anthropic.com -- if the handler ever
    // reached it, stubFetch's catch-all throw would fail this test instead
    // of silently succeeding.
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 503); // provider_unconfigured, not a real Anthropic call
  } finally {
    restore();
  }
});

Deno.test("rate-limit: the 21st request within the window from the same user is rejected, independent of any other check", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-rate-limit-test"),
    // Fails fast at workspace lookup for every call -- checkRateLimit() runs
    // BEFORE this check in the handler, so if rate limiting works, the 21st
    // call is rejected with 429 before ever reaching this 403 path, and if
    // it didn't work, all 21 calls would come back 403 instead.
    "/rest/v1/workspaces": () => jsonRes([]),
  });
  try {
    let last: Response | null = null;
    for (let i = 0; i < 21; i++) {
      last = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
      if (i < 20) assertEquals(last.status, 403, `call #${i + 1} should still be under the limit`);
    }
    assertEquals(last!.status, 429);
    assertObjectMatch(await last!.json(), { ok: false, code: "rate_limited" });
  } finally {
    restore();
  }
});

Deno.test("provider error handling: a 429 from Anthropic is mapped to provider_rate_limited, not a generic 500", async () => {
  Deno.env.set("ANTHROPIC_API_KEY", "fake-anthropic-key");
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-provider-error"),
    "/rest/v1/workspaces": () => jsonRes([workspaceRow()]),
    "api.anthropic.com": () => jsonRes({ type: "error", error: { type: "rate_limit_error", message: "Rate limited" } }, 429),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 429);
    assertObjectMatch(await res.json(), { ok: false, code: "provider_rate_limited" });
  } finally {
    restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});
