import React from "react";
function ImagePlaceholder({ ratio = "4 / 5" }) {
  return React.createElement("div", { style: { width: "100%", aspectRatio: ratio, borderRadius: "var(--radius-lg)", background: "linear-gradient(135deg, var(--ivory-200), var(--sand-400))" } });
}
export function GalleryCard({ title, tag, onSave, saved }) {
  const [hover, setHover] = React.useState(false);
  return React.createElement("div", { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), style: { position: "relative", cursor: "pointer", transition: "transform var(--dur-base) var(--ease-editorial)", transform: hover ? "translateY(-4px)" : "none", fontFamily: "var(--font-body)" } },
    React.createElement(ImagePlaceholder, null),
    tag && React.createElement("span", { style: { position: "absolute", top: 10, left: 10, background: "rgba(250,247,242,0.9)", padding: "4px 10px", borderRadius: "var(--radius-pill)", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" } }, tag),
    React.createElement("span", { onClick: (e) => { e.stopPropagation(); onSave && onSave(); }, style: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(20,18,16,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: saved ? "var(--accent-gold)" : "var(--ivory-100)" } }, "♥"),
    title && React.createElement("div", { style: { marginTop: 8, fontSize: 13, color: "var(--text-secondary)" } }, title)
  );
}
