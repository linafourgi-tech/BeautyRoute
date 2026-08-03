import React from "react";

// Accessibility fix (Phase 8): label had no htmlFor/id association with its
// input -- visually adjacent but not programmatically linked, so a screen
// reader wouldn't announce the label when the input receives focus. useId()
// gives each instance a stable, unique id without needing callers to pass
// one. Visual appearance and props are unchanged.
//
// Accessibility fix (Phase 16 Step 3): the error/hint text below the input
// was visually adjacent but had no programmatic link to the input at all --
// a screen reader focusing the input never heard the error, and nothing
// exposed the field's invalid state. aria-invalid + aria-describedby fix
// that; role="alert" on an active error (not a plain hint) makes it get
// announced as soon as it appears, not only when the user happens to land
// on it. Visual appearance is unchanged.
export function Input({ label, placeholder, type = "text", value, onChange, error, hint, icon }) {
  const [focus, setFocus] = React.useState(false);
  const id = React.useId();
  const descriptionId = `${id}-description`;
  const hasDescription = Boolean(hint || error);

  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-body)" } },
    label && React.createElement("label", { htmlFor: id, style: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" } }, label),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 46, borderRadius: "var(--radius-md)", background: "var(--surface-card)", border: "1px solid " + (error ? "var(--error-fg)" : focus ? "var(--accent-gold-strong)" : "var(--border-default)"), boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none", transition: "all var(--dur-fast) var(--ease-standard)" } },
      icon,
      React.createElement("input", { id, type, placeholder, value, onChange, onFocus: () => setFocus(true), onBlur: () => setFocus(false), "aria-invalid": error ? "true" : undefined, "aria-describedby": hasDescription ? descriptionId : undefined, style: { border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)" } })
    ),
    hasDescription && React.createElement("span", { id: descriptionId, role: error ? "alert" : undefined, style: { fontSize: 12, color: error ? "var(--error-fg)" : "var(--text-tertiary)" } }, error || hint)
  );
}
