import React from "react";
export function Badge({ children, tone = "neutral" }) {
  const tones = { neutral: { background: "var(--bg-sunken)", color: "var(--text-secondary)" }, success: { background: "var(--success-bg)", color: "var(--success-fg)" }, warning: { background: "var(--warning-bg)", color: "var(--warning-fg)" }, error: { background: "var(--error-bg)", color: "var(--error-fg)" }, gold: { background: "var(--accent-gold)", color: "var(--charcoal-900)" } };
  return React.createElement("span", { style: { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "var(--radius-pill)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-body)", ...tones[tone] } }, children);
}
