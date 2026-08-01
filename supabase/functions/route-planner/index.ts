// BeautyRoute Route Planner -- secure server-side layer for daily route
// planning (geocoding, distance/duration matrix, and turn-by-turn
// directions). Mirrors the ai-assistant function's security model:
//
// - The browser never sees the Mapbox SECRET token (MAPBOX_SECRET_TOKEN is
//   an Edge Function secret, never VITE_-prefixed). All geocoding/matrix/
//   directions calls happen here.
// - The frontend map render uses a separate Mapbox PUBLIC token
//   (VITE_MAPBOX_PUBLIC_TOKEN) -- Mapbox explicitly designs that token type
//   for browser exposure and lets you restrict it by URL in your Mapbox
//   account, so it's the one deliberate exception to "never expose a
//   provider key." It is never used here.
// - Every data query runs through a Supabase client built from the
//   CALLER's forwarded JWT, so existing RLS is the real access boundary.
// - Workspace membership AND the "routing" plan feature are both enforced
//   here -- not just in the frontend FeatureGate -- same principle as
//   Phase 11's ai-assistant fix.
// - This function never writes business data. It only ever SELECTs, plus
//   read-only calls to the Mapbox API.

import { createClient } from "npm:@supabase/supabase-js@2";
import { hasFeature } from "../_shared/planRules.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mapbox's driving-profile Matrix/Directions APIs cap coordinates per
// request at 25 on the free tier. Reserve 2 for optional start/end.
const MAX_STOPS = 23;
const GRACE_MINUTES = 5; // small buffer before a late arrival counts as a conflict
const DEFAULT_SERVICE_MINUTES = 30; // used only when an appointment has no linked service duration
const MAPBOX_TIMEOUT_MS = 10_000;
const MAX_LOCATION_LENGTH = 300;

// Best-effort, per-isolate rate limit -- same caveat as ai-assistant's:
// Edge Function isolates are ephemeral and can run in more than one region,
// so this is not a durable, global guarantee.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitState = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitState.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitState.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitState.set(userId, timestamps);
  return true;
}

type Json = Record<string, unknown>;

function jsonResponse(body: Json, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function safeError(status: number, code: string, message: string) {
  return jsonResponse({ ok: false, code, error: message }, status);
}

function log(fields: Record<string, unknown>) {
  // Operational metadata only -- never log addresses, coordinates, or
  // navigation URLs here.
  console.log(JSON.stringify({ scope: "route-planner", ...fields }));
}

function buildScopedClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- Mapbox calls (server-side only) -------------------------------------------------

type LatLng = { lat: number; lng: number };

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Returns coordinates, or null if the address could not be resolved to a
// real place (never fabricated -- an unresolved address stays null and the
// caller must surface that explicitly, never invent a location).
// Mapbox's geocoder is intentionally forgiving -- given text it can't match
// as a specific place, it falls back to the best loose match it has (a
// whole city, or an unrelated place that happens to share a word), rather
// than returning no result. Accepting that at face value would violate
// "do not fabricate coordinates": a fuzzy city-level fallback is not the
// address the professional typed. `relevance` (0-1) is Mapbox's own
// confidence signal for how well the result matches the query; below this
// threshold we treat the address as unresolved rather than trust a guess.
const MIN_GEOCODE_RELEVANCE = 0.7;

async function geocodeAddress(address: string, token: string): Promise<LatLng | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${token}`;
  const res = await fetchWithTimeout(url, MAPBOX_TIMEOUT_MS);
  if (!res.ok) throw new MapboxError(res.status, await res.text());
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature?.center) return null;
  if (typeof feature.relevance === "number" && feature.relevance < MIN_GEOCODE_RELEVANCE) return null;
  const [lng, lat] = feature.center;
  return { lat, lng };
}

async function fetchMatrix(points: LatLng[], token: string): Promise<{ durations: number[][]; distances: number[][] }> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}?annotations=duration,distance&access_token=${token}`;
  const res = await fetchWithTimeout(url, MAPBOX_TIMEOUT_MS);
  if (!res.ok) throw new MapboxError(res.status, await res.text());
  const data = await res.json();
  return { durations: data.durations, distances: data.distances };
}

async function fetchDirections(points: LatLng[], token: string): Promise<{ geometry: unknown; distanceMeters: number; durationSeconds: number; legDurations: number[] }> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
  const res = await fetchWithTimeout(url, MAPBOX_TIMEOUT_MS);
  if (!res.ok) throw new MapboxError(res.status, await res.text());
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new MapboxError(422, "No route could be calculated between these stops.");
  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    legDurations: (route.legs ?? []).map((l: { duration: number }) => l.duration),
  };
}

