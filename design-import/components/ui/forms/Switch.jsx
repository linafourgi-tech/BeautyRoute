import React from "react";
export function Switch({ checked, onChange, label }) {
  return React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement("span", { onClick: () => onChange && onChange(!checked), style: { width: 40, height: 24, borderRadius: "var(--radius-pill)", background: checked ? "var(--accent-gold)" : "var(--border-strong)", position: "relative", transition: "background var(--dur-base) var(--ease-standard)" } },
      React.createElement("span", { style: { position: "absolute", top: 3, left: checked ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: "var(--white)", boxShadow: "var(--shadow-xs)", transition: "left var(--dur-base) var(--ease-editorial)" } })
    ),
    label
  );
}
