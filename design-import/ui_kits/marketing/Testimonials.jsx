function Testimonials() {
  const quotes = [
    { text: "BeautyRoute made my portfolio feel like a magazine spread, not a folder of photos.", author: "Lujain, Freelance Colorist — Riyadh" },
    { text: "Clients arrive already knowing exactly what they want. Fewer surprises, better results.", author: "Salon Aura — Jeddah" },
  ];
  return React.createElement("section", { style: { padding: "0 var(--gutter-desktop) 100px", maxWidth: "var(--container-xl)", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 } },
    quotes.map((q, i) => React.createElement("figure", { key: i, style: { margin: 0, padding: "var(--space-8)", background: "var(--surface-card-alt)", borderRadius: "var(--radius-lg)" } },
      React.createElement("blockquote", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", fontStyle: "italic", color: "var(--text-primary)", margin: 0, lineHeight: "var(--lh-heading)" } }, "\u201C", q.text, "\u201D"),
      React.createElement("figcaption", { style: { marginTop: 16, fontSize: 13, color: "var(--text-tertiary)" } }, q.author)
    ))
  );
}
window.Testimonials = Testimonials;
