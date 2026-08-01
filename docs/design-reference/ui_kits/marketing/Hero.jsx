function Hero({ audience, onSwitch }) {
  const copy = audience === "pro" ? {
    title: "Your business, presented like an editorial.",
    body: "Showcase real work, manage bookings, and let AI handle the busywork — so you can focus on the craft.",
    cta: "Start your portfolio"
  } : {
    title: "Discover your next look, then meet the artist behind it.",
    body: "Browse real inspiration, get matched with professionals who've actually done the style, and book in a tap.",
    cta: "Explore styles"
  };
  return React.createElement("section", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", padding: "80px var(--gutter-desktop) 60px", maxWidth: "var(--container-xl)", margin: "0 auto" } },
    React.createElement("div", null,
      React.createElement("div", { style: { display: "inline-flex", gap: 4, marginBottom: 24, padding: 4, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)" } },
        ["client", "pro"].map(a => React.createElement("button", { key: a, onClick: () => onSwitch(a), style: { border: "none", background: audience === a ? "var(--charcoal-900)" : "transparent", color: audience === a ? "var(--ivory-100)" : "var(--text-secondary)", borderRadius: "var(--radius-pill)", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" } }, a === "pro" ? "Professionals" : "Clients"))
      ),
      React.createElement("h1", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-display-lg)", lineHeight: "var(--lh-display)", letterSpacing: "var(--ls-display)", color: "var(--text-primary)", margin: "12px 0 20px" } }, copy.title),
      React.createElement("p", { style: { fontSize: "var(--text-body-lg)", color: "var(--text-secondary)", lineHeight: "var(--lh-body)", maxWidth: 460 } }, copy.body),
      React.createElement("div", { style: { marginTop: 32 } }, React.createElement(window.BeautyRouteDesignSystem_b9f150.Button, { variant: "gold", size: "lg" }, copy.cta))
    ),
    React.createElement("div", { style: { aspectRatio: "4 / 5", borderRadius: "var(--radius-xl)", background: "linear-gradient(135deg, var(--ivory-200), var(--sand-400))" } })
  );
}
window.Hero = Hero;
