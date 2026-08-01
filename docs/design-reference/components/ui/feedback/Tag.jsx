import React from "react";
export function Tag({ children, onRemove, selected, onClick }) {
  return React.createElement("span", { onClick, style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: "var(--radius-pill)", fontSize: 13, fontFamily: "var(--font-body)", border: "1px solid " + (selected ? "var(--accent-gold-strong)" : "var(--border-default)"), background: selected ? "var(--accent-gold)" : "transparent", color: selected ? "var(--charcoal-900)" : "var(--text-secondary)", cursor: onClick ? "pointer" : "default", transition: "all var(--dur-fast) var(--ease-standard)" } },
    children,
    onRemove && React.createElement("span", { onClick: (e) => { e.stopPropagation(); onRemove(); }, style: { cursor: "pointer", opacity: 0.6 } }, "×")
  );
}
