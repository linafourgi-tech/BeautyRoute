import React from "react";
export function ClientNotes({ notes = [], placeholder = "Private note — visible only to you and your team", onAdd }) {
  const [val, setVal] = React.useState("");
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 } },
      notes.map((n, i) => React.createElement("div", { key: i, style: { padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--warning-bg)", borderInlineStart: "3px solid var(--accent-gold)" } },
        React.createElement("div", { style: { fontSize: 13, color: "var(--text-primary)", lineHeight: "var(--lh-body)" } }, n.text),
        React.createElement("div", { style: { fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 } }, n.author, " · ", n.date)))),
    React.createElement("div", { style: { display: "flex", gap: 8 } },
      React.createElement("input", { value: val, onChange: e => setVal(e.target.value), placeholder, style: { flex: 1, height: 42, border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0 14px", fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-primary)", background: "var(--surface-card)", outline: "none" } }),
      React.createElement("button", { onClick: () => { onAdd && onAdd(val); setVal(""); }, style: { border: "none", background: "var(--charcoal-900)", color: "var(--ivory-100)", borderRadius: "var(--radius-md)", padding: "0 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" } }, "Add"))
  );
}
