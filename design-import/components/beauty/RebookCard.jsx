import React from "react";
import { EditorialImage } from "../media/EditorialImage.jsx";
export function RebookCard({ professional, service, lastVisit, duration, price, suggestedDate, onRebook, tone = "sand" }) {
  return React.createElement("div", { style: { display: "flex", gap: 14, padding: "var(--space-4)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)", alignItems: "center" } },
    React.createElement("div", { style: { width: 64, flexShrink: 0 } }, React.createElement(EditorialImage, { tone: tone, label: "", ratio: "1 / 1", radius: "var(--radius-md)" })),
    React.createElement("div", { style: { flex: 1 } },
      React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } }, service),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, "with ", professional, " · last visit ", lastVisit),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)", marginTop: 4 } }, duration, " · ", price, suggestedDate && " · suggested " + suggestedDate)),
    React.createElement("button", { onClick: onRebook, style: { border: "none", background: "var(--accent-gold)", color: "var(--charcoal-900)", borderRadius: "var(--radius-pill)", padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" } }, "Book again")
  );
}
