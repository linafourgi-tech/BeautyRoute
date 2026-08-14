import Sidebar from "./Sidebar";
import { TrialBanner } from "./subscription/TrialBanner";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 2, design-system-dashboard-shell): reworked to
// match the Claude Design "Professional Dashboard" reference (project
// cd3127fb-33c9-4e08-a9c0-448004aebd5a) -- a dark, compact, OLED-friendly
// application shell. This is the SAME beautyroute-ds token system as
// Login/Signup (same colors.css, same Fraunces/Inter pair) -- just opted
// into its already-authored `[data-theme="dark"]` variant ("OLED-friendly
// near-black with warm undertone", per that project's own
// guidelines/colors-dark.html), which nothing before this PR ever used.
// No new colors were invented. Login/Signup keep their existing light
// theme, unchanged.
//
// `headerActions` (optional) renders inline next to the title/subtitle, in
// the same header row -- used by StylistDashboard for its client search so
// it sits in the header composition instead of as a separate block below
// it. Backward-compatible: every other Layout consumer (Appointments,
// BeautyPassport, RouteEngine, BusinessEngine, AIEngine, SalonEngine, all
// out of scope for this PR) simply doesn't pass it and is unaffected.
export default function Layout({ title, titleAr, subtitle, headerActions, children }) {
  return (
    <div className="beautyroute-ds" data-theme="dark" style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <TrialBanner />
      <div className="flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-5 md:px-10 py-6 md:py-10">
            {(title || subtitle || headerActions) && (
              <header style={{ marginBottom: "var(--space-8)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  {title && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <h1
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "var(--text-h1)",
                          letterSpacing: "var(--ls-display)",
                          lineHeight: "var(--lh-heading)",
                          color: "var(--text-primary)",
                          margin: 0,
                        }}
                      >
                        {title}
                      </h1>
                      {titleAr && (
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body)", color: "var(--text-tertiary)" }}>
                          {titleAr}
                        </span>
                      )}
                    </div>
                  )}
                  {subtitle && (
                    <p style={{ color: "var(--text-tertiary)", marginTop: 6, maxWidth: 480, fontSize: "var(--text-body-sm)", lineHeight: "var(--lh-body)" }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                {headerActions && <div style={{ flexShrink: 0 }}>{headerActions}</div>}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
