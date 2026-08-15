import { Lock, Users, Boxes, Percent, Receipt } from "lucide-react";
import Layout from "../components/Layout";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds. Purely presentational -- no data, no functionality.

const modules = [
  { icon: Users, label: "Employees & reception", desc: "Schedules, roles and permissions per staff member." },
  { icon: Receipt, label: "Point of sale", desc: "Ring up services and products at checkout." },
  { icon: Boxes, label: "Inventory", desc: "Track product stock and reorder points." },
  { icon: Percent, label: "Commission & loyalty", desc: "Automatic staff commission and client loyalty points." },
];

export default function SalonEngine() {
  return (
    <Layout title="Salon Engine" titleAr="الصالون" subtitle="Unlocks when a mobile stylist opens a physical location — the same passport data, now shared across a team.">
      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--accent-gold)", background: "var(--surface-card)", padding: "var(--space-6)", marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ height: 44, width: 44, borderRadius: "50%", background: "var(--bg-sunken)", border: "1px solid var(--accent-gold-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lock size={18} color="var(--accent-gold-strong)" />
        </div>
        <div>
          <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>This engine activates on the Salon plan</p>
          <p style={{ margin: "3px 0 0", color: "var(--text-tertiary)", fontSize: 14 }}>
            You're currently on the Mobile Stylist plan. All your Beauty Passports carry over the day you open a location.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map((m) => (
          <div key={m.label} style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-5)", opacity: 0.7 }}>
            <m.icon size={18} color="var(--accent-gold-strong)" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500, fontSize: 14 }}>{m.label}</p>
            <p style={{ margin: "4px 0 0", color: "var(--text-tertiary)", fontSize: 14 }}>{m.desc}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
