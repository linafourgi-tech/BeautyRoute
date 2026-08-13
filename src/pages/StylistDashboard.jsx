import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, MapPin, Clock, Search, Navigation, Fuel, X } from "lucide-react";
import Layout from "../components/Layout";
import { useSession } from "../hooks/useSession";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getTodaysAppointments } from "../services/appointments";
import { getClients } from "../services/clients";
import { getMonthlyRevenue } from "../services/revenue";
import { toAppointmentViewModel } from "../lib/appointmentView";
import { Skeleton, EmptyState, Input } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 1, design-system-dashboard-shell): reskinned onto
// beautyroute-ds -- every data hook, effect, handler, and piece of state
// below is byte-for-byte the same as before. Only JSX markup/styling
// changed; no query, service call, or navigation behavior was touched.

// clients table has no photo/avatar column — explicit placeholder, not fabricated.
function toClientViewModel(row) {
  return {
    id: row.id,
    name: row.full_name,
    lastVisit: row.last_visit_at ? row.last_visit_at.slice(0, 10) : "No visits yet",
    photo: null,
  };
}

export default function StylistDashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { profile } = useSession();
  const { workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const firstName = (profile?.full_name || "there").split(" ")[0];

  useEffect(() => {
    if (workspaceLoading) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!workspaceId) {
        if (!cancelled) {
          setAppointments([]);
          setClients([]);
          setMonthlyRevenue(null);
          setLoading(false);
        }
        return;
      }

      try {
        const [appointmentRows, clientRows, revenueSummary] = await Promise.all([
          getTodaysAppointments(workspaceId),
          getClients(workspaceId),
          getMonthlyRevenue(workspaceId),
        ]);
        if (cancelled) return;
        setAppointments((appointmentRows ?? []).map(toAppointmentViewModel));
        setClients((clientRows ?? []).map(toClientViewModel));
        setMonthlyRevenue(revenueSummary.totalNet);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading, reloadToken]);

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  // appointments is already scoped to today only (getTodaysAppointments()
  // filters server-side -- see services/appointments.ts), so this just
  // orders what's already the correct set; no client-side date filter
  // needed anymore.
  const todays = useMemo(
    () => [...appointments].sort((a, b) => a.time.localeCompare(b.time)),
    [appointments]
  );

  const totalTravelMin = todays.reduce((s, a) => s + a.travelMinFromPrev, 0);
  const totalDistanceKm = todays.reduce((s, a) => s + a.distanceKmFromPrev, 0);
  const fuelEstimate = (totalDistanceKm * 0.65).toFixed(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, clients]);

  function goToPassport(clientId) {
    setQuery("");
    navigate(`/passport?client=${clientId}`);
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <Layout
      title={isLoading ? "Good to see you" : `Good to see you, ${firstName}`}
      titleAr="أهلاً بك"
      subtitle="Your route, your day, and every client's Beauty Passport — one search away."
    >
      {/* Quick-access search */}
      <div style={{ position: "relative", marginBottom: "var(--space-10)", maxWidth: 480 }}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a client's Beauty Passport…  ابحث عن عميلة"
          icon={<Search size={16} color="var(--text-tertiary)" />}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{ position: "absolute", right: 14, top: 23, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
          >
            <X size={16} />
          </button>
        )}

        {query && (
          <div
            style={{
              position: "absolute",
              zIndex: 10,
              marginTop: 8,
              width: "100%",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-card)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            {results.length === 0 && (
              <p style={{ padding: "16px 20px", fontSize: "var(--text-body-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                No client matches "{query}".
              </p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => goToPassport(c.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-sunken)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <img src={c.photo} alt="" style={{ height: 36, width: 36, borderRadius: "var(--radius-pill)", objectFit: "cover", background: "var(--bg-sunken)" }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                  <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Last visit {c.lastVisit}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's route */}
          <section className="lg:col-span-2">
            <div
              style={{
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-card)",
                padding: "var(--space-8)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: 0 }}>Today's route</h2>
                <Link to="/route" style={{ fontSize: "var(--text-body-sm)", color: "var(--accent-gold-strong)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                  Full map <ArrowUpRight size={14} />
                </Link>
              </div>

              <div
                style={{
                  aspectRatio: "16 / 7",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--space-6)",
                }}
              >
                <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
                  <Navigation size={24} style={{ margin: "0 auto 8px", display: "block", color: "var(--accent-gold-strong)" }} />
                  <p style={{ fontSize: "var(--text-body-sm)", margin: 0 }}>Live route map — wire up Google Maps / Mapbox here</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: "var(--space-6)" }}>
                <RouteStat icon={MapPin} label="Stops" value={isLoading ? "—" : todays.length} />
                <RouteStat icon={Clock} label="Drive time" value={isLoading ? "—" : `${totalTravelMin} min`} />
                <RouteStat icon={Fuel} label="Est. fuel" value={isLoading ? "—" : `SAR ${fuelEstimate}`} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {isLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Skeleton height={56} radius="var(--radius-lg)" />
                    <Skeleton height={56} radius="var(--radius-lg)" />
                  </div>
                )}

                {!isLoading && todays.length === 0 && (
                  <EmptyState title="No visits scheduled today" description="Enjoy the quiet — today's bookings will show up here." />
                )}

                {!isLoading && todays.map((a, i) => (
                  <div key={a.id}>
                    {i > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", paddingLeft: 20, paddingTop: 8, paddingBottom: 8 }}>
                        <Navigation size={11} color="var(--accent-gold-strong)" />
                        {a.travelMinFromPrev} min · {a.distanceKmFromPrev} km to next stop
                      </div>
                    )}
                    <button
                      onClick={() => goToPassport(a.clientId)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--bg-sunken)",
                        padding: "16px 20px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color var(--dur-fast) var(--ease-standard)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-gold)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                    >
                      <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--accent-gold-strong)", fontSize: "var(--text-body-sm)", width: 56, flexShrink: 0 }}>
                        {a.time}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "var(--text-body-sm)", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.client} · {a.service}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "var(--text-caption)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} /> {a.location}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "var(--ls-overline)",
                          padding: "6px 12px",
                          borderRadius: "var(--radius-pill)",
                          border: "1px solid " + (a.status === "confirmed" ? "var(--success-fg)" : "var(--accent-gold-strong)"),
                          color: a.status === "confirmed" ? "var(--success-fg)" : "var(--accent-gold-strong)",
                          flexShrink: 0,
                        }}
                      >
                        {a.status}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Quick stats */}
          <section>
            <div
              style={{
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-card)",
                padding: "var(--space-8)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-6)",
                height: "fit-content",
              }}
            >
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: 0 }}>This month</h2>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-md)", color: "var(--accent-gold-strong)", margin: 0 }}>
                  {isLoading ? "—" : clients.length}
                </p>
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-body-sm)", margin: "4px 0 0" }}>active client passports</p>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-md)", color: "var(--accent-gold-strong)", margin: 0 }}>
                  {isLoading ? "—" : `SAR ${(monthlyRevenue ?? 0).toLocaleString("en-US")}`}
                </p>
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-body-sm)", margin: "4px 0 0" }}>revenue this month</p>
              </div>
              <div>
                {/* No reviews/ratings table exists in the schema yet -- show
                    an honest unavailable state rather than a fabricated number. */}
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-tertiary)", margin: 0 }}>Not available</p>
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-body-sm)", margin: "4px 0 0" }}>average client rating</p>
              </div>
              <Link
                to="/passport"
                style={{
                  marginTop: 8,
                  textAlign: "center",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 500,
                  padding: "14px",
                  textDecoration: "none",
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-sunken)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Browse all passports
              </Link>
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}

function RouteStat({ icon: Icon, label, value }) {
  return (
    <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-sunken)", padding: "14px 12px", textAlign: "center" }}>
      <Icon size={15} color="var(--accent-gold-strong)" style={{ margin: "0 auto 6px", display: "block" }} />
      <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-primary)", fontWeight: 600 }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>{label}</p>
    </div>
  );
}
