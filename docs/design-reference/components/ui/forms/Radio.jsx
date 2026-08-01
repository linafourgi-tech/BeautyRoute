import React from "react";
export function Radio({ label, checked, onChange }) {
  return React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)" } },
    React.createElement("span", { onClick: () => onChange && onChange(), style: { width: 18, height: 18, borderRadius: "50%", border: "1.5px solid " + (checked ? "var(--accent-gold-strong)" : "var(--border-strong)"), display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all var(--dur-fast) var(--ease-standard)" } },
      checked && React.createElement("span", { style: { width: 9, height: 9, borderRadius: "50%", background: "var(--accent-gold)" } })
    ),
    label
  );
}
