import { useEffect, useState } from "react";
import { MapPin, Fuel, Clock, Navigation } from "lucide-react";
import Layout from "../components/Layout";
import { getAppointments } from "../services/appointments";
import { getWorkspaces } from "../services/workspaces";
import { toAppointmentViewModel } from "../lib/appointmentView";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function RouteEngine() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const workspaces = await getWorkspaces();
      const workspaceId = workspaces?.[0]?.id;
      if (!workspaceId) {
        if (!cancelled) {
          setStops([]);
          setLoading(false);
        }
        return;
      }
      const rows = await getAppointments(workspaceId);
      if (cancelled) return;
      const today = todayISODate();
      const mapped = (rows ?? [])
        .map(toAppointmentViewModel)
        .filter((a) => a.date === today);
      setStops(mapped);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout
      title="Route Engine"
      subtitle="Smart routing for mobile stylists — traffic-aware, with fuel and travel time estimated per stop."
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="aspect-[16/10] rounded-xl bg-surface-2 border border-line flex items-center justify-center">
            <div className="text-center text-muted">
              <Navigation size={28} className="mx-auto mb-2 text-gold" />
              <p className="text-sm">Map view — wire up Google Maps / Mapbox here</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading && <p className="text-muted text-sm">Loading today's stops…</p>}
            {!loading && stops.length === 0 && (
              <p className="text-muted text-sm">No stops scheduled today.</p>
            )}
            {stops.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4">
                <div className="h-7 w-7 rounded-full bg-wine text-onaccent text-xs flex items-center justify-center font-mono-tag shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-ivory text-sm">{s.client}</p>
                  <p className="text-muted text-xs flex items-center gap-1">
                    <MapPin size={11} /> {s.location} · {s.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 h-fit space-y-5">
          <h2 className="font-display text-lg text-ivory">Today's route</h2>
          {/*
            travelMinFromPrev / distanceKmFromPrev from the old mock data have no
            schema-backed source (no routing/distance table or service exists).
            Left as explicit static placeholders rather than fabricated real-looking
            numbers — do not wire these to real data without a routing feature.
          */}
          <Stat icon={MapPin} label="Total distance" value="18.4 km" />
          <Stat icon={Clock} label="Drive time" value="34 min" />
          <Stat icon={Fuel} label="Est. fuel cost" value="SAR 12" />
          <div className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            The engine reorders stops automatically when live traffic changes your fastest path.
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-muted text-sm flex items-center gap-2"><Icon size={14} /> {label}</span>
      <span className="text-ivory font-mono-tag text-sm">{value}</span>
    </div>
  );
}
