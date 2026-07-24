import React from "react";
export function ReviewSummary({ rating = 4.9, total = 214, breakdown = [] }) {
  return React.createElement("div", { style: { display: "flex", gap: 28, alignItems: "center", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { textAlign: "center" } },
      React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: 44, color: "var(--text-primary)", lineHeight: 1 } }, rating),
      React.createElement("div", { style: { color: "var(--accent-gold-strong)", fontSize: 14, letterSpacing: 2, marginTop: 4 } }, "★★★★★"),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 } }, total, " reviews")),
    React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 6 } },
      breakdown.map((b, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-tertiary)" } },
        React.createElement("span", { style: { width: 8 } }, b.stars),
        React.createElement("span", { style: { flex: 1, height: 6, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", overflow: "hidden" } },
          React.createElement("span", { style: { display: "block", width: b.pct + "%", height: "100%", background: "var(--accent-gold)" } })),
        React.createElement("span", { style: { width: 32, textAlign: "end" } }, b.pct + "%"))))
  );
}
