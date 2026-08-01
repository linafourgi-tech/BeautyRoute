import React from "react";

// Accessibility fix (Phase 7): a real <input type="checkbox" role="switch">
// now drives the visuals instead of a <span onClick>. role="switch" makes
// screen readers announce it as a toggle rather than a plain checkbox, which
// matches what it visually looks/behaves like.
export function Switch({ checked, onChange, label }) {
  const [focused, setFocused] = React.useState(false);

  return React.createElement(
    "label",
    { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement(
      "span",
      { style: { position: "relative", width: 40, height: 24, display: "inline-flex", flexShrink: 0 } },
      React.createElement("input", {
        type: "checkbox",
        role: "switch",
        "aria-checked": !!checked,
        checked: !!checked,
        onChange: (e) => onChange && onChange(e.target.checked),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" },
      }),
      React.createElement(
        "span",
        {
          "aria-hidden": "true",
          style: {
            width: 40,
            height: 24,
            borderRadius: "var(--radius-pill)",
            background: checked ? "var(--accent-gold)" : "var(--border-strong)",
            position: "relative",
            display: "block",
            transition: "background var(--dur-base) var(--ease-standard)",
            boxShadow: focused ? "0 0 0 3px var(--focus-ring)" : "none",
            pointerEvents: "none",
          },
        },
        React.createElement("span", { style: { position: "absolute", top: 3, left: checked ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: "var(--white)", boxShadow: "var(--shadow-xs)", transition: "left var(--dur-base) var(--ease-editorial)" } })
      )
    ),
    label
  );
}
