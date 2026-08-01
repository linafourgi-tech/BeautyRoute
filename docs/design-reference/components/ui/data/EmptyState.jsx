import React from "react";
export function EmptyState({ title, description, action }) {
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: "var(--space-16) var(--space-8)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)" } }, title),
    description && React.createElement("div", { style: { color: "var(--text-tertiary)", fontSize: 14, maxWidth: 360 } }, description),
    action && React.createElement("div", { style: { marginTop: 12 } }, action)
  );
}
