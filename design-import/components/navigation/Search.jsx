import React from "react";
export function Search({ placeholder = "Search styles, salons, services", value, onChange }) {
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", fontFamily: "var(--font-body)", width: "100%", maxWidth: 420 } },
    React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-tertiary)", strokeWidth: 2 }, React.createElement("circle", { cx: 11, cy: 11, r: 7 }), React.createElement("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })),
    React.createElement("input", { placeholder, value, onChange, style: { border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)" } })
  );
}
