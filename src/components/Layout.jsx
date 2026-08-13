import Sidebar from "./Sidebar";
import { TrialBanner } from "./subscription/TrialBanner";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 1, design-system-dashboard-shell): the shared
// authenticated-app shell, reskinned onto beautyroute-ds -- same warm
// ivory/espresso/gold tokens and Fraunces/Inter type as Login/Signup.
// TrialBanner is unchanged (it already rendered itself in beautyroute-ds --
// see its own file); no routing, auth, or business logic lives here or is
// touched by this change.
export default function Layout({ title, titleAr, subtitle, children }) {
  return (
    <div className="beautyroute-ds" style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <TrialBanner />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-6 md:px-14 py-10 md:py-16">
            {(title || subtitle) && (
              <header style={{ marginBottom: "var(--space-10)" }}>
                {title && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <h1
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-display-md)",
                        letterSpacing: "var(--ls-display)",
                        lineHeight: "var(--lh-heading)",
                        color: "var(--text-primary)",
                        margin: 0,
                      }}
                    >
                      {title}
                    </h1>
                    {titleAr && (
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-tertiary)" }}>
                        {titleAr}
                      </span>
                    )}
                  </div>
                )}
                {subtitle && (
                  <p style={{ color: "var(--text-tertiary)", marginTop: 12, maxWidth: 560, fontSize: "var(--text-body)", lineHeight: "var(--lh-body)" }}>
                    {subtitle}
                  </p>
                )}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
