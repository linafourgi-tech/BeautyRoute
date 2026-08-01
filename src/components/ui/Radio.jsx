import React from "react";

// Accessibility fix (Phase 7): same pattern as Checkbox.jsx -- a real
// <input type="radio"> now drives the visuals instead of a <span onClick>.
// `name` is new (optional, defaults so a lone Radio still behaves like a
// simple toggle) -- real radio-group keyboard behavior (arrow keys moving
// selection) only works when grouped inputs share a name, which the
// original component had no way to express at all.
export function Radio({ label, checked, onChange, name = "radio", value }) {
  const [focused, setFocused] = React.useState(false);

  return React.createElement(
    "label",
    { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement(
      "span",
      { style: { position: "relative", width: 18, height: 18, display: "inline-flex", flexShrink: 0 } },
      React.createElement("input", {
        type: "radio",
        name,
        value,
        checked: !!checked,
        onChange: () => onChange && onChange(),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" },
      }),
      React.createElement(
        "span",
        {
          "aria-hidden": "true",
          style: {
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "1.5px solid " + (checked ? "var(--accent-gold-strong)" : "var(--border-strong)"),
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--dur-fast) var(--ease-standard)",
            boxShadow: focused ? "0 0 0 3px var(--focus-ring)" : "none",
            pointerEvents: "none",
          },
        },
        checked && React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: "var(--accent-gold)" } })
      )
    ),
    label
  );
}
