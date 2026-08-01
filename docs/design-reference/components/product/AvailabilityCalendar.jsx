import React from "react";
// week: array of 7 day objects { label, date, slots:[{time,booked}] }
export function AvailabilityCalendar({ week = [], onToggle }) {
  return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, fontFamily: "var(--font-body)" } },
    week.map((d, di) => React.createElement("div", { key: di, style: { display: "flex", flexDirection: "column", gap: 6 } },
      React.createElement("div", { style: { textAlign: "center", paddingBottom: 4 } },
        React.createElement("div", { style: { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" } }, d.label),
        React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } }, d.date)),
      (d.slots || []).map((s, si) => React.createElement("button", { key: si, onClick: () => onToggle && onToggle(di, si), style: { fontSize: 11, padding: "6px 2px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer", background: s.booked ? "var(--charcoal-900)" : "var(--surface-card)", color: s.booked ? "var(--ivory-100)" : "var(--text-secondary)" } }, s.time))
    ))
  );
}
