import { useState } from "react";
import { MapPin, Clock, Plus } from "lucide-react";
import { appointments } from "../data/mockData";
import Layout from "../components/Layout";

const dates = [...new Set(appointments.map((a) => a.date))].sort();

export default function Appointments() {
  const [active, setActive] = useState(dates[0]);
  const dayAppts = appointments.filter((a) => a.date === active);

  return (
    <Layout
      title="Appointment Engine"
      subtitle="Booking, calendar, waiting list, cancellations and reminders — all in one thread."
    >
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm border transition-colors ${
              active === d
                ? "bg-wine border-wine text-onaccent"
                : "border-line text-muted hover:text-ivory"
            }`}
          >
            {new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </button>
        ))}
        <button className="ml-auto shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-gold text-gold hover:bg-gold hover:text-onaccent transition-colors">
          <Plus size={15} /> New booking
        </button>
      </div>

      <div className="space-y-3">
        {dayAppts.length === 0 && (
          <p className="text-muted text-sm">Nothing booked this day yet.</p>
        )}
        {dayAppts.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-5 flex items-center gap-5">
            <div className="text-center shrink-0 w-16">
              <p className="font-mono-tag text-gold text-lg leading-none">{a.time}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-ivory font-medium">{a.client}</p>
              <p className="text-muted text-sm">{a.service}</p>
              <p className="text-muted text-xs flex items-center gap-1 mt-1">
                <MapPin size={12} /> {a.location}
                <Clock size={12} className="ml-3" /> ~45 min
              </p>
            </div>
            <span className={`text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0 ${
              a.status === "confirmed" ? "border-sage text-sage" : "border-gold text-gold"
            }`}>
              {a.status}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
        Coming to this engine: waiting-list auto-fill when a slot cancels, peak-day pricing suggestions,
        and WhatsApp-native reminders sent 24h and 2h before each visit.
      </div>
    </Layout>
  );
}
