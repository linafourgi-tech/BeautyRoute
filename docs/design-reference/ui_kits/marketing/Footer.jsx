function Footer() {
  return React.createElement("footer", { style: { borderTop: "1px solid var(--border-subtle)", padding: "48px var(--gutter-desktop)", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "var(--container-xl)", margin: "0 auto", fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-primary)" } }, "Beauty", React.createElement("span", { style: { color: "var(--accent-gold-strong)" } }, "Route")),
    React.createElement("div", { style: { display: "flex", gap: 28, fontSize: 13, color: "var(--text-tertiary)" } }, ["Privacy", "Terms", "Contact"].map((l, i) => React.createElement("a", { key: i, href: "#" }, l)))
  );
}
window.Footer = Footer;
