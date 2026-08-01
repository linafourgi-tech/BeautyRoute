import React from "react";
// Provider-driven booking locations. `locations` comes from the provider profile —
// never hardcode "At the salon". Each: { id, type, label, detail, fee, address }.
// type is open-ended (salon | studio | client | partner-salon | future types).
export function BookingLocations({ locations = [], value, onChange, lang = "en" }) {
  const rtl = lang === "ar";
  const fmtFee = (fee) => {
    const amt = new Intl.NumberFormat(rtl ? "ar-SA" : "en-GB", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(fee);
    return rtl ? (amt + " · تنقّل") : ("+ " + amt + " travel");
  };
  const icons = {
    salon: "M4 21V9l8-5 8 5v12 M9 21v-6h6v6",
    studio: "M3 21V8l9-5 9 5v13 M3 21h18 M10 21v-5h4v5",
    client: "M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z",
    "partner-salon": "M4 21V9l8-5 8 5v12 M9 21v-6h6v6",
  };
  if (locations.length === 0) return React.createElement("p", { style: { fontSize: 13, color: "var(--text-tertiary)", fontFamily: "var(--font-body)", margin: 0 } }, rtl ? "لم يحدّد هذا المحترف مكان حجز بعد." : "This professional hasn't set a booking location yet.");
  return React.createElement("div", { style: { display: "grid", gridTemplateColumns: locations.length > 2 ? "1fr" : "1fr 1fr", gap: 14, fontFamily: "var(--font-body)" } },
    locations.map(o => {
      const on = value === o.id;
      return React.createElement("button", { key: o.id, onClick: () => onChange && onChange(o.id), style: { textAlign: "start", cursor: "pointer", padding: "16px 18px", borderRadius: "var(--radius-lg)", background: on ? "var(--surface-card)" : "transparent", border: "1.5px solid " + (on ? "var(--accent-gold-strong)" : "var(--border-subtle)"), boxShadow: on ? "var(--shadow-sm)" : "none", transition: "all var(--dur-base) var(--ease-editorial)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 } },
          React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 10 } },
            React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: on ? "var(--accent-gold-strong)" : "var(--text-tertiary)", strokeWidth: 1.6, strokeLinejoin: "round" }, React.createElement("path", { d: icons[o.type] || icons.client })),
            React.createElement("span", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } }, o.label)),
          React.createElement("span", { style: { width: 16, height: 16, borderRadius: "50%", border: "1.5px solid " + (on ? "var(--accent-gold-strong)" : "var(--border-strong)"), display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, on && React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent-gold)" } }))),
        (o.detail || o.fee != null) && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, paddingInlineStart: 28 } }, o.fee ? fmtFee(o.fee) : o.detail));
    })
  );
}
