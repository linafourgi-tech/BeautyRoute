import React from "react";
// rows: [{ label, value }] e.g. formula, developer, timing
export function FormulaCard({ title = "Formula", rows = [], date, professional }) {
  return React.createElement("div", { style: { padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 } },
      React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h4)", color: "var(--text-primary)" } }, title),
      date && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)" } }, date)),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      rows.map((r, i) => React.createElement("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: i ? "1px solid var(--border-subtle)" : "none", paddingTop: i ? 8 : 0 } },
        React.createElement("span", { style: { color: "var(--text-tertiary)" } }, r.label),
        React.createElement("span", { style: { color: "var(--text-primary)", fontWeight: 500, fontVariantNumeric: "tabular-nums" } }, r.value)))),
    professional && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 } }, "Applied by ", professional)
  );
}
