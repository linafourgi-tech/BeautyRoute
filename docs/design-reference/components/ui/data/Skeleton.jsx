import React from "react";
export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)" }) {
  return React.createElement("div", { style: { width, height, borderRadius: radius, background: "linear-gradient(90deg, var(--bg-sunken) 25%, var(--ivory-300) 37%, var(--bg-sunken) 63%)", backgroundSize: "400% 100%", animation: "br-shimmer 1.6s ease-in-out infinite" } },
    React.createElement("style", null, "@keyframes br-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}")
  );
}
