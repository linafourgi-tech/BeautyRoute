import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Clock, Navigation, AlertTriangle, ArrowUp, ArrowDown, RotateCcw, Sparkles } from "lucide-react";
import Layout from "../components/Layout";
import RouteMap from "../components/RouteMap";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { hasFeature } from "../services/subscription";
import { FeatureGate } from "../components/subscription/FeatureGate";
import { planRoute, rerouteRoute, RouteUnavailableError } from "../services/route";
import { optimizeStopOrder } from "../lib/routeOptimizer";
import { Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

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
    <Layout title="Route Engine" subtitle="Plan today's stops, see estimated travel time, and open the route in your navigation app.">
      {isLoading && <p className="text-muted text-sm">Loading…</p>}

      {gated && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <Navigation size={22} className="text-gold mx-auto mb-3" />
          <h2 className="font-display text-xl text-ivory mb-2">Route Engine is a Professional feature</h2>
          <p className="text-muted text-sm max-w-md mx-auto">Upgrade your plan to optimize daily routes between client appointments.</p>
        </div>
      )}

      {!isLoading && !gated && (
        <FeatureGate subscription={subscription} feature="routing">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted mb-1.5 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted mb-1.5 block">Starting location (optional)</label>
              <input
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                onBlur={applyStartEnd}
                placeholder="e.g. home address"
                className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory placeholder:text-muted outline-none focus:border-wine"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted mb-1.5 block">Ending location (optional)</label>
              <input
                value={endLocation}
                onChange={(e) => setEndLocation(e.target.value)}
                onBlur={applyStartEnd}
                placeholder="defaults to last stop"
                className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory placeholder:text-muted outline-none focus:border-wine"
              />
            </div>
            <p className="text-xs text-muted pb-2.5">{workspace?.display_brand || workspace?.name}</p>
          </div>

          {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

          {!failed && loading && (
            <div className="beautyroute-ds space-y-3">
              <Skeleton height={200} radius="var(--radius-lg)" />
              <Skeleton height={40} radius="var(--radius-md)" />
            </div>
          )}

          {!failed && !loading && isEmpty && (
            <div className="beautyroute-ds">
              <EmptyState title="No appointments on this date" description="Pick another date, or check back once appointments are booked." />
            </div>
          )}

          {!failed && !loading && plan && !isEmpty && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              <div className="rounded-2xl border border-line bg-surface p-6">
                <RouteMap stops={orderedStops} start={plan.start} end={plan.end} geometry={activeRoute?.geometry} conflictIds={conflictIds} />

                {rerouteError && (
                  <p className="text-xs text-danger mt-3 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {rerouteError.message}
                  </p>
                )}

                <div className="mt-6 space-y-2.5">
                  {orderedStops.map((s, i) => {
                    const conflict = (activeRoute?.conflicts ?? []).find((c) => c.appointmentId === s.id);
                    return (
                      <div key={s.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${conflict ? "border-danger/40 bg-danger/5" : "border-line"}`}>
                        <div className="h-7 w-7 rounded-full bg-wine text-onaccent text-xs flex items-center justify-center font-mono-tag shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-ivory text-sm truncate">{s.clientName}</p>
                          <p className="text-muted text-xs flex items-center gap-1 truncate">
                            <MapPin size={11} /> {s.address} · {formatTime(s.startTimeMs)}
                          </p>
                          {conflict && (
                            <p className="text-danger text-xs mt-1 flex items-center gap-1">
                              <AlertTriangle size={11} /> {conflict.message}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => moveStop(i, -1)} disabled={i === 0 || rerouting} className="text-muted hover:text-ivory disabled:opacity-30" aria-label="Move up">
                            <ArrowUp size={14} />
                          </button>
                          <button onClick={() => moveStop(i, 1)} disabled={i === orderedStops.length - 1 || rerouting} className="text-muted hover:text-ivory disabled:opacity-30" aria-label="Move down">
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plan.missingAddress.length > 0 && (
                  <div className="mt-6 rounded-xl border border-dashed border-line p-4">
                    <p className="text-xs uppercase tracking-wide text-muted mb-2">Missing an address ({plan.missingAddress.length})</p>
                    {plan.missingAddress.map((a) => (
                      <p key={a.id} className="text-sm text-muted">
                        {a.clientName} · {formatTime(a.startTimeMs)} — add an address on this appointment to include it in the route.
                      </p>
                    ))}
                  </div>
                )}

                {plan.unresolved.length > 0 && (
                  <div className="mt-4 rounded-xl border border-dashed border-danger/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-danger mb-2">Address couldn't be located ({plan.unresolved.length})</p>
                    {plan.unresolved.map((a) => (
                      <p key={a.id} className="text-sm text-muted">
                        {a.clientName} · {formatTime(a.startTimeMs)} — "{a.address}" wasn't found on the map. Check the address for typos.
                      </p>
                    ))}
                  </div>
                )}

                {(plan.startUnresolved || plan.endUnresolved) && (
                  <p className="text-xs text-danger mt-3">
                    {plan.startUnresolved && "Starting location wasn't found. "}
                    {plan.endUnresolved && "Ending location wasn't found."}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-6 h-fit space-y-5">
                <h2 className="font-display text-lg text-ivory">Today's route</h2>
                <Stat icon={MapPin} label="Total distance" value={formatDistance(activeRoute?.totalDistanceMeters)} />
                <Stat icon={Clock} label="Travel time" value={formatDuration(activeRoute?.totalDurationSeconds)} />
                {activeRoute?.conflicts?.length > 0 && (
                  <div className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-xs text-danger flex items-start gap-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>{activeRoute.conflicts.length} appointment{activeRoute.conflicts.length > 1 ? "s" : ""} may run late based on estimated travel time.</span>
                  </div>
                )}
                <p className="text-[11px] text-muted -mt-2">
                  {isOptimized ? "Estimated best order — a heuristic, not a guaranteed optimum." : "Scheduled order (by appointment time)."}
                </p>

                <div className="space-y-2.5 pt-2 border-t border-line">
                  <button
                    onClick={handleOptimize}
                    disabled={rerouting || orderedStops.length < 3}
                    className="w-full flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm bg-gold text-onaccent disabled:opacity-50"
                  >
                    <Sparkles size={14} /> {rerouting ? "Calculating…" : "Optimize route"}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={!isOptimized || rerouting}
                    className="w-full flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm border border-line text-ivory disabled:opacity-40"
                  >
                    <RotateCcw size={14} /> Reset order
                  </button>
                  <a
                    href={navUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!navUrl}
                    onClick={(e) => !navUrl && e.preventDefault()}
                    className={`w-full flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm border border-wine text-wine hover:bg-wine hover:text-onaccent transition-colors ${!navUrl ? "opacity-40 pointer-events-none" : ""}`}
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
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-muted text-sm flex items-center gap-2">
        <Icon size={14} /> {label}
      </span>
      <span className="text-ivory font-mono-tag text-sm">{value}</span>
    </div>
  );
}
