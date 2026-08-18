import "../../styles/beautyroute/styles.css";

// Shared neutral loading screen for route guards -- rendered while auth/
// profile/subscription state is still resolving, specifically so guards
// never have to guess (and risk a redirect loop) before they actually know
// the answer. Also reused as App.jsx's single Suspense fallback for every
// lazy-loaded route's own code-split chunk.
//
// Loading/empty-state audit (design-refinement pass): this used to render
// the plain LIGHT beautyroute-ds default (no data-theme). Because it's the
// one Suspense fallback for every route, that meant a visible light flash
// on every single navigation inside the dark authenticated app -- by far
// the most common case (a signed-in professional clicking between
// Dashboard/Appointments/Clients/etc. all day), versus the rare case of
// navigating toward a light public page (Login/Signup), which happens once
// per session at most. There is no per-route theme signal available to a
// single global Suspense boundary without a bigger routing restructure
// (out of scope here -- this stays presentation-only), so this deliberately
// biases dark: far fewer, far less disruptive flashes overall.
export function RouteLoading() {
  return (
    <div
      className="beautyroute-ds"
      data-theme="dark"
      role="status"
      aria-label="Loading"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          height: 8,
          width: 8,
          borderRadius: "50%",
          background: "var(--accent-gold)",
          animation: "br-route-loading-pulse 1.1s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes br-route-loading-pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
