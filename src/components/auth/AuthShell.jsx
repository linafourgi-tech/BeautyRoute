import React from "react";

// Ported from design-import/ui_kits/auth/AuthShell.jsx.
// Changes from the source: `window.AuthShell = AuthShell` removed (real ES
// export instead), `className: "beautyroute-ds"` added to the root so the
// scoped tokens from src/styles/beautyroute actually apply to this subtree,
// and a mobile breakpoint added below -- the original was a fixed 1fr 1fr
// split with no responsive collapse, which renders unusably cramped on a
// phone. Content/behavior is otherwise unchanged.
const MOBILE_QUERY = "(max-width: 640px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AuthShell({ children }) {
  const isMobile = useIsMobile();

  return React.createElement(
    "div",
    {
      className: "beautyroute-ds",
      style: {
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        minHeight: "100vh",
        fontFamily: "var(--font-body)",
        background: "var(--bg-page)",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          background: "linear-gradient(160deg, var(--espresso-800), var(--charcoal-900))",
          display: "flex",
          alignItems: isMobile ? "center" : "flex-end",
          justifyContent: isMobile ? "center" : "flex-start",
          textAlign: isMobile ? "center" : "left",
          padding: isMobile ? "var(--space-8) var(--space-6)" : "var(--space-16)",
        },
      },
      React.createElement(
        "div",
        { style: { color: "var(--ivory-100)" } },
        React.createElement(
          "div",
          { style: { fontFamily: "var(--font-display)", fontSize: 22, marginBottom: isMobile ? 8 : 16 } },
          "Beauty",
          React.createElement("span", { style: { color: "var(--accent-gold)" } }, "Route")
        ),
        !isMobile &&
          React.createElement(
            "p",
            { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", lineHeight: "var(--lh-heading)", maxWidth: 380, margin: 0 } },
            "Beauty, ",
            React.createElement("span", { style: { color: "var(--accent-gold)" } }, "routed.")
          )
      )
    ),
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "var(--space-8) var(--space-6)" : "var(--space-16)" } },
      React.createElement("div", { style: { width: isMobile ? "100%" : 380, maxWidth: 380 } }, children)
    )
  );
}
