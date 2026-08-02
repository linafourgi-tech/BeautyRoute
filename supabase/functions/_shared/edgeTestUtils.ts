// Test-only helpers for Deno Edge Function tests (Phase 15 Step 6). Not
// imported by any production Edge Function. Provides the two boundaries
// needed to test index.ts handlers without any real network access:
//
// 1. stubFetch(): routes every outbound fetch (Supabase REST/Auth,
//    Mapbox, Anthropic all ultimately call the global fetch) to canned
//    Response objects by URL substring, and throws if a test forgets to
//    mock a call it actually makes -- so a gap in mocking fails loudly
//    instead of silently reaching a real network.
// 2. captureHandler(): index.ts calls Deno.serve(handler) as an import-time
//    side effect with no exported reference to the handler itself. This
//    temporarily replaces Deno.serve to capture that handler function
//    instead of letting it bind a real network listener, then restores it.

export function jsonRes(body: unknown, status = 200): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function stubFetch(routes: Record<string, () => Response | Promise<Response>>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) return await handler();
    }
    throw new Error(`Unmocked fetch in test -- would have hit the real network: ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

export type EdgeHandler = (req: Request) => Response | Promise<Response>;

export async function captureHandler(modulePath: string): Promise<EdgeHandler> {
  const originalServe = Deno.serve;
  let captured: EdgeHandler | null = null;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = ((handler: EdgeHandler) => {
    captured = handler;
    // Minimal fake server handle -- index.ts never uses Deno.serve's return
    // value, so the exact shape only needs to avoid throwing.
    return { finished: Promise.resolve(undefined), shutdown: () => Promise.resolve(), ref() {}, unref() {} };
    // deno-lint-ignore no-explicit-any
  }) as any;
  try {
    await import(modulePath);
  } finally {
    Deno.serve = originalServe;
  }
  if (!captured) throw new Error(`Deno.serve was never called while importing ${modulePath}`);
  return captured;
}

export function postRequest(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export const FAKE_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
export const FAKE_OTHER_WORKSPACE_ID = "22222222-2222-2222-2222-222222222222";
export const FAKE_CLIENT_ID = "33333333-3333-3333-3333-333333333333";
export const FAKE_VISIT_ID = "44444444-4444-4444-4444-444444444444";
export const FAKE_APPOINTMENT_ID = "55555555-5555-5555-5555-555555555555";
export const FAKE_APPOINTMENT_ID_2 = "66666666-6666-6666-6666-666666666666";
export const FAKE_FOREIGN_APPOINTMENT_ID = "77777777-7777-7777-7777-777777777777";

export function authUserResponse(userId = "user-1") {
  return jsonRes({ id: userId, email: `${userId}@example.com` });
}

export function workspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FAKE_WORKSPACE_ID,
    name: "Test Salon",
    display_brand: null,
    timezone: "UTC",
    plan_tier: "Pro",
    subscription_status: "active",
    trial_ends_at: null,
    ...overrides,
  };
}
