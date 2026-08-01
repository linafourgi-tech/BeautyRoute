import React from "react";
export function AIRecommendationCard({ style, reason, matchLabel = "AI match" }) {
  return React.createElement("div", { style: { display: "flex", gap: 14, padding: "var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--surface-card-alt)", border: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { width: 64, height: 64, borderRadius: "var(--radius-md)", flexShrink: 0, background: "linear-gradient(135deg, var(--gold-300), var(--taupe-500))" } }),
    React.createElement("div", null,
      React.createElement("span", { style: { fontSize: 11, fontWeight: 600, letterSpacing: "var(--ls-overline)", textTransform: "uppercase", color: "var(--accent-gold-strong)" } }, matchLabel),
      React.createElement("div", { style: { fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginTop: 4 } }, style),
      React.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)", marginTop: 2 } }, reason)
    )
  );
}
