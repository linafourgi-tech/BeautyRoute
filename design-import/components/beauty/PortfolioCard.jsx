import React from "react";
function ImagePlaceholder() {
  return React.createElement("div", { style: { width: "100%", aspectRatio: "1 / 1", borderRadius: "var(--radius-lg)", background: "linear-gradient(135deg, var(--ivory-200), var(--taupe-500))" } });
}
export function PortfolioCard({ title, meta }) {
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    React.createElement(ImagePlaceholder, null),
    React.createElement("div", { style: { marginTop: 10, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" } }, title),
    meta && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, meta)
  );
}
