import React from "react";
export function ServiceAreaSelector({ value = 20, onChange, fee }) {
  const opts = [10, 20, 30, "Custom"];
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      opts.map(o => React.createElement("button", { key: o, onClick: () => onChange && onChange(o), style: { padding: "8px 16px", borderRadius: "var(--radius-pill)", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid " + (value === o ? "var(--accent-gold-strong)" : "var(--border-default)"), background: value === o ? "var(--accent-gold)" : "transparent", color: value === o ? "var(--charcoal-900)" : "var(--text-secondary)" } }, typeof o === "number" ? o + " km" : o))),
    React.createElement("p", { style: { fontSize: 12, color: "var(--text-tertiary)", margin: "10px 0 0" } }, "Clients outside your service area can't request a mobile appointment.", fee && " Travel fee: " + fee)
  );
}
