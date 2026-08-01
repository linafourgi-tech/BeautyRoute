# Phase 12 — Route Engine Live Verification Report

**Document type:** Verification record. Reports what was actually tested and observed against real external services — this is not a design document or a roadmap entry.
**Corresponds to roadmap item:** `docs/PROJECT_ROADMAP.md` → **Phase 9 — Maps & Routing** (this report uses "Phase 12" only as the label used for this work at the time it was performed; see the Change Log entry in the roadmap for the reconciliation note).
**Date performed:** 2026-08-01
**Status:** Completed — all in-scope items live-verified against real external services, except one item explicitly marked code-review-only (see below).

---

## Scope

Live verification of the Route Engine feature set — server-side route planning (`supabase/functions/route-planner/index.ts`), the client-side 2-opt optimizer (`src/lib/routeOptimizer.js`), the route service layer (`src/services/route.ts`), the map component (`src/components/RouteMap.jsx`), and the route page (`src/pages/RouteEngine.jsx`) — using real Mapbox APIs and the real (non-mocked) Supabase backend, now that both required provider credentials were configured:

- `MAPBOX_SECRET_TOKEN` — Supabase Edge Function secret (server-side geocoding, distance/duration matrix, and directions calls).
- `VITE_MAPBOX_PUBLIC_TOKEN` — frontend build-time variable (Mapbox GL JS map rendering only; domain-restricted in the Mapbox account).

This report covers verification only. No new application features were built during this work; two genuine defects and one correctness gap surfaced during testing were fixed, redeployed, and re-verified as part of closing out the phase (see below).

## Environment

- Supabase project: linked project referenced by `supabase/config.toml` (`project_id = "platform_salma"`), accessed via the Supabase CLI (`--use-api` function deployment, since local Docker-based bundling was unavailable in this environment).
- Test identity: the existing dev-auth user (`VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD`), signed in via the real Supabase Auth token endpoint — not the dev-only client bootstrap.
- Primary test workspace: the existing dev workspace, timezone `Asia/Riyadh`, plan tier Pro/Studio (has the `routing` feature).
- Browser verification: production build (`vite build` + `vite preview`), driven by Playwright (installed temporarily, uninstalled afterward), against real Chromium.
- All calls hit the real Mapbox Geocoding v5, Directions v5, and Matrix v1 APIs — no mocking or stubbing at any layer.

## Verified behaviors (live, with real data)

| Behavior | Result |
|---|---|
| Real geocoding | Real street addresses (Paris landmarks) resolved to precise, correct coordinates |
| Multi-stop routing | 3-stop route returned real road-snapped `LineString` geometry (376 points), 9.2 km / 35 min |
| Route optimization | Client-side 2-opt found a genuinely shorter order (6.4 km / 24 min) using the server-provided duration/distance matrix |
| Schedule-conflict detection | The shorter optimized order was correctly flagged — a summary banner plus two specific per-stop warnings (~102 min late, ~204 min late) — confirmed both in the Edge Function response and visually in the rendered UI |
| Manual reordering | Reversed stop order accepted and correctly re-routed (this is what surfaced Bug 2, below) |
| Missing-address handling | Appointment with no `location_address` correctly separated into its own list, never silently dropped |
| Unresolved-address handling | A garbage address string correctly separated into its own list after Bug 1 was fixed (see below) |
| Cancelled-appointment exclusion | A `cancelled` appointment never appeared in any response bucket at any point |
| Cross-workspace protection | A workspace the signed-in user is not a member of returned `403 workspace_forbidden` |
| Tamper protection | A `reroute` request containing a nonexistent/foreign appointment ID was rejected with `409 stale_route` |
| Authentication | Signed-out requests rejected with `401 unauthenticated` |
| Plan gating | Server-side `hasFeature(subscription, "routing")` check confirmed still enforced independent of the frontend |
| Timezone-aware date boundaries | An appointment at 01:00 `Asia/Riyadh` (22:00 UTC the prior day) was correctly bucketed under the Riyadh-local calendar date, not the UTC date (this is what surfaced Bug 3, below) |
| Start/end location geocoding | Valid location resolved to coordinates and included in the route; a garbage location correctly returned `startUnresolved: true` without blocking the rest of the route |
| Real map initialization | Mapbox GL JS initialized (canvas + attribution rendered) in the browser |
| External navigation link | Generated a `google.com/maps/dir` URL containing only coordinates — no client names or raw addresses |
| Browser bundle secret check | Zero occurrences of `MAPBOX_SECRET` in `src/` or the built `dist/assets/*.js`; the public token is the only Mapbox token compiled into the bundle |
| Static checks | `npx oxlint` and `npx vite build` both pass cleanly |

