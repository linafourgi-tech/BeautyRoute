import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, Navigation, AlertTriangle, ArrowUp, ArrowDown, RotateCcw, Sparkles, Lock } from "lucide-react";
import Layout from "../components/Layout";
import RouteMap from "../components/RouteMap";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { hasFeature } from "../services/subscription";
import { FeatureGate } from "../components/subscription/FeatureGate";
import { planRoute, rerouteRoute, RouteUnavailableError } from "../services/route";
import { optimizeStopOrder } from "../lib/routeOptimizer";
import { Input, Button, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds. Every data hook, effect, handler, and piece of state
// below is byte-for-byte the same as before -- and, separately, the real
// Mapbox rendering in RouteMap.jsx (token handling, map init, markers,
// route line, fitBounds) is completely untouched; only that component's
// own non-map chrome (its "not configured" placeholder and container
// border) and its marker/route-line color *values* moved from hardcoded
// old-theme hex to the equivalent beautyroute-ds token hex, since Mapbox
// draws markers outside the CSS cascade entirely.

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDistance(meters) {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Minimum data needed for an external nav link -- coordinates only, no
// client names, phone, email, or notes.
function buildNavigationUrl(order, stopsById, start, end) {
  const stopCoords = order.map((id) => stopsById.get(id)).filter(Boolean).map((s) => `${s.lat},${s.lng}`);
  const points = [...(start ? [`${start.lat},${start.lng}`] : []), ...stopCoords, ...(end ? [`${end.lat},${end.lng}`] : [])];
  if (points.length < 2) return null;
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1);
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function RouteEngine() {
  const navigate = useNavigate();
  const { workspace, workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();
  const { subscription, loading: subLoading } = useSubscription(workspaceId);

  const [date, setDate] = useState(todayISODate());
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const appliedStartEnd = useRef({ start: "", end: "" });

  const [plan, setPlan] = useState(null);
  const [order, setOrder] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null); // {geometry, totalDistanceMeters, totalDurationSeconds, conflicts}
  const [isOptimized, setIsOptimized] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (workspaceLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setRerouteError(null);
      if (!workspaceId) {
        if (!cancelled) {
          setPlan(null);
          setLoading(false);
        }
        return;
      }
      try {
        const result = await planRoute(workspaceId, date, startLocation, endLocation);
        if (cancelled) return;
        appliedStartEnd.current = { start: startLocation, end: endLocation };
        setPlan(result);
        const chronoOrder = result.chronological?.order ?? [];
        setOrder(chronoOrder);
        setActiveRoute(result.chronological);
        setIsOptimized(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof RouteUnavailableError ? err : new RouteUnavailableError("unknown", "Couldn't load the route for this date."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Deliberately excludes startLocation/endLocation -- those apply on
    // blur via applyStartEnd(), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaceLoading, date, reloadToken]);

  function applyStartEnd() {
    if (appliedStartEnd.current.start !== startLocation || appliedStartEnd.current.end !== endLocation) {
      setReloadToken((t) => t + 1);
    }
  }

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  const stopsById = useMemo(() => {
    const map = new Map();
    (plan?.routeable ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [plan]);

  const conflictIds = useMemo(() => new Set((activeRoute?.conflicts ?? []).map((c) => c.appointmentId)), [activeRoute]);

  async function pushOrder(newOrder) {
    setOrder(newOrder);
    setRerouting(true);
    setRerouteError(null);
    try {
      const result = await rerouteRoute(workspaceId, date, newOrder, startLocation, endLocation);
      setActiveRoute(result);
    } catch (err) {
      setRerouteError(err instanceof RouteUnavailableError ? err : new RouteUnavailableError("unknown", "Couldn't recalculate the route."));
    } finally {
      setRerouting(false);
    }
  }

  function handleOptimize() {
    if (!plan?.matrix || order.length < 3) return;
    const chronoOrder = plan.chronological?.order ?? order;
    const optimized = optimizeStopOrder(chronoOrder, plan.matrix, Boolean(plan.start));
    setIsOptimized(true);
    pushOrder(optimized);
  }

  function handleReset() {
    setIsOptimized(false);
    setOrder(plan.chronological?.order ?? []);
    setActiveRoute(plan.chronological);
  }

  function moveStop(index, direction) {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setIsOptimized(true);
    pushOrder(next);
  }

  const isLoading = workspaceLoading || subLoading;
  const gated = !isLoading && !hasFeature(subscription, "routing");
  const failed = workspaceError || error;

  const navUrl = plan ? buildNavigationUrl(order, stopsById, plan.start, plan.end) : null;
  const orderedStops = order.map((id) => stopsById.get(id)).filter(Boolean);
  const isEmpty = plan && plan.routeable.length === 0 && plan.missingAddress.length === 0 && plan.unresolved.length === 0;

  return (
    <Layout title="Route Engine" titleAr="المسار" subtitle="Plan today's stops, see estimated travel time, and open the route in your navigation app.">
      {isLoading && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Loading…</p>}

      {/* Same locked-state pattern as AIEngine.jsx's gated block: a real
          upgrade path (not just descriptive text) via the existing
          /pricing route. hasFeature()/entitlement logic is unchanged --
          presentation only. */}
      {gated && (
        <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-8) var(--space-6)", textAlign: "center" }}>
          <span style={{ height: 44, width: 44, borderRadius: "50%", background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Lock size={18} color="var(--accent-gold-strong)" />
          </span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 8px" }}>Route Engine is a Professional feature</h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, maxWidth: 420, margin: "0 auto 20px" }}>Optimize today's stop order automatically and open the shortest path between appointments in your navigation app.</p>
          <Button variant="gold" onClick={() => navigate("/pricing")}>View plans</Button>
        </div>
      )}

      {!isLoading && !gated && (
        <FeatureGate subscription={subscription} feature="routing">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginBottom: "var(--space-6)" }}>
            <div style={{ width: 160 }}>
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input label="Starting location (optional)" value={startLocation} onChange={(e) => setStartLocation(e.target.value)} onBlur={applyStartEnd} placeholder="e.g. home address" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input label="Ending location (optional)" value={endLocation} onChange={(e) => setEndLocation(e.target.value)} onBlur={applyStartEnd} placeholder="defaults to last stop" />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", paddingBottom: 12, margin: 0 }}>{workspace?.display_brand || workspace?.name}</p>
          </div>

          {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

          {!failed && loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Skeleton height={200} radius="var(--radius-lg)" />
              <Skeleton height={40} radius="var(--radius-md)" />
            </div>
          )}

          {!failed && !loading && isEmpty && (
            <EmptyState title="No appointments on this date" description="Pick another date, or check back once appointments are booked." />
          )}

          {!failed && !loading && plan && !isEmpty && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)" }}>
                <RouteMap stops={orderedStops} start={plan.start} end={plan.end} geometry={activeRoute?.geometry} conflictIds={conflictIds} />

                {rerouteError && (
                  <p style={{ fontSize: 12, color: "var(--error-fg)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={12} /> {rerouteError.message}
                  </p>
                )}

                <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: 10 }}>
                  {orderedStops.map((s, i) => {
                    const conflict = (activeRoute?.conflicts ?? []).find((c) => c.appointmentId === s.id);
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          borderRadius: "var(--radius-md)",
                          border: "1px solid " + (conflict ? "var(--error-fg)" : "var(--border-subtle)"),
                          background: conflict ? "var(--error-bg)" : "transparent",
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ height: 26, width: 26, borderRadius: "50%", background: "var(--accent-gold)", color: "var(--charcoal-900)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.clientName}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <MapPin size={11} /> {s.address} · {formatTime(s.startTimeMs)}
                          </p>
                          {conflict && (
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--error-fg)", display: "flex", alignItems: "center", gap: 4 }}>
                              <AlertTriangle size={11} /> {conflict.message}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                          <button onClick={() => moveStop(i, -1)} disabled={i === 0 || rerouting} aria-label="Move up" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--text-tertiary)", opacity: i === 0 || rerouting ? 0.3 : 1 }}>
                            <ArrowUp size={14} />
                          </button>
                          <button onClick={() => moveStop(i, 1)} disabled={i === orderedStops.length - 1 || rerouting} aria-label="Move down" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--text-tertiary)", opacity: i === orderedStops.length - 1 || rerouting ? 0.3 : 1 }}>
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plan.missingAddress.length > 0 && (
                  <div style={{ marginTop: "var(--space-6)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-default)", padding: "var(--space-4)" }}>
                    <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 8px" }}>Missing an address ({plan.missingAddress.length})</p>
                    {plan.missingAddress.map((a) => (
                      <p key={a.id} style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0" }}>
                        {a.clientName} · {formatTime(a.startTimeMs)} — add an address on this appointment to include it in the route.
                      </p>
                    ))}
                  </div>
                )}

                {plan.unresolved.length > 0 && (
                  <div style={{ marginTop: "var(--space-4)", borderRadius: "var(--radius-md)", border: "1px dashed var(--error-fg)", padding: "var(--space-4)" }}>
                    <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--error-fg)", margin: "0 0 8px" }}>Address couldn't be located ({plan.unresolved.length})</p>
                    {plan.unresolved.map((a) => (
                      <p key={a.id} style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0" }}>
                        {a.clientName} · {formatTime(a.startTimeMs)} — "{a.address}" wasn't found on the map. Check the address for typos.
                      </p>
                    ))}
                  </div>
                )}

                {(plan.startUnresolved || plan.endUnresolved) && (
                  <p style={{ fontSize: 12, color: "var(--error-fg)", marginTop: 10 }}>
                    {plan.startUnresolved && "Starting location wasn't found. "}
                    {plan.endUnresolved && "Ending location wasn't found."}
                  </p>
                )}
              </div>

              <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)", height: "fit-content", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: 0 }}>Today's route</h2>
                <Stat icon={MapPin} label="Total distance" value={formatDistance(activeRoute?.totalDistanceMeters)} />
                <Stat icon={Clock} label="Travel time" value={formatDuration(activeRoute?.totalDurationSeconds)} />
                {activeRoute?.conflicts?.length > 0 && (
                  <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--error-fg)", background: "var(--error-bg)", padding: "10px 12px", fontSize: 12, color: "var(--error-fg)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{activeRoute.conflicts.length} appointment{activeRoute.conflicts.length > 1 ? "s" : ""} may run late based on estimated travel time.</span>
                  </div>
                )}
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "-8px 0 0" }}>
                  {isOptimized ? "Estimated best order — a heuristic, not a guaranteed optimum." : "Scheduled order (by appointment time)."}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                  <Button variant="gold" icon={<Sparkles size={14} />} onClick={handleOptimize} disabled={rerouting || orderedStops.length < 3}>
                    {rerouting ? "Calculating…" : "Optimize route"}
                  </Button>
                  <Button variant="secondary" icon={<RotateCcw size={14} />} onClick={handleReset} disabled={!isOptimized || rerouting}>
                    Reset order
                  </Button>
                  <a
                    href={navUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!navUrl}
                    onClick={(e) => !navUrl && e.preventDefault()}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: "var(--radius-pill)",
                      padding: "11px 22px",
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      border: "1px solid var(--accent-gold-strong)",
                      color: "var(--accent-gold-strong)",
                      textDecoration: "none",
                      opacity: navUrl ? 1 : 0.4,
                      pointerEvents: navUrl ? "auto" : "none",
                    }}
                  >
                    <Navigation size={14} /> Open in navigation
                  </a>
                </div>
              </div>
            </div>
          )}
        </FeatureGate>
      )}
    </Layout>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
      <span style={{ color: "var(--text-tertiary)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} /> {label}
      </span>
      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
