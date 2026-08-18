import React from "react";
// Design migration (full-product-design-migration): the shimmer's midpoint
// used to hardcode --ivory-300, a light-palette color regardless of theme --
// harmless while every consumer was light-only, but once pages render in
// [data-theme="dark"] it flashed a light-ivory streak across a dark
// surface. --border-strong is already theme-aware (a translucent
// text-on-background overlay in both palettes -- see tokens/colors.css) and
// reads as a subtle highlight sweep in both themes instead.
export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)" }) {
  return React.createElement("div", { style: { width, height, borderRadius: radius, background: "linear-gradient(90deg, var(--bg-sunken) 25%, var(--border-strong) 37%, var(--bg-sunken) 63%)", backgroundSize: "400% 100%", animation: "br-shimmer 1.6s ease-in-out infinite" } },
    React.createElement("style", null, "@keyframes br-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}")
  );
}
