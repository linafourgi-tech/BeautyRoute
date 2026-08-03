// Shared CORS handling for every Edge Function -- replaces the previous
// per-function `Access-Control-Allow-Origin: "*"` with an explicit
// allowlist. Bearer-token auth (not cookies) already means a wildcard
// couldn't be used to forge an authenticated request from an arbitrary
// origin, but it does remove a layer of defense-in-depth: if a JWT were
// ever exfiltrated via some other vector (e.g. a future XSS), a wildcard
// origin means it could be replayed from anywhere. An explicit allowlist
// closes that off.
//
// Configured via the ALLOWED_ORIGINS Edge Function secret/env var: a
// comma-separated list of exact origins (scheme + host + optional port, no
// trailing slash), e.g.
//   ALLOWED_ORIGINS=https://app.beautyroute.example,https://beautyroute.example
// Set with `supabase secrets set ALLOWED_ORIGINS=...`. Vite's own local dev
// origins are always included in addition to whatever is configured, so
// local development works safely with no configuration -- this does not
// widen the allowlist to arbitrary origins, only these two fixed ones.
const LOCAL_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set([...configured, ...LOCAL_DEV_ORIGINS]);
}

// Computed per-request (not a static constant) since the header value
// depends on the caller's own Origin header. `Vary: Origin` tells any
// cache that this response differs by Origin, so one caller's allowed
// response is never served back to a different, disallowed origin.
// A request with no Origin header (non-browser clients, e.g. curl or
// server-to-server) or a disallowed origin simply gets no
// Access-Control-Allow-Origin header at all -- the request itself is still
// processed normally (CORS is a browser-enforced restriction on reading
// the response, not this API's own authorization boundary, which is the
// Bearer JWT), but a browser enforcing CORS would refuse to expose the
// response to script running on that page.
export function corsHeadersFor(originHeader: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (originHeader && allowedOrigins().has(originHeader)) {
    headers["Access-Control-Allow-Origin"] = originHeader;
  }
  return headers;
}
