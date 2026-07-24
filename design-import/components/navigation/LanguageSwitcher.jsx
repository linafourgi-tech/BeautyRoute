import React from "react";
export function LanguageSwitcher({ lang = "en", onChange, variant = "segmented" }) {
  const opts = [{ v: "ar", label: "العربية", flag: "🇸🇦" }, { v: "en", label: "English", flag: "🇬🇧" }];
  if (variant === "compact") {
    const other = lang === "en" ? "ar" : "en";
    const o = opts.find(x => x.v === other);
    return React.createElement("button", { onClick: () => onChange && onChange(other), style: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border-default)", background: "transparent", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-body)" } }, o.flag, o.label);
  }
  return React.createElement("div", { style: { display: "inline-flex", gap: 3, padding: 3, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", fontFamily: "var(--font-body)" } },
    opts.map(o => React.createElement("button", { key: o.v, onClick: () => onChange && onChange(o.v), style: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 14px", fontSize: 13, fontWeight: 500, background: lang === o.v ? "var(--charcoal-900)" : "transparent", color: lang === o.v ? "var(--ivory-100)" : "var(--text-secondary)" } }, o.flag, o.label))
  );
}
