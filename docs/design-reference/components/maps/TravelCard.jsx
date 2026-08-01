import React from "react";
export function TravelCard({ destination, distanceKm, minutes, leaveIn, onNavigate }) {
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "var(--space-4) var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { width: 40, height: 40, borderRadius: "50%", background: "var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-secondary)" } },
      React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6 }, React.createElement("path", { d: "M3 17l4-10 5 2 5-2 4 10" }), React.createElement("circle", { cx: 8, cy: 20, r: 1.5 }), React.createElement("circle", { cx: 16, cy: 20, r: 1.5 }))),
    React.createElement("div", { style: { flex: 1 } },
      React.createElement("div", { style: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" } }, destination),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, distanceKm, " km · ", minutes, " min drive", leaveIn != null && " · leave in " + leaveIn + " min")),
    React.createElement("button", { onClick: onNavigate, style: { border: "1px solid var(--border-default)", background: "transparent", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)", whiteSpace: "nowrap" } }, "Open in Maps")
  );
}
