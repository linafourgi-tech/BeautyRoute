import React from "react";
export function ReviewCard({ author, rating = 5, text, date }) {
  return React.createElement("div", { style: { padding: "var(--space-5) var(--space-6)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      React.createElement("span", { style: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" } }, author),
      React.createElement("span", { style: { color: "var(--accent-gold-strong)", fontSize: 13, letterSpacing: 2 } }, "★".repeat(rating))
    ),
    React.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary)", lineHeight: "var(--lh-body)", margin: "10px 0 4px" } }, text),
    date && React.createElement("span", { style: { fontSize: 12, color: "var(--text-tertiary)" } }, date)
  );
}
