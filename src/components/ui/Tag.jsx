import React from "react";

// Accessibility fix (Phase 7): when Tag is interactive (an onClick is
// passed, as ServicesStep.jsx does for template selection) it now renders as
// a real <button aria-pressed> instead of a <span onClick> -- keyboard
// focusable, activatable with Space/Enter, and announced as a toggle button
// with its pressed state. When there's no onClick it stays a plain <span>
// (display-only tag, nothing to interact with). The remove "x" is now its
// own real <button aria-label="Remove"> instead of an unlabelled clickable
// span. Visual appearance is unchanged either way.
export function Tag({ children, onRemove, selected, onClick }) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: "var(--radius-pill)",
    fontSize: 13,
    fontFamily: "var(--font-body)",
    border: "1px solid " + (selected ? "var(--accent-gold-strong)" : "var(--border-default)"),
    background: selected ? "var(--accent-gold)" : "transparent",
    color: selected ? "var(--charcoal-900)" : "var(--text-secondary)",
    transition: "all var(--dur-fast) var(--ease-standard)",
  };

  const removeButton =
    onRemove &&
    React.createElement(
      "button",
      {
        type: "button",
        "aria-label": "Remove",
        onClick: (e) => {
          e.stopPropagation();
          onRemove();
        },
        style: { cursor: "pointer", opacity: 0.6, background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", lineHeight: 1 },
      },
      "×"
    );

  if (onClick) {
    return React.createElement(
      "button",
      { type: "button", onClick, "aria-pressed": !!selected, style: { ...baseStyle, cursor: "pointer" } },
      children,
      removeButton
    );
  }

  return React.createElement("span", { style: baseStyle }, children, removeButton);
}
