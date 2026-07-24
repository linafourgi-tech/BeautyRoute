import React from "react";
export function IconButton({ icon, label, size = 40, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return React.createElement("button", {
    "aria-label": label, title: label, onClick,
    onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
    style: { width: size, height: size, borderRadius: "var(--radius-md)", border: "1px solid " + (active ? "var(--border-strong)" : "transparent"), background: active ? "var(--bg-sunken)" : hover ? "var(--bg-sunken)" : "transparent", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all var(--dur-fast) var(--ease-standard)" }
  }, icon);
}
