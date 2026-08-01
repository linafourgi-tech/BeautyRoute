import React from "react";
export function Dialog({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "var(--overlay-scrim)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: `blur(${"var(--blur-glass)"})` }, onClick: onClose },
    React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "var(--space-8)", width: 420, maxWidth: "90vw", fontFamily: "var(--font-body)" } },
      title && React.createElement("h3", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", margin: "0 0 16px", color: "var(--text-primary)" } }, title),
      React.createElement("div", { style: { color: "var(--text-secondary)", fontSize: 14, lineHeight: "var(--lh-body)" } }, children),
      footer && React.createElement("div", { style: { marginTop: 24, display: "flex", gap: 10, justifyContent: "flex-end" } }, footer)
    )
  );
}
