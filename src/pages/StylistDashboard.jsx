import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, MapPin, Clock, Search, Navigation, Fuel, X } from "lucide-react";
import Layout from "../components/Layout";
import { useSession } from "../hooks/useSession";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getAppointments } from "../services/appointments";
import { getClients } from "../services/clients";
import { toAppointmentViewModel } from "../lib/appointmentView";
import { Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

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
          setLoading(false);
        }
        return;
      }

      try {
        const [appointmentRows, clientRows] = await Promise.all([
          getAppointments(workspaceId),
          getClients(workspaceId),
        ]);
        if (cancelled) return;
        setAppointments((appointmentRows ?? []).map(toAppointmentViewModel));
        setClients((clientRows ?? []).map(toClientViewModel));
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

  const todays = useMemo(() => {
    const today = todayISODate();
    return appointments
      .filter((a) => a.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments]);

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
      <div className="relative mb-10 max-w-xl">
        <Search size={17} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a client's Beauty Passport…  ابحث عن عميلة"
          className="w-full bg-surface border border-line rounded-full pl-12 pr-11 py-4 text-[15px] text-ivory placeholder:text-muted outline-none focus:border-wine transition-colors shadow-[0_1px_2px_rgba(43,36,32,0.04)]"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted hover:text-ivory"
          >
            <X size={16} />
          </button>
        )}

        {query && (
          <div className="absolute z-10 mt-2 w-full rounded-2xl border border-line bg-surface shadow-xl overflow-hidden">
            {results.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted">No client matches "{query}".</p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => goToPassport(c.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-2 text-left transition-colors"
              >
                <img src={c.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="text-ivory text-sm truncate">{c.name}</p>
                  <p className="text-muted text-xs truncate">Last visit {c.lastVisit}</p>
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
          <section className="lg:col-span-2 rounded-3xl border border-line bg-surface p-7 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-ivory">Today's route</h2>
              <Link to="/route" className="text-sm text-wine flex items-center gap-1 hover:underline">
                Full map <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="aspect-[16/7] rounded-2xl bg-surface-2 border border-line flex items-center justify-center mb-6">
              <div className="text-center text-muted">
                <Navigation size={24} className="mx-auto mb-2 text-wine" />
                <p className="text-sm">Live route map — wire up Google Maps / Mapbox here</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <RouteStat icon={MapPin} label="Stops" value={isLoading ? "—" : todays.length} />
              <RouteStat icon={Clock} label="Drive time" value={isLoading ? "—" : `${totalTravelMin} min`} />
              <RouteStat icon={Fuel} label="Est. fuel" value={isLoading ? "—" : `SAR ${fuelEstimate}`} />
            </div>

            <div className="space-y-4">
              {isLoading && (
                <div className="beautyroute-ds space-y-3">
                  <Skeleton height={56} radius="var(--radius-lg)" />
                  <Skeleton height={56} radius="var(--radius-lg)" />
                </div>
              )}

              {!isLoading && todays.length === 0 && (
                <div className="beautyroute-ds">
                  <EmptyState title="No visits scheduled today" description="Enjoy the quiet — today's bookings will show up here." />
                </div>
              )}

              {!isLoading && todays.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted pl-5 py-2">
                      <Navigation size={11} className="text-gold" />
                      {a.travelMinFromPrev} min · {a.distanceKmFromPrev} km to next stop
                    </div>
                  )}
                  <button
                    onClick={() => goToPassport(a.clientId)}
                    className="w-full flex items-center gap-4 rounded-2xl border border-line bg-surface-2 px-5 py-4 text-left hover:border-wine/50 transition-colors"
                  >
                    <div className="font-mono-tag text-wine text-sm w-14 shrink-0">{a.time}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ivory text-sm font-medium truncate">{a.client} · {a.service}</p>
                      <p className="text-muted text-xs flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {a.location}
                      </p>
                    </div>
                    <span className={`text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-full border shrink-0 ${
                      a.status === "confirmed" ? "border-sage text-sage" : "border-gold text-gold"
                    }`}>
                      {a.status}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Quick stats */}
          <section className="rounded-3xl border border-line bg-surface p-7 md:p-8 flex flex-col gap-6 h-fit">
            <h2 className="font-display text-2xl text-ivory">This month</h2>
            <div>
              <p className="text-3xl font-display text-wine">{isLoading ? "—" : clients.length}</p>
              <p className="text-muted text-sm mt-1">active client passports</p>
            </div>
            <div>
              <p className="text-3xl font-display text-wine">SAR 5,600</p>
              <p className="text-muted text-sm mt-1">revenue so far</p>
            </div>
            <div>
              <p className="text-3xl font-display text-wine">4.9 ★</p>
              <p className="text-muted text-sm mt-1">average client rating</p>
            </div>
            <Link
              to="/passport"
              className="mt-2 text-center rounded-2xl border border-line text-ivory text-sm font-medium py-3.5 hover:bg-surface-2 transition-colors"
            >
              Browse all passports
            </Link>
          </section>
        </div>
      )}
    </Layout>
  );
}

function RouteStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3.5 text-center">
      <Icon size={15} className="mx-auto text-wine mb-1.5" />
      <p className="text-ivory text-sm font-mono-tag">{value}</p>
      <p className="text-muted text-[11px] mt-0.5">{label}</p>
    </div>
  );
}