class MapboxError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---- Feasibility check -------------------------------------------------
// Assumes the professional arrives on time for the FIRST stop (nothing to
// check there -- that's their own departure-time planning, which this
// function doesn't have visibility into). From the second stop onward,
// simulate cumulative travel + service time against each appointment's own
// committed start_time. A late arrival cascades forward (you can't recover
// lost time), but an early arrival waits for the client's booked slot
// rather than starting early.
type StopForFeasibility = { id: string; startTimeMs: number; durationMinutes: number };

function computeConflicts(stops: StopForFeasibility[], legDurationsSeconds: number[], legOffset: number): Array<{ appointmentId: string; lateByMinutes: number; message: string }> {
  const conflicts: Array<{ appointmentId: string; lateByMinutes: number; message: string }> = [];
  if (stops.length < 2) return conflicts;

  let serviceStart = stops[0].startTimeMs;
  for (let i = 0; i < stops.length - 1; i++) {
    const travelSeconds = legDurationsSeconds[legOffset + i] ?? 0;
    const departure = serviceStart + stops[i].durationMinutes * 60_000;
    const arrival = departure + travelSeconds * 1000;
    const next = stops[i + 1];
    const lateByMinutes = Math.round((arrival - next.startTimeMs) / 60_000);
    if (lateByMinutes > GRACE_MINUTES) {
      conflicts.push({
        appointmentId: next.id,
        lateByMinutes,
        message: `Estimated arrival is about ${lateByMinutes} min after this appointment's scheduled start, based on travel time from the previous stop.`,
      });
    }
    serviceStart = Math.max(arrival, next.startTimeMs);
  }
  return conflicts;
}

// Converts a "YYYY-MM-DD" date, as understood in a given IANA timezone, into
// the UTC instant range [local midnight, local end-of-day] -- so a workspace
// on e.g. Asia/Riyadh (UTC+3) gets the date boundary a mobile professional
// actually means by "today", not UTC midnight. `appointments.start_time` is
// stored in UTC, so this conversion is required for correct day selection.
function dayBoundsUtc(date: string, timezone: string): { start: string; end: string } {
  const [y, m, d] = date.split("-").map(Number);
  const noonUtcGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(noonUtcGuess).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = localAsUtc - noonUtcGuess.getTime();
  const localMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
  const localEndOfDayUtcMs = localMidnightUtcMs + 24 * 60 * 60 * 1000 - 1000;
  return { start: new Date(localMidnightUtcMs).toISOString(), end: new Date(localEndOfDayUtcMs).toISOString() };
}

// ---- Appointment fetch (shared by plan + reroute) -------------------------------------------------

async function fetchRoutableAppointments(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  date: string,
  timezone: string,
) {
  const { start: startOfDay, end: endOfDay } = dayBoundsUtc(date, timezone);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, status, location_address, clients(full_name), appointment_services(services(duration_minutes))")
    .eq("workspace_id", workspaceId)
    .gte("start_time", startOfDay)
    .lte("start_time", endOfDay)
    // Only pending/confirmed represent still-to-visit travel commitments.
    // completed/noshow already happened (nothing left to travel to);
    // cancelled must never appear in a route.
    .in("status", ["pending", "confirmed"])
    .order("start_time", { ascending: true });
  if (error) throw error;

  const routeable: Array<{ id: string; clientName: string; address: string; startTimeMs: number; durationMinutes: number; status: string }> = [];
  const missingAddress: Array<{ id: string; clientName: string; startTimeMs: number; status: string }> = [];

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const address = (row.location_address as string | null)?.trim();
    const clientName = (row.clients as Record<string, unknown> | null)?.full_name as string ?? "Unknown client";
    const startTimeMs = new Date(row.start_time as string).getTime();
    const durationMinutes =
      ((row.appointment_services as Record<string, unknown>[] | undefined) ?? [])
        .reduce((sum, l) => sum + (((l.services as Record<string, unknown> | null)?.duration_minutes as number) || 0), 0) || DEFAULT_SERVICE_MINUTES;

    if (!address) {
      missingAddress.push({ id: row.id as string, clientName, startTimeMs, status: row.status as string });
    } else {
      routeable.push({ id: row.id as string, clientName, address, startTimeMs, durationMinutes, status: row.status as string });
    }
  }

  return { routeable, missingAddress };
}

