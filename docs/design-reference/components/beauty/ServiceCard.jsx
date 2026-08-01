import React from "react";
export function ServiceCard({ name, duration, price, onBook }) {
  return React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-5) var(--space-6)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)" } },
    React.createElement("div", null,
      React.createElement("div", { style: { fontSize: 15, fontWeight: 500, color: "var(--text-primary)" } }, name),
      React.createElement("div", { style: { fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 } }, duration, " · ", price)
    ),
    React.createElement("button", { onClick: onBook, style: { background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--radius-pill)", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" } }, "Book")
  );
}
