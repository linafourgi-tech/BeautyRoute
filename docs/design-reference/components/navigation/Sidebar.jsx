import React from "react";
export function Sidebar({ items = [], active, onNavigate, footer }) {
  return React.createElement("aside", { style: { width: 240, height: "100%", background: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", padding: "var(--space-6)", boxSizing: "border-box", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: 19, marginBottom: 32, color: "var(--text-primary)" } }, "Beauty", React.createElement("span", { style: { color: "var(--accent-gold-strong)" } }, "Route")),
    React.createElement("nav", { style: { display: "flex", flexDirection: "column", gap: 4, flex: 1 } },
      items.map((it, i) => React.createElement("a", { key: i, onClick: () => onNavigate && onNavigate(it), style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 14, fontWeight: 500, cursor: "pointer", color: active === it ? "var(--text-primary)" : "var(--text-tertiary)", background: active === it ? "var(--bg-sunken)" : "transparent" } }, it))
    ),
    footer
  );
}
