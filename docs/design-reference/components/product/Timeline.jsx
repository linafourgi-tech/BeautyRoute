import React from "react";
// items: [{ date, title, subtitle, meta, thumb }]
export function Timeline({ items = [] }) {
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    items.map((it, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 16 } },
      React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
        React.createElement("div", { style: { width: 10, height: 10, borderRadius: "50%", background: "var(--accent-gold)", marginTop: 6 } }),
        i < items.length - 1 && React.createElement("div", { style: { width: 2, flex: 1, background: "var(--border-subtle)", minHeight: 32 } })),
      React.createElement("div", { style: { paddingBottom: 20, flex: 1 } },
        React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)" } }, it.date),
        React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 } }, it.title),
        it.subtitle && React.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)", marginTop: 2 } }, it.subtitle),
        it.meta && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 } }, it.meta))
    ))
  );
}
