function AuthShell({ children }) {
  return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh", fontFamily: "var(--font-body)", background: "var(--bg-page)" } },
    React.createElement("div", { style: { background: "linear-gradient(160deg, var(--espresso-800), var(--charcoal-900))", display: "flex", alignItems: "flex-end", padding: "var(--space-16)" } },
      React.createElement("div", { style: { color: "var(--ivory-100)" } },
        React.createElement("div", { style: { fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 16 } }, "Beauty", React.createElement("span", { style: { color: "var(--accent-gold)" } }, "Route")),
        React.createElement("p", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", lineHeight: "var(--lh-heading)", maxWidth: 380, margin: 0 } }, "Beauty, ", React.createElement("span", { style: { color: "var(--accent-gold)" } }, "routed."))
      )
    ),
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-16)" } },
      React.createElement("div", { style: { width: 380 } }, children)
    )
  );
}
window.AuthShell = AuthShell;
