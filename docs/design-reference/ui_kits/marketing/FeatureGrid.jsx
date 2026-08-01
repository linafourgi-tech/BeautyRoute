const items = [
  { title: "Real portfolios only", body: "Every image is uploaded by the professional who made it — no stock, no AI, no Pinterest." },
  { title: "Inspiration, matched", body: "Clients discover a style first, then get matched to artists with real work in that exact look." },
  { title: "AI consultation", body: "A quick conversation turns a client's face shape and hair texture into a shortlist of styles." },
];
function FeatureGrid() {
  return React.createElement("section", { style: { padding: "60px var(--gutter-desktop) 100px", maxWidth: "var(--container-xl)", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 } },
    items.map((it, i) => React.createElement("div", { key: i, style: { padding: "var(--space-8)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" } },
      React.createElement("h3", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 10px" } }, it.title),
      React.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary)", lineHeight: "var(--lh-body)", margin: 0 } }, it.body)
    ))
  );
}
window.FeatureGrid = FeatureGrid;
