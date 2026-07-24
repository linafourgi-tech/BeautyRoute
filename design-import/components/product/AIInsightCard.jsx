import React from "react";
export function AIInsightCard({ insight, detail, kind = "recommend", action }) {
  const kinds = {
    recommend: { icon: "M12 3l2 5 5 .5-3.8 3.3L16.5 17 12 14.3 7.5 17l1.3-5.2L5 8.5 10 8z", tint: "var(--accent-gold-strong)" },
    time: { icon: "M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", tint: "var(--success-fg)" },
    health: { icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l9 9 8.6-8.6a5.5 5.5 0 0 0 0-7.8z", tint: "var(--success-fg)" },
  };
  const k = kinds[kind] || kinds.recommend;
  return React.createElement("div", { style: { display: "flex", gap: 14, padding: "var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--surface-card-alt)", border: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { width: 36, height: 36, borderRadius: "50%", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: k.tint } },
      React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" }, React.createElement("path", { d: k.icon }))),
    React.createElement("div", { style: { flex: 1 } },
      React.createElement("div", { style: { fontSize: 11, fontWeight: 600, letterSpacing: "var(--ls-overline)", textTransform: "uppercase", color: k.tint } }, "AI insight"),
      React.createElement("div", { style: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginTop: 4 } }, insight),
      detail && React.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)", marginTop: 2 } }, detail),
      action && React.createElement("div", { style: { marginTop: 10 } }, action))
  );
}
