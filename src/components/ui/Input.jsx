import React from "react";

// Accessibility fix (Phase 8): label had no htmlFor/id association with its
// input -- visually adjacent but not programmatically linked, so a screen
// reader wouldn't announce the label when the input receives focus. useId()
// gives each instance a stable, unique id without needing callers to pass
// one. Visual appearance and props are unchanged.
export function Input({ label, placeholder, type = "text", value, onChange, error, hint, icon }) {
  const [focus, setFocus] = React.useState(false);
  const id = React.useId();

  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-body)" } },
    label && React.createElement("label", { htmlFor: id, style: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" } }, label),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 46, borderRadius: "var(--radius-md)", background: "var(--surface-card)", border: "1px solid " + (error ? "var(--error-fg)" : focus ? "var(--accent-gold-strong)" : "var(--border-default)"), boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none", transition: "all var(--dur-fast) var(--ease-standard)" } },
      icon,
      React.createElement("input", { id, type, placeholder, value, onChange, onFocus: () => setFocus(true), onBlur: () => setFocus(false), style: { border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)" } })
    ),
    (hint || error) && React.createElement("span", { style: { fontSize: 12, color: error ? "var(--error-fg)" : "var(--text-tertiary)" } }, error || hint)
  );
}
