import React from "react";
// items: [{ title, body, time, kind, unread }]
export function NotificationCenter({ items = [] }) {
  const dot = { booking: "var(--success-fg)", promo: "var(--accent-gold-strong)", system: "var(--text-tertiary)", review: "var(--accent-gold-strong)" };
  return React.createElement("div", { style: { fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" } },
    items.map((n, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 12, padding: "14px 4px", borderTop: i ? "1px solid var(--border-subtle)" : "none", background: n.unread ? "var(--surface-card-alt)" : "transparent" } },
      React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: n.unread ? (dot[n.kind] || "var(--accent-gold)") : "transparent", marginTop: 6, flexShrink: 0 } }),
      React.createElement("div", { style: { flex: 1 } },
        React.createElement("div", { style: { fontSize: 14, fontWeight: n.unread ? 600 : 500, color: "var(--text-primary)" } }, n.title),
        n.body && React.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)", marginTop: 2 } }, n.body)),
      React.createElement("span", { style: { fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" } }, n.time))
    )
  );
}
