import React from "react";
export function Pagination({ page = 1, total = 1, onChange }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return React.createElement("div", { style: { display: "flex", gap: 6, fontFamily: "var(--font-body)" } },
    pages.map((p) => React.createElement("button", { key: p, onClick: () => onChange && onChange(p), style: { width: 32, height: 32, borderRadius: "50%", border: "none", background: p === page ? "var(--charcoal-900)" : "transparent", color: p === page ? "var(--ivory-100)" : "var(--text-tertiary)", cursor: "pointer", fontSize: 13, transition: "all var(--dur-fast) var(--ease-standard)" } }, p))
  );
}
