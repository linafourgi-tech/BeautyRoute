import "../../styles/beautyroute/styles.css";

// Shared neutral loading screen for route guards -- rendered while auth/
// profile/subscription state is still resolving, specifically so guards never
// have to guess (and risk a redirect loop) before they actually know the
// answer.
export function RouteLoading() {
  return (
    <div
      className="beautyroute-ds"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-body)",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}