// ---- Main handler -------------------------------------------------

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return safeError(405, "method_not_allowed", "Only POST is supported.");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return safeError(401, "unauthenticated", "Sign in to use the route planner.");

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return safeError(400, "invalid_body", "Request body must be valid JSON.");
  }

  const action = String(body.action ?? "");
  const workspaceId = String(body.workspaceId ?? "");
  const date = String(body.date ?? "");
  if (!["plan", "reroute"].includes(action)) return safeError(400, "invalid_action", "Unsupported action.");
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return safeError(400, "invalid_workspace", "A valid workspace is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return safeError(400, "invalid_date", "A valid date (YYYY-MM-DD) is required.");

  const startLocation = typeof body.startLocation === "string" ? body.startLocation.trim().slice(0, MAX_LOCATION_LENGTH) : "";
  const endLocation = typeof body.endLocation === "string" ? body.endLocation.trim().slice(0, MAX_LOCATION_LENGTH) : "";

  const supabase = buildScopedClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return safeError(401, "unauthenticated", "Your session has expired. Please sign in again.");
  const userId = userData.user.id;

  if (!checkRateLimit(userId)) {
    return safeError(429, "rate_limited", "Too many route requests in a short time. Please wait a moment and try again.");
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name, display_brand, timezone, plan_tier, subscription_status, trial_ends_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError || !workspace) {
    log({ requestId, userId, workspaceId, action, status: "workspace_forbidden" });
    return safeError(403, "workspace_forbidden", "You don't have access to this workspace.");
  }

  if (!hasFeature(workspace as { plan_tier: string | null; subscription_status: string | null; trial_ends_at: string | null }, "routing")) {
    log({ requestId, userId, workspaceId, action, status: "feature_not_available" });
    return safeError(403, "feature_not_available", "Route optimization is not available on this workspace plan.");
  }

  const mapboxToken = Deno.env.get("MAPBOX_SECRET_TOKEN");

  try {
    const { routeable, missingAddress } = await fetchRoutableAppointments(supabase, workspaceId, date, (workspace.timezone as string) ?? "UTC");

    if (routeable.length + (startLocation ? 1 : 0) + (endLocation ? 1 : 0) > MAX_STOPS + 2) {
      return safeError(400, "route_too_large", `This route has too many stops to optimize at once (max ${MAX_STOPS}). Try a different date or split the day.`);
    }

    if (!mapboxToken) {
      log({ requestId, userId, workspaceId, action, status: "provider_unconfigured" });
      return safeError(503, "provider_unconfigured", "The route planner isn't configured yet. Ask your workspace owner to set up the maps provider.");
    }

    if (action === "plan") {
      // Geocode unique addresses once each, reused across appointments that
      // share the exact same address string (dedup within this request --
      // no cross-request cache exists, see the Phase 12 report).
      const uniqueAddresses = [...new Set(routeable.map((r) => r.address.toLowerCase()))];
      const geocodeResults = new Map<string, LatLng | null>();
      for (const addr of uniqueAddresses) {
        const original = routeable.find((r) => r.address.toLowerCase() === addr)!.address;
        geocodeResults.set(addr, await geocodeAddress(original, mapboxToken));
      }

      const resolved: Array<{ id: string; clientName: string; address: string; startTimeMs: number; durationMinutes: number; status: string; lat: number; lng: number }> = [];
      const unresolved: Array<{ id: string; clientName: string; address: string; startTimeMs: number; status: string }> = [];
      for (const r of routeable) {
        const coords = geocodeResults.get(r.address.toLowerCase());
        if (coords) resolved.push({ ...r, ...coords });
        else unresolved.push({ id: r.id, clientName: r.clientName, address: r.address, startTimeMs: r.startTimeMs, status: r.status });
      }

      let startCoords: LatLng | null = null;
      let startUnresolved = false;
      if (startLocation) {
        startCoords = await geocodeAddress(startLocation, mapboxToken);
        if (!startCoords) startUnresolved = true;
      }
      let endCoords: LatLng | null = null;
      let endUnresolved = false;
      if (endLocation) {
        endCoords = await geocodeAddress(endLocation, mapboxToken);
        if (!endCoords) endUnresolved = true;
      }

      resolved.sort((a, b) => a.startTimeMs - b.startTimeMs);

      let chronological = null;
      let matrix = null;
      if (resolved.length > 0) {
        const points: LatLng[] = [...(startCoords ? [startCoords] : []), ...resolved.map((r) => ({ lat: r.lat, lng: r.lng })), ...(endCoords ? [endCoords] : [])];
        matrix = points.length >= 2 ? await fetchMatrix(points, mapboxToken) : null;
        const directions = points.length >= 2 ? await fetchDirections(points, mapboxToken) : null;
        const conflicts = directions
          ? computeConflicts(
              resolved.map((r) => ({ id: r.id, startTimeMs: r.startTimeMs, durationMinutes: r.durationMinutes })),
              directions.legDurations,
              startCoords ? 1 : 0,
            )
          : [];
        chronological = directions && {
          order: resolved.map((r) => r.id),
          geometry: directions.geometry,
          totalDistanceMeters: directions.distanceMeters,
          totalDurationSeconds: directions.durationSeconds,
          conflicts,
        };
      }

      log({ requestId, userId, workspaceId, action, status: "ok", stopCount: resolved.length, latencyMs: Date.now() - startedAt });
      return jsonResponse({
        ok: true,
        workspaceName: workspace.display_brand ?? workspace.name,
        routeable: resolved,
        missingAddress,
        unresolved,
        start: startCoords ? { location: startLocation, ...startCoords } : null,
        startUnresolved,
        end: endCoords ? { location: endLocation, ...endCoords } : null,
        endUnresolved,
        matrix,
        chronological,
      }, 200);
    }

    // action === "reroute"
    const requestedOrder = Array.isArray(body.order) ? (body.order as unknown[]).map(String) : [];
    // `routeable` here is every appointment on this date WITH an address
    // field set (missingAddress are separated above) -- but not every one of
    // those necessarily geocodes successfully (see the `plan` action's
    // "unresolved" bucket). The client only ever submits ids that resolved
    // during `plan`, so this is deliberately a subset check, not an exact
    // length match: every requested id must be a real, current, addressed
    // appointment for this workspace+date, with no duplicates and no
    // foreign/unknown ids -- never trust a client-supplied order blindly.
    // (Geocoding is re-verified per-stop just below regardless.)
    const currentIds = new Set(routeable.map((r) => r.id));
    const isValidPermutation = requestedOrder.length > 0 && requestedOrder.every((id) => currentIds.has(id)) && new Set(requestedOrder).size === requestedOrder.length;
    if (!isValidPermutation) {
      return safeError(409, "stale_route", "This route no longer matches the workspace's current appointments. Please reload the route for this date.");
    }

    const byId = new Map(routeable.map((r) => [r.id, r]));
    const orderedStops = requestedOrder.map((id) => byId.get(id)!);

    const uniqueAddresses = [...new Set(orderedStops.map((r) => r.address.toLowerCase()))];
    const geocodeResults = new Map<string, LatLng | null>();
    for (const addr of uniqueAddresses) {
      const original = orderedStops.find((r) => r.address.toLowerCase() === addr)!.address;
      geocodeResults.set(addr, await geocodeAddress(original, mapboxToken));
    }
    const withCoords = orderedStops.map((r) => ({ ...r, coords: geocodeResults.get(r.address.toLowerCase()) }));
    if (withCoords.some((r) => !r.coords)) {
      return safeError(422, "unresolved_in_order", "One or more stops in this order no longer resolve to a valid address. Please reload the route.");
    }

    let startCoords: LatLng | null = null;
    if (startLocation) startCoords = await geocodeAddress(startLocation, mapboxToken);
    let endCoords: LatLng | null = null;
    if (endLocation) endCoords = await geocodeAddress(endLocation, mapboxToken);

    const points: LatLng[] = [...(startCoords ? [startCoords] : []), ...withCoords.map((r) => r.coords as LatLng), ...(endCoords ? [endCoords] : [])];
    if (points.length < 2) return safeError(400, "not_enough_stops", "At least two locations are needed to calculate a route.");

    const directions = await fetchDirections(points, mapboxToken);
    const conflicts = computeConflicts(
      orderedStops.map((r) => ({ id: r.id, startTimeMs: r.startTimeMs, durationMinutes: r.durationMinutes })),
      directions.legDurations,
      startCoords ? 1 : 0,
    );

    log({ requestId, userId, workspaceId, action, status: "ok", stopCount: orderedStops.length, latencyMs: Date.now() - startedAt });
    return jsonResponse({
      ok: true,
      order: requestedOrder,
      geometry: directions.geometry,
      totalDistanceMeters: directions.distanceMeters,
      totalDurationSeconds: directions.durationSeconds,
      conflicts,
    }, 200);
  } catch (err) {
    let category = "unknown";
    let status = 502;
    let message = "The route planner is temporarily unavailable. Please try again in a moment.";

    if (err instanceof MapboxError) {
      if (err.status === 401 || err.status === 403) {
        category = "provider_auth";
        status = 503;
        message = "The route planner isn't configured correctly. Ask your workspace owner to check the maps provider setup.";
      } else if (err.status === 429) {
        category = "provider_rate_limited";
        status = 429;
        message = "The maps provider is receiving too many requests right now. Please try again shortly.";
      } else {
        category = `provider_${err.status}`;
        status = 502;
        message = "The maps provider couldn't process this route. Please check the addresses and try again.";
      }
    } else if (err instanceof DOMException && err.name === "AbortError") {
      category = "timeout";
      status = 504;
      message = "The route planner took too long to respond. Please try again.";
    } else if (err && typeof err === "object" && "code" in err) {
      // Supabase/Postgres error shape
      category = "database_error";
      status = 502;
      message = "Couldn't load appointments for this route. Please try again.";
    }

    log({ requestId, userId, workspaceId, action, status: "error", providerErrorCategory: category, latencyMs: Date.now() - startedAt });
    return safeError(status, category, message);
  }
});
