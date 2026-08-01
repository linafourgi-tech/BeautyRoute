import React from "react";

// Accessibility fix (Phase 7): the original was a <span onClick> with no
// keyboard support, no focusable element, and no real checkbox semantics.
// Now a real <input type="checkbox"> (visually hidden but focusable and
// clickable) drives a purely decorative, aria-hidden custom box next to it --
// native keyboard (Space), screen-reader semantics, and label-click-to-toggle
// all come for free from the real input. Visual appearance is unchanged.
export function Checkbox({ label, checked, onChange }) {
  const [focused, setFocused] = React.useState(false);

  return React.createElement(
    "label",
    { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement(
      "span",
      { style: { position: "relative", width: 18, height: 18, display: "inline-flex", flexShrink: 0 } },
      React.createElement("input", {
        type: "checkbox",
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
            width: 18,
            height: 18,
            borderRadius: 5,
            border: "1.5px solid " + (checked ? "var(--accent-gold-strong)" : "var(--border-strong)"),
            background: checked ? "var(--accent-gold)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--dur-fast) var(--ease-standard)",
            boxShadow: focused ? "0 0 0 3px var(--focus-ring)" : "none",
            pointerEvents: "none",
          },
        },
        checked && React.createElement("svg", { width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: "var(--charcoal-900)", strokeWidth: 3 }, React.createElement("polyline", { points: "20 6 9 17 4 12" }))
      )
    ),
    label
  );
}
