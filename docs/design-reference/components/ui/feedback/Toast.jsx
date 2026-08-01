import React from "react";
export function Toast({ message, tone = "neutral", onClose }) {
  const tones = { neutral: "var(--charcoal-900)", success: "var(--success-fg)", error: "var(--error-fg)" };
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: "var(--radius-md)", background: "var(--charcoal-900)", color: "var(--ivory-100)", boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-body)", fontSize: 14, borderLeft: `3px solid ${tones[tone]}` } },
    message,
    onClose && React.createElement("span", { onClick: onClose, style: { marginLeft: "auto", cursor: "pointer", opacity: 0.6 } }, "×")
  );
}
