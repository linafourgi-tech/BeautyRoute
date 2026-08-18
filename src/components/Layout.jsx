import { useEffect } from "react";
import Sidebar from "./Sidebar";
import { TrialBanner } from "./subscription/TrialBanner";
import { useAppLang } from "../hooks/useAppLang";
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
// it.
//
// Localization fix (design-refinement pass): `title`/`titleAr` used to be
// TWO separate props shown together unconditionally -- every page heading
// displayed both languages at once regardless of any language selection,
// same bug shape as Sidebar's old nav (fixed in the previous pass) but
// never carried through to Layout's own header. `titleAr` is removed:
// every Layout caller now passes a single, already-language-resolved
// `title`/`subtitle` (via lib/i18n.js's t()), and Layout itself resolves
// `lang`/`dir` once here and applies `dir` to its own root AND to
// `document.documentElement` -- the latter matters because native form
// controls, scrollbars, and anything NOT inside this root (there isn't
// anything, but the reference's own applyDir() pattern does this for a
// reason: dir is a document-level concern, not just a component-level one)
// respect the document's dir, not a nested div's.
export default function Layout({ title, subtitle, headerActions, children }) {
  const { lang, dir } = useAppLang();

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <div className="beautyroute-ds" data-theme="dark" dir={dir} style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <TrialBanner />
      <div className="flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-5 md:px-10 py-6 md:py-10">
            {(title || subtitle || headerActions) && (
              <header style={{ marginBottom: "var(--space-8)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  {title && (
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
