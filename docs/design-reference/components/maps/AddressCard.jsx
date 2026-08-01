import React from "react";
export function AddressCard({ label, address, selected, primary, onSelect }) {
  return React.createElement("button", { onClick: onSelect, style: { width: "100%", textAlign: "start", display: "flex", gap: 12, alignItems: "flex-start", padding: "var(--space-4)", borderRadius: "var(--radius-md)", cursor: "pointer", background: "var(--surface-card)", border: "1px solid " + (selected ? "var(--accent-gold-strong)" : "var(--border-subtle)"), boxShadow: selected ? "0 0 0 3px var(--focus-ring)" : "none", fontFamily: "var(--font-body)" } },
    React.createElement("span", { style: { color: "var(--text-tertiary)", marginTop: 2 } }, React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6 }, React.createElement("path", { d: "M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" }), React.createElement("circle", { cx: 12, cy: 10, r: 2.5 }))),
    React.createElement("span", { style: { flex: 1 } },
      React.createElement("span", { style: { display: "flex", gap: 8, alignItems: "center" } },
        React.createElement("span", { style: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" } }, label),
        primary && React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "var(--accent-gold-strong)" } }, "Primary")),
      React.createElement("span", { style: { display: "block", fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, address))
  );
}
