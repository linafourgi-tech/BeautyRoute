import React from "react";
import { MEDIA, TONES } from "../../assets/media.js";
export function EditorialImage({ name, src, tone, label, ratio = "4 / 5", radius = "var(--radius-lg)", overlay }) {
  const entry = (name && MEDIA[name]) || {};
  const url = src ?? entry.src ?? null;
  const t = tone ?? entry.tone ?? "ivory";
  const cap = label ?? entry.label ?? "";
  const [a, b] = TONES[t] || TONES.ivory;
  const dark = t === "espresso" || t === "slate";
  return React.createElement("div", { style: { position: "relative", width: "100%", aspectRatio: ratio, borderRadius: radius, overflow: "hidden", background: url ? undefined : `linear-gradient(135deg, ${a}, ${b})`, fontFamily: "var(--font-body)" } },
    url && React.createElement("img", { src: url, alt: cap, style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }),
    !url && cap && React.createElement("span", { style: { position: "absolute", left: 12, bottom: 12, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: dark ? "rgba(250,247,242,0.7)" : "rgba(31,27,24,0.45)" } }, cap),
    overlay && React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, var(--overlay-scrim))" } }),
    overlay && React.createElement("div", { style: { position: "absolute", left: 16, right: 16, bottom: 16, color: "var(--ivory-100)" } }, overlay)
  );
}
