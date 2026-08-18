import React from "react";
// RTL fix (design-refinement pass, final audit): borderLeft/marginLeft are
// physical properties that don't flip under dir="rtl" -- the logical
// equivalents (borderInlineStart/marginInlineStart) keep the tone stripe
// and the close "x" on the same semantic edge (start/end of reading
// order) regardless of language. Not currently rendered anywhere in the
// app (no page imports Toast yet), fixed for correctness before it is.
export function Toast({ message, tone = "neutral", onClose }) {
  const tones = { neutral: "var(--charcoal-900)", success: "var(--success-fg)", error: "var(--error-fg)" };
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: "var(--radius-md)", background: "var(--charcoal-900)", color: "var(--ivory-100)", boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-body)", fontSize: 14, borderInlineStart: `3px solid ${tones[tone]}` } },
    message,
    onClose && React.createElement("span", { onClick: onClose, style: { marginInlineStart: "auto", cursor: "pointer", opacity: 0.6 } }, "×")
  );
}
