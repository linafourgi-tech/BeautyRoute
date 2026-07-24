import React from "react";
export function Tabs({ tabs = [], active, onChange }) {
  return React.createElement("div", { style: { display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" } },
    tabs.map((t, i) => React.createElement("button", {
      key: i, onClick: () => onChange && onChange(t.value ?? t),
      style: { background: "none", border: "none", cursor: "pointer", padding: "12px 18px", fontSize: 14, fontWeight: 500, color: (active === (t.value ?? t)) ? "var(--text-primary)" : "var(--text-tertiary)", borderBottom: "2px solid " + ((active === (t.value ?? t)) ? "var(--accent-gold-strong)" : "transparent"), transition: "all var(--dur-fast) var(--ease-standard)" }
    }, t.label ?? t))
  );
}
