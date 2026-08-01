import React from "react";
export function Select({ label, hint, value, onChange, options = [], placeholder }) {
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-body)" } },
    label && React.createElement("label", { style: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" } }, label),
    React.createElement("select", { value, onChange, style: { height: 46, borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--surface-card)", padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)", outline: "none" } },
      placeholder && React.createElement("option", { value: "" }, placeholder),
      options.map((o, i) => React.createElement("option", { key: i, value: o.value ?? o }, o.label ?? o))
    ),
    hint && React.createElement("span", { style: { fontSize: 12, color: "var(--text-tertiary)" } }, hint)
  );
}
