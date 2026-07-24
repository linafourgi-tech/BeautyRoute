import React from "react";
export function Checkbox({ label, checked, onChange }) {
  return React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement("span", { onClick: () => onChange && onChange(!checked), style: { width: 18, height: 18, borderRadius: 5, border: "1.5px solid " + (checked ? "var(--accent-gold-strong)" : "var(--border-strong)"), background: checked ? "var(--accent-gold)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all var(--dur-fast) var(--ease-standard)" } },
      checked && React.createElement("svg", { width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: "var(--charcoal-900)", strokeWidth: 3 }, React.createElement("polyline", { points: "20 6 9 17 4 12" }))
    ),
    label
  );
}
