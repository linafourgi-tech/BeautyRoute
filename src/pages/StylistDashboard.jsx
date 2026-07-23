import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, MapPin, Clock, Search, Navigation, Fuel, X } from "lucide-react";
import { stylist, appointments, clients } from "../data/mockData";
import Layout from "../components/Layout";

const TODAY = "2026-07-19";

export default function StylistDashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const todays = useMemo(
    () => appointments.filter((a) => a.date === TODAY).sort((a, b) => a.time.localeCompare(b.time)),
    []
  );

  const totalTravelMin = todays.reduce((s, a) => s + a.travelMinFromPrev, 0);
  const totalDistanceKm = todays.reduce((s, a) => s + a.distanceKmFromPrev, 0);
  const fuelEstimate = (totalDistanceKm * 0.65).toFixed(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  function goToPassport(clientId) {
    setQuery("");
    navigate(`/passport?client=${clientId}`);
  }

  return (
    <Layout
      title={`Good to see you, ${stylist.name.split(" ")[0]}`}
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
            <RouteStat icon={MapPin} label="Stops" value={todays.length} />
            <RouteStat icon={Clock} label="Drive time" value={`${totalTravelMin} min`} />
            <RouteStat icon={Fuel} label="Est. fuel" value={`SAR ${fuelEstimate}`} />
          </div>

          <div className="space-y-4">
            {todays.length === 0 && (
              <p className="text-muted text-sm">No visits scheduled today. Enjoy the quiet.</p>
            )}
            {todays.map((a, i) => (
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
            <p className="text-3xl font-display text-wine">{clients.length}</p>
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
