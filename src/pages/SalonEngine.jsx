import { Lock, Users, Boxes, Percent, Receipt } from "lucide-react";
import Layout from "../components/Layout";

const modules = [
  { icon: Users, label: "Employees & reception", desc: "Schedules, roles and permissions per staff member." },
  { icon: Receipt, label: "Point of sale", desc: "Ring up services and products at checkout." },
  { icon: Boxes, label: "Inventory", desc: "Track product stock and reorder points." },
  { icon: Percent, label: "Commission & loyalty", desc: "Automatic staff commission and client loyalty points." },
];

export default function SalonEngine() {
  return (
    <Layout
      title="Salon Engine"
      subtitle="Unlocks when a mobile stylist opens a physical location — the same passport data, now shared across a team."
    >
      <div className="rounded-2xl border border-gold/40 bg-surface p-6 mb-6 flex items-center gap-4">
        <div className="h-11 w-11 rounded-full bg-surface-2 border border-gold/50 flex items-center justify-center shrink-0">
          <Lock size={18} className="text-gold" />
        </div>
        <div>
          <p className="text-ivory font-medium">This engine activates on the Salon plan</p>
          <p className="text-muted text-sm mt-0.5">
            You're currently on the Mobile Stylist plan. All your Beauty Passports carry over the day you open a location.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map((m) => (
          <div key={m.label} className="rounded-2xl border border-line bg-surface p-5 opacity-70">
            <m.icon size={18} className="text-gold mb-3" />
            <p className="text-ivory font-medium text-sm">{m.label}</p>
            <p className="text-muted text-sm mt-1">{m.desc}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
