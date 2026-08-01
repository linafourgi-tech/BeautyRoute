import React from "react";
export function ExperienceSwitcher({ value = "women", onChange, variant = "segmented", lang = "en" }) {
  const ar = lang === "ar";
  const opts = [
    { v: "women", label: ar ? "جمال المرأة" : "Women's Beauty", sub: ar ? "شعر، مكياج، أظافر، بشرة، رموش، عرائس" : "Hair, makeup, nails, skin, lashes, bridal" },
    { v: "men", label: ar ? "العناية بالرجل" : "Men's Grooming", sub: ar ? "قصّات، لحية، صبغات، فروة الرأس، عناية بالبشرة" : "Cuts, beard, coloring, scalp, facials" },
  ];
  if (variant === "cards") {
    return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontFamily: "var(--font-body)" } },
      opts.map(o => React.createElement("button", { key: o.v, onClick: () => onChange && onChange(o.v), style: { textAlign: "start", cursor: "pointer", padding: 0, border: "2px solid " + (value === o.v ? "var(--accent-gold-strong)" : "var(--border-subtle)"), borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" } },
        React.createElement("div", { style: { aspectRatio: "3 / 2", background: o.v === "women" ? "linear-gradient(135deg,#F3E7E0,#C99C93)" : "linear-gradient(135deg,#DBDDE0,#6B5642)" } }),
        React.createElement("div", { style: { padding: "14px 16px" } },
          React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h4)", color: "var(--text-primary)" } }, o.label),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 } }, o.sub)
        )
      ))
    );
  }
  return React.createElement("div", { style: { display: "inline-flex", gap: 3, padding: 3, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", fontFamily: "var(--font-body)" } },
    opts.map(o => React.createElement("button", { key: o.v, onClick: () => onChange && onChange(o.v), style: { border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", background: value === o.v ? "var(--charcoal-900)" : "transparent", color: value === o.v ? "var(--ivory-100)" : "var(--text-secondary)" } }, o.label))
  );
}
