import React from "react";
export function Table({ columns = [], rows = [] }) {
  return React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: 14 } },
    React.createElement("thead", null, React.createElement("tr", null, columns.map((c, i) => React.createElement("th", { key: i, style: { textAlign: "start", padding: "10px 14px", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", borderBottom: "1px solid var(--border-subtle)" } }, c)))),
    React.createElement("tbody", null, rows.map((r, i) => React.createElement("tr", { key: i, style: { borderBottom: "1px solid var(--border-subtle)" } }, r.map((cell, j) => React.createElement("td", { key: j, style: { padding: "14px", color: "var(--text-primary)" } }, cell)))))
  );
}
