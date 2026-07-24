import React from "react";
export function BookingCard({ client, service, time, status = "confirmed" }) {
  const tones = { confirmed: { c: "var(--success-fg)", b: "var(--success-bg)" }, pending: { c: "var(--warning-fg)", b: "var(--warning-bg)" }, cancelled: { c: "var(--error-fg)", b: "var(--error-bg)" } };
  const t = tones[status];
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16, padding: "var(--space-4) var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, var(--ivory-200), var(--sand-400))", flexShrink: 0 } }),
    React.createElement("div", { style: { flex: 1 } },
      React.createElement("div", { style: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)" } }, client),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, service, " · ", time)
    ),
    React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: t.c, background: t.b, padding: "4px 10px", borderRadius: "var(--radius-pill)", textTransform: "capitalize" } }, status)
  );
}
