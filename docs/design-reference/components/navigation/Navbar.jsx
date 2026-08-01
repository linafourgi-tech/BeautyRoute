import React from "react";
export function Navbar({ links = [], active, onNavigate, right, wordmark = "BeautyRoute" }) {
  return React.createElement("nav", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px var(--gutter-desktop)", background: "rgba(250,247,242,0.8)", backdropFilter: "blur(var(--blur-glass))", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)", position: "sticky", top: 0, zIndex: 20 } },
    React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)" } }, wordmark.replace("Route", ""), React.createElement("span", { style: { color: "var(--accent-gold-strong)" } }, "Route")),
    React.createElement("div", { style: { display: "flex", gap: 32 } }, links.map((l, i) => React.createElement("a", { key: i, onClick: () => onNavigate && onNavigate(l), style: { fontSize: 14, fontWeight: 500, color: active === l ? "var(--text-primary)" : "var(--text-tertiary)", cursor: "pointer" } }, l))),
    React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "center" } }, right)
  );
}
