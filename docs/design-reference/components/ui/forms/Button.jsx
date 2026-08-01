import React from "react";
export function Button({ children, variant = "primary", size = "md", icon, disabled, onClick, type = "button" }) {
  const sizes = { sm: { padding: "8px 16px", fontSize: 13 }, md: { padding: "11px 22px", fontSize: 14 }, lg: { padding: "14px 28px", fontSize: 15 } };
  const base = { fontFamily: "var(--font-body)", fontWeight: 600, borderRadius: "var(--radius-pill)", border: "1px solid transparent", cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", transition: `all var(--dur-base) var(--ease-editorial)`, opacity: disabled ? 0.45 : 1, ...sizes[size] };
  const variants = {
    primary: { background: "var(--charcoal-900)", color: "var(--ivory-100)" },
    gold: { background: "var(--accent-gold)", color: "var(--charcoal-900)" },
    secondary: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
    ghost: { background: "transparent", color: "var(--text-secondary)" },
  };
  const [hover, setHover] = React.useState(false);
  const hoverFx = !disabled && hover ? { transform: "translateY(-2px)", boxShadow: "var(--shadow-md)" } : {};
  return React.createElement("button", { type, disabled, onClick, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), style: { ...base, ...variants[variant], ...hoverFx } }, icon, children);
}