## Bugs found, fixed, and re-verified

**1. Low-confidence geocoding matches were accepted as if correct.**
Mapbox's geocoder returns its best loose guess rather than "no result" for text it can't precisely match — live-tested with a garbage address and it matched an unrelated real place name with a low confidence score. **Fix:** `geocodeAddress()` now reads Mapbox's own `relevance` score and treats anything below **0.7** as unresolved. **Re-verified:** the same garbage address now correctly lands in the "unresolved" bucket instead of being silently accepted.

**2. `reroute`'s tamper-check rejected legitimate reorders.**
It required the submitted stop order to exactly match every address-bearing appointment for that date, but the client legitimately only submits the subset that successfully geocoded during `plan`. A real reversed-order request was being wrongly rejected as stale. **Fix:** validation now checks the submitted order is a duplicate-free subset of the current, workspace-owned, addressed appointment set (still rejecting foreign/nonexistent IDs), with per-stop geocoding re-verified independently. **Re-verified:** a legitimate reversed order now succeeds; a request containing a genuinely foreign ID is still correctly rejected with `409 stale_route`.

**3. Day-boundary calculation ignored the workspace's timezone.**
Surfaced by an `oxlint` unused-parameter warning. The `date` filter compared appointment timestamps against naive UTC-interpreted boundary strings, so appointments near midnight in a non-UTC workspace (the test workspace is `Asia/Riyadh`, UTC+3) could load under the wrong calendar date. **Fix:** added a proper local-midnight-to-UTC conversion (`dayBoundsUtc()`) using `Intl.DateTimeFormat`. **Re-verified:** an appointment at 01:00 Riyadh time is now correctly excluded from the UTC-equivalent prior date and correctly included under the Riyadh-local date.

All three fixes were deployed to the live Edge Function and re-tested before being considered closed. No other Phase 1–11 behavior was touched by these fixes.

## Verified by code review only (not live-tested)

- **`route_too_large` (23-stop cap).** Exercising this honestly would require 24+ real, individually geocodable appointments in a single day, which wasn't practical to set up for this pass. The check itself is a simple, low-risk numeric comparison (`routeable.length + start + end > MAX_STOPS + 2`) and was verified by reading the code, not by a live request that actually triggered it. This is explicitly **not** claimed as live-verified.

## Known limitation: local Mapbox CORS restriction

During browser testing, the Mapbox map **style/tiles** failed to load locally with a CORS error. This is **expected and correct**, not a defect: the public token is properly domain-restricted in the Mapbox account to the production domain(s), and `localhost` (used for local `vite preview` testing) is not on that allowlist. The map object itself initialized correctly (canvas and Mapbox attribution rendered); only the tile fetch was blocked. All routing logic (geocoding, matrix, directions, optimization, conflict detection) is server-side and was unaffected by this — it was verified independently of tile rendering. The map is expected to render fully once accessed from an allowlisted production domain.

## Cleanup performed

All temporary verification data was created and removed within this work, confirmed via follow-up queries showing zero remaining rows:

- Multiple rounds of throwaway clients and appointments (Riyadh landmark addresses, Paris addresses, one timezone-edge-case appointment) in the primary test workspace — all deleted.
- All temporary diagnostic code added to the Edge Function during debugging (raw-error debug fields, coordinate-inspection branches) was fully reverted before the final deploy; confirmed via `grep` showing no debug markers remain in `supabase/functions/route-planner/index.ts`.
- Temporary local scripts (`__p12_*.mjs`, `.p12_*.json`) and the temporarily-installed `playwright` dev dependency were removed; `package.json`/`package-lock.json` diff contains only the intentional `mapbox-gl` runtime dependency.

## Final status

**Completed.** All listed behaviors were live-verified against real Mapbox APIs and the real Supabase backend, except the single item explicitly marked code-review-only above. Three real defects were found during verification, fixed, redeployed, and re-verified live. No temporary data, credentials, or diagnostic code remain in the deployed function or the repository working tree as a result of this verification pass.
