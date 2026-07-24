import React from "react";
// stops: [{ time, title, place, service }]; legs between them: [{ minutes }]
export function RouteTimeline({ stops = [], legs = [] }) {
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    stops.map((s, i) => React.createElement(React.Fragment, { key: i },
      React.createElement("div", { style: { display: "flex", gap: 14 } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
          React.createElement("div", { style: { width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--accent-gold-strong)", background: "var(--surface-card)", marginTop: 4 } }),
          i < stops.length - 1 && React.createElement("div", { style: { width: 2, flex: 1, background: "var(--border-default)", minHeight: 28 } })),
        React.createElement("div", { style: { paddingBottom: 8 } },
          React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } }, s.time, "  ", s.title),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, "📍 ", s.place, s.service && " · " + s.service))
      ),
      legs[i] && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px 26px", fontSize: 12, color: "var(--text-tertiary)" } },
        React.createElement("span", { style: { width: 24, height: 1, background: "var(--border-default)" } }), legs[i].minutes, " min drive")
    ))
  );
}
