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

// The durable rate limiter is a Postgres RPC (check_rate_limit(), see
// supabase/migrations/20260803140000_durable_rate_limiting.sql) -- from the
// Edge Function's own perspective, all of that lives behind one HTTP call
// to /rest/v1/rpc/check_rate_limit. These tests mock that boundary and
// prove the HANDLER's reaction to it (proceed on true, 429 on false, fail
// open on an error) -- the actual sliding-window counting, atomicity, and
// per-(user, function) isolation live in the SQL function itself, and are
// covered separately by
// supabase/migrations/20260803140000_durable_rate_limiting.test.ts's
// structural assertions against that function's real source.
function rpcRoute(sequence: boolean[]): () => Response {
  let i = 0;
  return () => {
    const allowed = i < sequence.length ? sequence[i] : sequence[sequence.length - 1];
    i += 1;
    return jsonRes(allowed);
  };
}

Deno.test("rate-limit: requests under the limit proceed past the rate limiter to the next check", async () => {
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-under-limit"),
    "/rest/v1/rpc/check_rate_limit": rpcRoute([true]),
    "/rest/v1/workspaces": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    assertEquals(res.status, 403); // workspace_forbidden -- proves it got past the rate limiter
  } finally {
    restore();
  }
});

Deno.test("rate-limit: exact limit boundary -- the 20th request still proceeds, the 21st is rejected", async () => {
  const sequence = [...Array(20).fill(true), false];
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-rate-limit-boundary"),
    "/rest/v1/rpc/check_rate_limit": rpcRoute(sequence),
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

Deno.test("rate-limit: passes its own function name to the limiter, not the caller's -- cross-function isolation", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("/auth/v1/user")) return authUserResponse("user-function-name-check");
    if (url.includes("/rest/v1/rpc/check_rate_limit")) {
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      return jsonRes(true);
    }
    if (url.includes("/rest/v1/workspaces")) return jsonRes([]);
    throw new Error(`Unmocked fetch: ${url}`);
  }) as typeof fetch;
  try {
    await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assertObjectMatch(capturedBody!, { p_function_name: "ai-assistant", p_window_seconds: 600, p_max_requests: 20 });
  // No caller-supplied user id is ever sent -- the database function scopes
  // to auth.uid() from the caller's own forwarded JWT instead, so one
  // user's requests can never be checked or consumed against another's
  // counter from this side either.
  assertEquals(Object.keys(capturedBody!).includes("user_id"), false);
  assertEquals(Object.keys(capturedBody!).includes("p_user_id"), false);
});

Deno.test("rate-limit: fails open (request proceeds) when the limiter RPC itself errors, and logs the failure", async () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  const restore = stubFetch({
    "/auth/v1/user": () => authUserResponse("user-limiter-down"),
    "/rest/v1/rpc/check_rate_limit": () => jsonRes({ message: "connection error" }, 500),
    "/rest/v1/workspaces": () => jsonRes([]),
  });
  try {
    const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }, authHeader()));
    // workspace_forbidden, not rate_limited -- the request proceeded past
    // the rate limiter despite its backend erroring.
    assertEquals(res.status, 403);
    assertObjectMatch(await res.json(), { ok: false, code: "workspace_forbidden" });
  } finally {
    console.log = originalLog;
    restore();
  }
  assertEquals(logs.some((l) => l.includes("rate_limit_check_failed_open")), true);
});

