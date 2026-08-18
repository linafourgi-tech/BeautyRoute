import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarClock,
  BookHeart,
  Map,
  LineChart,
  Sparkles,
  Store,
  Scissors,
  Tag,
  Users,
  ListChecks,
  Menu,
  X,
  LogOut,
  Languages,
} from "lucide-react";
import { useSession } from "../hooks/useSession";
import { useWorkspaceContext } from "../contexts/useWorkspaceContext";
import { signOutUser } from "../services/auth";
import { updateWorkspace } from "../services/workspaces";
import { resolveWorkspaceLang } from "../lib/locale";
import { t, dirFor } from "../lib/i18n";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 2, design-system-dashboard-shell): reworked onto
// the approved design reference's "Professional Dashboard" pattern (dark,
// compact, OLED-friendly surface hierarchy -- the same token system as
// Phase 1, just opted into its already-authored [data-theme="dark"]
// variant via Layout.jsx, not a new palette). Every route and bilingual
// string is unchanged from Phase 1; only density/proportions changed to
// match the reference's 240px-rail, single-tight-row nav items.
// Two additions explicitly authorized for this pass: a mobile slide-over
// drawer (the reference's own mobile.html uses a bottom tab bar, adapted
// here to a full drawer instead -- see the final report for why) and a
// Log out action wired directly to the existing signOutUser() service.
//
// Label renamed "AI Studio" -> "AI Assistant" (design-refinement pass):
// "AI Assistant" is the term used everywhere else in the product --
// AIEngine.jsx's own page title, the ai-assistant Edge Function, the
// roadmap, test strategy, and security review docs. "AI Studio" only ever
// existed here; this aligns the nav with the name already established
// across the rest of the codebase, not a new name invented for this pass.
const nav = [
  // Was "/" (the Platform Service Hub / ServiceSelection page) -- that
  // page has nothing to do with the dashboard, so "Dashboard" never
  // actually opened the dashboard. Fixed to point at the real /dashboard
  // route as part of Phase 9's navigation cleanup.
  { to: "/dashboard", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
  { to: "/appointments", label: "Appointments", labelAr: "المواعيد", icon: CalendarClock },
  { to: "/clients", label: "Clients", labelAr: "العملاء", icon: Users },
  { to: "/services", label: "Services", labelAr: "الخدمات", icon: ListChecks },
  { to: "/passport", label: "Beauty Passport", labelAr: "جواز الجمال", icon: BookHeart, starred: true },
  { to: "/route", label: "Route", labelAr: "المسار", icon: Map },
  { to: "/business", label: "Business", labelAr: "الأعمال", icon: LineChart },
  { to: "/ai", label: "AI Assistant", labelAr: "المساعد الذكي", icon: Sparkles },
  { to: "/salon", label: "Salon", labelAr: "الصالون", icon: Store },
  { to: "/pricing", label: "Pricing", labelAr: "الأسعار", icon: Tag },
];

// Which language a nav item's label displays -- see lib/locale.js. Until
// now nothing ever read workspaces.locale, so Sidebar showed both the
// English and Arabic label on every item unconditionally. That's the bug
// being fixed here -- not by inventing a new language system, but by
// finally consuming the column that already exists. Both label strings
// stay in the `nav` array (nothing is deleted).

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ height: 36, width: 36, borderRadius: "var(--radius-md)", background: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Scissors size={16} color="var(--charcoal-900)" />
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1, letterSpacing: "var(--ls-display)", color: "var(--text-primary)", margin: 0 }}>
        Beauty<span style={{ color: "var(--accent-gold-strong)" }}>Route</span>
      </p>
    </div>
  );
}

