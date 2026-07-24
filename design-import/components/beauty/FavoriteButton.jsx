import React from "react";
export function FavoriteButton({ saved, onToggle, variant = "icon", label = "Favorite" }) {
  const heart = React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: saved ? "var(--accent-gold)" : "none", stroke: saved ? "var(--accent-gold-strong)" : "currentColor", strokeWidth: 1.8 }, React.createElement("path", { d: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" }));
  if (variant === "pill") {
    return React.createElement("button", { onClick: onToggle, style: { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: "1px solid " + (saved ? "var(--accent-gold-strong)" : "var(--border-default)"), background: saved ? "var(--accent-gold)" : "transparent", color: saved ? "var(--charcoal-900)" : "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" } }, heart, saved ? "Saved" : label);
  }
  return React.createElement("button", { "aria-label": saved ? "Remove from favorites" : "Save to favorites", onClick: onToggle, style: { width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface-card)", boxShadow: "var(--shadow-sm)", color: "var(--text-secondary)" } }, heart);
}