Deno.test("CORS: reflects an allowed configured origin in Access-Control-Allow-Origin", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.beautyroute.example");
  try {
    const res = await handler(new Request(FUNCTION_URL, { method: "OPTIONS", headers: { Origin: "https://app.beautyroute.example" } }));
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://app.beautyroute.example");
    assertEquals(res.headers.get("Vary"), "Origin");
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("CORS: a local dev origin is always allowed even with no ALLOWED_ORIGINS configured", async () => {
  const res = await handler(new Request(FUNCTION_URL, { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } }));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
});

Deno.test("CORS: a disallowed origin gets no Access-Control-Allow-Origin header", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.beautyroute.example");
  try {
    const res = await handler(new Request(FUNCTION_URL, { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("CORS: a request with no Origin header gets no Access-Control-Allow-Origin header but is still processed", async () => {
  const res = await handler(postRequest(FUNCTION_URL, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "hi" }));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  // Still a real, fully-processed response (unauthenticated, in this case)
  // -- CORS header presence is independent of request handling.
  assertEquals(res.status, 401);
});

Deno.test("CORS: OPTIONS preflight returns the right headers and no body", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.beautyroute.example");
  try {
    const res = await handler(new Request(FUNCTION_URL, { method: "OPTIONS", headers: { Origin: "https://app.beautyroute.example" } }));
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assertEquals(res.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type");
    assertEquals(await res.text(), "");
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
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

// ---- Response language follows the workspace's configured locale -------------------------------------------------
// The workspace's locale (set by Sidebar's language switch, read from the
// caller's RLS-scoped workspace row) is authoritative: Arabic workspaces get
// the Arabic rule even for English questions, English workspaces get the
// English rule even for Arabic questions, and nothing in the request body
// can change that. These tests capture the exact request sent to the
// (stubbed) Anthropic API -- no real Anthropic call is ever made.

// The system prompt exactly as it was before this change, with rule 8
// "Respond in English only." Every other line must stay byte-identical.
const PROMPT_BEFORE_LANGUAGE_FIX = "You are the BeautyRoute AI Assistant, a professional assistant for independent beauty professionals and salons using the BeautyRoute app.\n\nHard rules -- follow all of them:\n1. Rely ONLY on the structured context and tool results you are given in this request. Never use outside knowledge about a specific client, appointment, or business.\n2. Never invent facts: do not state or imply an allergy, medical condition, product, formula, previous service, or appointment that was not explicitly present in the supplied data.\n3. If the supplied data is missing or insufficient to answer confidently, say so plainly instead of guessing.\n4. Clearly distinguish established facts (from the data) from your own suggestions or observations. Label suggestions/observations as such.\n5. You are not a medical professional. Never diagnose a skin, hair, scalp, or other health condition, and never recommend a medical treatment. Aftercare guidance must stay general and practical.\n6. Never state that a recommendation or outcome is guaranteed. Use language like \"may help\" or \"consider,\" not \"will.\"\n7. You cannot create, update, cancel, or delete any appointment, client, service, visit, or formula, and you cannot send messages on the professional's behalf. If asked to do one of these, say you can't perform actions -- only look up and summarize information.\n8. Respond in English only.\n9. Keep responses practical, concise, and professional -- this is a business tool, not a casual chatbot.\n10. Do not analyze, describe, or reference any photos -- photo analysis is not available.";
const ENGLISH_RULE = "Respond in English -- the workspace's configured language -- even if the professional writes in another language.";
const ARABIC_RULE = "Respond in Modern Standard Arabic -- the workspace's configured language -- even if the professional writes in another language. Write any headings in Arabic. Keep client names, service names, product names, and dates exactly as they appear in the supplied data.";
const expectedPrompt = (rule: string) => PROMPT_BEFORE_LANGUAGE_FIX.replace("8. Respond in English only.", `8. ${rule}`);

function anthropicMessage(content: unknown[], stopReason: "end_turn" | "tool_use" = "end_turn") {
  return jsonRes({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  });
}
const textReply = (text: string) => anthropicMessage([{ type: "text", text }]);

type AnthropicRequest = { system: string; messages: { role: string; content: unknown }[]; model: string };

// Drives fetch directly: routes Supabase/Auth calls to fixtures and records
// every Anthropic request body. `workspaceOverrides` undefined = no locale
// column value at all (the fixture's default).
function languageHarness(opts: { workspaceOverrides?: Record<string, unknown>; anthropic?: (callIndex: number) => Response }) {
  const anthropicRequests: AnthropicRequest[] = [];
  const workspaceQueryUrls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("api.anthropic.com")) {
      const raw = input instanceof Request ? await input.text() : typeof init?.body === "string" ? init.body : await new Response(init?.body).text();
      anthropicRequests.push(JSON.parse(raw));
      return (opts.anthropic ?? (() => textReply("ok")))(anthropicRequests.length - 1);
    }
    if (url.includes("/auth/v1/user")) return authUserResponse("user-language-check");
    if (url.includes("/rest/v1/rpc/check_rate_limit")) return jsonRes(true);
    if (url.includes("/rest/v1/workspaces")) {
      workspaceQueryUrls.push(decodeURIComponent(url));
      return jsonRes([workspaceRow(opts.workspaceOverrides ?? {})]);
    }
    if (url.includes("/rest/v1/clients")) {
      return jsonRes([{ id: FAKE_CLIENT_ID, full_name: "Noura Al-Harbi", tier: "Gold", allergies: [], internal_notes: null, created_at: "2026-01-01T00:00:00Z", last_visit_at: null, workspace_id: FAKE_WORKSPACE_ID }]);
    }
    if (url.includes("/rest/v1/appointments")) return jsonRes([]);
    if (url.includes("/rest/v1/services")) return jsonRes([]);
    if (url.includes("/rest/v1/visits")) {
      return jsonRes([{
        id: FAKE_VISIT_ID, visit_date: "2026-07-01", summary_notes: "Balayage refresh", formula_data: null, products_used: null, workspace_id: FAKE_WORKSPACE_ID,
        appointments: { appointment_services: [{ services: { name: "Balayage", category: "hair" } }] },
      }]);
    }
    throw new Error(`Unmocked fetch in language test: ${url}`);
  }) as typeof fetch;
  return { anthropicRequests, workspaceQueryUrls, restore: () => { globalThis.fetch = original; } };
}

const ACTION_BODIES: Record<string, Record<string, unknown>> = {
  chat: { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message: "Which clients haven't come back recently?" },
  client_summary: { action: "client_summary", workspaceId: FAKE_WORKSPACE_ID, clientId: FAKE_CLIENT_ID },
  next_visit: { action: "next_visit", workspaceId: FAKE_WORKSPACE_ID, clientId: FAKE_CLIENT_ID },
  aftercare: { action: "aftercare", workspaceId: FAKE_WORKSPACE_ID, visitId: FAKE_VISIT_ID },
};

async function runWithLocale(locale: unknown, body: Record<string, unknown>, anthropic?: (callIndex: number) => Response) {
  Deno.env.set("ANTHROPIC_API_KEY", "fake-anthropic-key");
  const h = languageHarness({ workspaceOverrides: locale === undefined ? undefined : { locale }, anthropic });
  try {
    const res = await handler(postRequest(FUNCTION_URL, body, authHeader()));
    return { res, json: await res.json(), ...h };
  } finally {
    h.restore();
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
}

for (const action of Object.keys(ACTION_BODIES)) {
  Deno.test(`language: ${action} in an Arabic workspace ('ar') sends the Arabic rule and no English-only rule`, async () => {
    const { res, json, anthropicRequests } = await runWithLocale("ar", ACTION_BODIES[action], () => textReply("مرحبا"));
    assertEquals(res.status, 200);
    assertObjectMatch(json, { ok: true, text: "مرحبا" });
    assertEquals(anthropicRequests.length, 1);
    assertEquals(anthropicRequests[0].system, expectedPrompt(ARABIC_RULE));
    assertEquals(anthropicRequests[0].system.includes("English only"), false);
  });

  Deno.test(`language: ${action} in an English workspace ('en') sends the English rule`, async () => {
    const { res, anthropicRequests } = await runWithLocale("en", ACTION_BODIES[action]);
    assertEquals(res.status, 200);
    assertEquals(anthropicRequests.length, 1);
    assertEquals(anthropicRequests[0].system, expectedPrompt(ENGLISH_RULE));
  });
}

for (const [label, locale, rule] of [
  ["regional Arabic tag 'ar-SA'", "ar-SA", ARABIC_RULE],
  ["regional Arabic tag, mixed case and spaces ' AR-sa '", " AR-sa ", ARABIC_RULE],
  ["the column default 'en-SA'", "en-SA", ENGLISH_RULE],
  ["no locale on the row", undefined, ENGLISH_RULE],
  ["null locale", null, ENGLISH_RULE],
  ["an unsupported locale 'fr'", "fr", ENGLISH_RULE],
  ["a near-miss 'arabic' (not an 'ar' tag)", "arabic", ENGLISH_RULE],
  ["a non-string locale", 42, ENGLISH_RULE],
] as Array<[string, unknown, string]>) {
  Deno.test(`language: ${label} resolves to the ${rule === ARABIC_RULE ? "Arabic" : "English"} rule`, async () => {
    const { anthropicRequests } = await runWithLocale(locale, ACTION_BODIES.chat);
    assertEquals(anthropicRequests[0].system, expectedPrompt(rule));
  });
}

for (const [label, locale, message, rule] of [
  ["Arabic workspace, English question", "ar", "Which clients haven't come back recently?", ARABIC_RULE],
  ["English workspace, Arabic question", "en", "من هم العملاء الذين لم يعودوا مؤخرا؟", ENGLISH_RULE],
  ["Arabic workspace, mixed Arabic/English question", "ar", "ما هي مواعيد اليوم for Balayage؟", ARABIC_RULE],
  ["English workspace, mixed English/Arabic question", "en", "What did نورة book last time?", ENGLISH_RULE],
] as Array<[string, string, string, string]>) {
  Deno.test(`language: mixed-language message -- ${label} -- the workspace locale wins and the question is passed through unchanged`, async () => {
    const { anthropicRequests } = await runWithLocale(locale, { action: "chat", workspaceId: FAKE_WORKSPACE_ID, message });
    assertEquals(anthropicRequests[0].system, expectedPrompt(rule));
    const lastUserTurn = anthropicRequests[0].messages.at(-1)!;
    assertEquals(lastUserTurn.role, "user");
    assertEquals(String(lastUserTurn.content).endsWith(message), true);
  });
}

Deno.test("language: the client cannot override the workspace locale through the request body", async () => {
  const overrideAttempt = { locale: "en", lang: "en", language: "English", responseLanguage: "en" };
  const ar = await runWithLocale("ar", { ...ACTION_BODIES.chat, ...overrideAttempt });
  assertEquals(ar.anthropicRequests[0].system, expectedPrompt(ARABIC_RULE));

  const en = await runWithLocale("en", { ...ACTION_BODIES.chat, locale: "ar", lang: "ar", language: "Arabic" });
  assertEquals(en.anthropicRequests[0].system, expectedPrompt(ENGLISH_RULE));
});

Deno.test("language: every call in the chat tool loop carries the same resolved system prompt", async () => {
  const replies = [
    anthropicMessage([{ type: "tool_use", id: "toolu_1", name: "get_todays_appointments", input: {} }], "tool_use"),
    anthropicMessage([{ type: "tool_use", id: "toolu_2", name: "get_inactive_services", input: {} }], "tool_use"),
    textReply("لا توجد مواعيد اليوم."),
  ];
  const { res, json, anthropicRequests } = await runWithLocale("ar", ACTION_BODIES.chat, (i) => replies[i]);
  assertEquals(res.status, 200);
  assertObjectMatch(json, { ok: true, text: "لا توجد مواعيد اليوم." });
  assertEquals(anthropicRequests.length, 3);
  for (const request of anthropicRequests) {
    assertEquals(request.system, expectedPrompt(ARABIC_RULE));
  }
  // Sanity: the loop really did run the tools between calls.
  assertEquals(anthropicRequests[2].messages.length, 5);
});

Deno.test("language: the workspace query selects locale from the RLS-scoped row (alongside the plan fields)", async () => {
  const { workspaceQueryUrls } = await runWithLocale("ar", ACTION_BODIES.chat);
  assertEquals(workspaceQueryUrls.length, 1);
  const select = new URL(workspaceQueryUrls[0]).searchParams.get("select")!.split(",");
  for (const column of ["id", "timezone", "locale", "plan_tier", "subscription_status", "trial_ends_at"]) {
    assertEquals(select.includes(column), true, `workspace select is missing ${column}`);
  }
});

Deno.test("language: every system-prompt rule other than #8 is byte-identical to before, for both languages", async () => {
  const en = await runWithLocale("en", ACTION_BODIES.chat);
  const ar = await runWithLocale("ar", ACTION_BODIES.chat);
  const before = PROMPT_BEFORE_LANGUAGE_FIX.split("\n");
  for (const prompt of [en.anthropicRequests[0].system, ar.anthropicRequests[0].system]) {
    const lines = prompt.split("\n");
    assertEquals(lines.length, before.length);
    lines.forEach((line, i) => {
      if (before[i].startsWith("8. ")) {
        assertEquals(line.startsWith("8. Respond in "), true);
      } else {
        assertEquals(line, before[i], `system prompt line ${i + 1} changed`);
      }
    });
  }
  // Only rule 8 differs between the two languages.
  const enLines = en.anthropicRequests[0].system.split("\n");
  const arLines = ar.anthropicRequests[0].system.split("\n");
  const differing = enLines.map((line, i) => (line === arLines[i] ? null : i)).filter((i) => i !== null);
  assertEquals(differing.map((i) => enLines[i as number].slice(0, 3)), ["8. "]);
});