function WorkspaceSwitcher({ lang }) {
  const { workspaces, workspace, workspaceId, selectWorkspace, loading, error } = useWorkspaceContext();

  if (loading) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px", fontSize: "var(--text-caption)", color: "var(--text-tertiary)" }}>
        {t("sidebar.workspaceLoading", lang)}
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--error-fg)", padding: "9px 12px", fontSize: "var(--text-caption)", color: "var(--error-fg)" }}>
        {t("sidebar.workspaceError", lang)}
      </div>
    );
  }
  if (workspaces.length === 0) return null;
  if (workspaces.length === 1) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px" }}>
        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 1px" }}>{t("sidebar.workspace", lang)}</p>
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name}</p>
      </div>
    );
  }
  return (
    <label style={{ display: "block", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px", cursor: "pointer" }}>
      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", display: "block", marginBottom: 1 }}>
        {t("sidebar.workspace", lang)}
      </span>
      <select
        value={workspaceId ?? ""}
        onChange={(e) => selectWorkspace(e.target.value)}
        aria-label={t("sidebar.switchWorkspace", lang)}
        style={{ width: "100%", background: "transparent", fontSize: "var(--text-caption)", color: "var(--text-primary)", border: "none", outline: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    </label>
  );
}

// The actual control for the locale column NavList reads (see
// resolveWorkspaceLang in lib/locale.js). Without this, workspace.locale
// could only ever be set directly in the database -- the bilingual-nav fix
// would have been half-done, correct in display logic but with no real way
// for anyone to ever change it. updateWorkspace() already allowlists
// 'locale' (see services/workspaces.ts); this is the first UI caller of
// that existing path, not a new mutation capability.
// Current-language display fixed (design-refinement pass, follow-up): this
// used to always show the OTHER language's name ("click to switch"), which
// read as ambiguous -- nothing on the control itself said which language was
// currently active. It now shows the CURRENT language with a small "current"
// indicator, and the action text makes the switch explicit.
function LanguageToggle({ lang }) {
  const { workspaceId, refresh } = useWorkspaceContext();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  if (!workspaceId) return null;
  const other = lang === "ar" ? "en" : "ar";
  const currentLabel = lang === "ar" ? "العربية" : "English";
  const otherLabel = other === "ar" ? "العربية" : "English";

  async function handleSwitch() {
    setSwitching(true);
    setSwitchError("");
    try {
      await updateWorkspace(workspaceId, { locale: other });
      await refresh();
    } catch (err) {
      setSwitchError(err.message || t("action.switchLanguageError", lang));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSwitch}
        disabled={switching}
        aria-label={`${currentLabel} — ${t("sidebar.switchTo", lang)} ${otherLabel}`}
        title={`${t("sidebar.switchTo", lang)} ${otherLabel}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          background: "transparent",
          padding: "9px 12px",
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          cursor: switching ? "not-allowed" : "pointer",
          opacity: switching ? 0.6 : 1,
          fontFamily: "var(--font-body)",
        }}
      >
        <Languages size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "start", fontWeight: 600, color: "var(--text-primary)" }}>{switching ? t("sidebar.switching", lang) : currentLabel}</span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{otherLabel}</span>
      </button>
      {switchError && <p role="alert" style={{ margin: "4px 0 0", fontSize: 11, color: "var(--error-fg)" }}>{switchError}</p>}
    </div>
  );
}

function AccountFooter({ lang }) {
  const navigate = useNavigate();
  const { profile } = useSession();
  const { workspace } = useWorkspaceContext();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const displayName = profile?.full_name?.trim() || t("sidebar.yourAccount", lang);
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  async function handleLogout() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      setSigningOut(false);
      setSignOutError(err.message || t("sidebar.signOutError", lang));
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ height: 34, width: 34, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", color: "var(--accent-gold-strong)", fontSize: 12, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name || t("sidebar.noWorkspace", lang)}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          aria-label={t("sidebar.logOut", lang)}
          title={t("sidebar.logOut", lang)}
          style={{ background: "none", border: "none", padding: 6, cursor: signingOut ? "not-allowed" : "pointer", color: "var(--text-tertiary)", opacity: signingOut ? 0.5 : 1, display: "flex", flexShrink: 0 }}
        >
          <LogOut size={16} />
        </button>
      </div>
      {signOutError && <p role="alert" style={{ fontSize: 11, color: "var(--error-fg)", margin: 0 }}>{signOutError}</p>}
    </div>
  );
}

function NavList({ onNavigate, lang }) {
  return (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
      {nav.map(({ to, label, labelAr, icon: Icon, starred }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: 11,
            borderRadius: "var(--radius-md)",
            padding: "9px 12px",
            textDecoration: "none",
            transition: `background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)`,
            background: isActive ? "var(--bg-sunken)" : "transparent",
            color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={17} strokeWidth={1.6} color={isActive ? "var(--accent-gold-strong)" : "currentColor"} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: isActive ? 600 : 500, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lang === "ar" ? labelAr : label}
              </span>
              {starred && <span style={{ fontSize: 11, color: "var(--accent-gold-strong)", flexShrink: 0 }}>★</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarPanel({ onNavigate, lang }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "var(--space-6) var(--space-4)", gap: "var(--space-5)" }}>
      <div style={{ padding: "0 var(--space-2)" }}>
        <Wordmark />
      </div>
      <WorkspaceSwitcher lang={lang} />
      <LanguageToggle lang={lang} />
      <NavList onNavigate={onNavigate} lang={lang} />
      <AccountFooter lang={lang} />
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { workspace } = useWorkspaceContext();
  const lang = resolveWorkspaceLang(workspace);
  const dir = dirFor(lang);

  // No .beautyroute-ds class on any wrapper here: Sidebar is only ever
  // rendered inside Layout, which already establishes
  // .beautyroute-ds[data-theme="dark"] on its own root. Re-declaring the
  // class on a nested element would match the *light* .beautyroute-ds rule
  // (data-theme="dark" wouldn't be present on that inner element) and
  // silently override every inherited dark-mode token back to light --
  // custom properties cascade fine through a plain wrapper, so none is
  // needed here.
  //
  // `dir` fixed (design-refinement pass, localization follow-up): the nav
  // list used to be the ONLY part of Sidebar with an explicit dir -- the
  // wordmark, workspace switcher, and account footer all silently stayed
  // LTR-arranged in Arabic mode because nothing above them (Layout's root
  // included, before this same pass) ever set dir. That inconsistency --
  // nav items flipping while everything else around them didn't -- is
  // exactly what read as "icons and labels move inconsistently." dir is
  // now set explicitly on every one of Sidebar's own top-level roots (not
  // just relied on inheriting from Layout), so Sidebar renders correctly
  // even tested/used standalone, outside Layout.
  return (
    <>
      {/* Compact mobile top bar -- the reference's own mobile.html uses a
          bottom tab bar limited to 4 destinations; this app has 10 real
          routes, so a full slide-over drawer (same nav content as desktop,
          nothing cut) is the safer match for "preserve all routes." */}
      <div
        className="flex md:hidden"
        dir={dir}
        style={{ alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 30 }}
      >
        <Wordmark />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("sidebar.openNav", lang)}
          aria-expanded={mobileOpen}
          style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--text-primary)", display: "flex" }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop rail */}
      <aside
        className="hidden md:flex md:w-60 shrink-0 h-screen sticky top-0"
        dir={dir}
        style={{ background: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" }}
      >
        <SidebarPanel lang={lang} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden" dir={dir} role="dialog" aria-modal="true" aria-label={t("sidebar.navLabel", lang)} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "absolute", inset: 0, background: "var(--overlay-scrim)" }}
          />
          <div style={{ position: "relative", width: 260, maxWidth: "80vw", height: "100%", background: "var(--surface-card)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 10px 0" }}>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("sidebar.closeNav", lang)}
                style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <SidebarPanel onNavigate={() => setMobileOpen(false)} lang={lang} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
