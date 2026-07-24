import React from "react";
// Lightweight static map motif for card contexts. Real pan/zoom maps use Leaflet
// on plain-HTML screens (see ui_kits route screen) — never inside the bundle.
export function MapCard({ label = "Al Yasmin District", distanceKm, height = 160, pins = 1, route }) {
  return React.createElement("div", { style: { position: "relative", height, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)", background: "linear-gradient(135deg,#EFEDE7,#E3E0D6)", fontFamily: "var(--font-body)" } },
    React.createElement("svg", { width: "100%", height: "100%", viewBox: "0 0 300 160", preserveAspectRatio: "xMidYMid slice", style: { position: "absolute", inset: 0 } },
      [30, 80, 130].map((y, i) => React.createElement("line", { key: "h" + i, x1: 0, y1: y, x2: 300, y2: y, stroke: "rgba(31,27,24,0.06)", strokeWidth: 8 })),
      [60, 150, 240].map((x, i) => React.createElement("line", { key: "v" + i, x1: x, y1: 0, x2: x, y2: 160, stroke: "rgba(31,27,24,0.06)", strokeWidth: 8 })),
      route && React.createElement("path", { d: "M50 120 C110 120 120 50 180 50 S250 40 260 30", fill: "none", stroke: "var(--accent-gold-strong)", strokeWidth: 3, strokeDasharray: "2 6", strokeLinecap: "round" })
    ),
    React.createElement("div", { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-100%)" } },
      React.createElement("div", { style: { width: 22, height: 22, borderRadius: "50% 50% 50% 0", background: "var(--charcoal-900)", transform: "rotate(-45deg)", boxShadow: "var(--shadow-md)" } })
    ),
    (label || distanceKm != null) && React.createElement("div", { style: { position: "absolute", left: 12, bottom: 12, background: "rgba(250,247,242,0.92)", backdropFilter: "blur(6px)", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontSize: 12, fontWeight: 500, color: "var(--text-primary)", display: "flex", gap: 8, alignItems: "center" } },
      label, distanceKm != null && React.createElement("span", { style: { color: "var(--text-tertiary)" } }, distanceKm + " km"))
  );
}
