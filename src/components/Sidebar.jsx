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
} from "lucide-react";
import { useSession } from "../hooks/useSession";
import { useWorkspaceContext } from "../contexts/useWorkspaceContext";
import { signOutUser } from "../services/auth";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 2, design-system-dashboard-shell): reworked onto
// the Claude Design "Professional Dashboard" reference (dark, compact,
// OLED-friendly surface hierarchy -- the same token system as Phase 1,
// just opted into its already-authored [data-theme="dark"] variant via
// Layout.jsx, not a new palette). Every route, label, bilingual string,
// and active-state rule is unchanged from Phase 1; only density/proportions
// changed to match the reference's 240px-rail, single-tight-row nav items.
// Two additions explicitly authorized for this pass: a mobile slide-over
// drawer (the reference's own mobile.html uses a bottom tab bar, adapted
// here to a full drawer instead -- see the final report for why) and a
// Log out action wired directly to the existing signOutUser() service.
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
  { to: "/ai", label: "AI Studio", labelAr: "الذكاء الاصطناعي", icon: Sparkles },
  { to: "/salon", label: "Salon", labelAr: "الصالون", icon: Store },
  { to: "/pricing", label: "Pricing", labelAr: "الأسعار", icon: Tag },
];

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

function WorkspaceSwitcher() {
  const { workspaces, workspace, workspaceId, selectWorkspace, loading, error } = useWorkspaceContext();

  if (loading) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px", fontSize: "var(--text-caption)", color: "var(--text-tertiary)" }}>
        Loading workspace…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--error-fg)", padding: "9px 12px", fontSize: "var(--text-caption)", color: "var(--error-fg)" }}>
        Couldn't load workspaces
      </div>
    );
  }
  if (workspaces.length === 0) return null;
  if (workspaces.length === 1) {
    return (
      <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px" }}>
        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 1px" }}>Workspace</p>
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name}</p>
      </div>
    );
  }
  return (
    <label style={{ display: "block", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: "9px 12px", cursor: "pointer" }}>
      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", display: "block", marginBottom: 1 }}>
        Workspace
      </span>
      <select
        value={workspaceId ?? ""}
        onChange={(e) => selectWorkspace(e.target.value)}
        aria-label="Switch workspace"
        style={{ width: "100%", background: "transparent", fontSize: "var(--text-caption)", color: "var(--text-primary)", border: "none", outline: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    </label>
  );
}

function AccountFooter() {
  const navigate = useNavigate();
  const { profile } = useSession();
  const { workspace } = useWorkspaceContext();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const displayName = profile?.full_name?.trim() || "Your account";
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  async function handleLogout() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      setSigningOut(false);
      setSignOutError(err.message || "Couldn't sign out. Please try again.");
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
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name || "No workspace yet"}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          aria-label="Log out"
          title="Log out"
          style={{ background: "none", border: "none", padding: 6, cursor: signingOut ? "not-allowed" : "pointer", color: "var(--text-tertiary)", opacity: signingOut ? 0.5 : 1, display: "flex", flexShrink: 0 }}
        >
          <LogOut size={16} />
        </button>
      </div>
      {signOutError && <p role="alert" style={{ fontSize: 11, color: "var(--error-fg)", margin: 0 }}>{signOutError}</p>}
    </div>
  );
}

function NavList({ onNavigate }) {
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
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                <span style={{ fontSize: 10, lineHeight: 1.2, color: "var(--text-tertiary)", flexShrink: 0 }}>{labelAr}</span>
              </span>
              {starred && <span style={{ fontSize: 11, color: "var(--accent-gold-strong)", flexShrink: 0 }}>★</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarPanel({ onNavigate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "var(--space-6) var(--space-4)", gap: "var(--space-5)" }}>
      <div style={{ padding: "0 var(--space-2)" }}>
        <Wordmark />
      </div>
      <WorkspaceSwitcher />
      <NavList onNavigate={onNavigate} />
      <AccountFooter />
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // No .beautyroute-ds class on any wrapper here: Sidebar is only ever
  // rendered inside Layout, which already establishes
  // .beautyroute-ds[data-theme="dark"] on its own root. Re-declaring the
  // class on a nested element would match the *light* .beautyroute-ds rule
  // (data-theme="dark" wouldn't be present on that inner element) and
  // silently override every inherited dark-mode token back to light --
  // custom properties cascade fine through a plain wrapper, so none is
  // needed here.
  return (
    <>
      {/* Compact mobile top bar -- the reference's own mobile.html uses a
          bottom tab bar limited to 4 destinations; this app has 10 real
          routes, so a full slide-over drawer (same nav content as desktop,
          nothing cut) is the safer match for "preserve all routes." */}
      <div
        className="flex md:hidden"
        style={{ alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 30 }}
      >
        <Wordmark />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--text-primary)", display: "flex" }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop rail */}
      <aside
        className="hidden md:flex md:w-60 shrink-0 h-screen sticky top-0"
        style={{ background: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" }}
      >
        <SidebarPanel />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden" role="dialog" aria-modal="true" aria-label="Navigation" style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "absolute", inset: 0, background: "var(--overlay-scrim)" }}
          />
          <div style={{ position: "relative", width: 260, maxWidth: "80vw", height: "100%", background: "var(--surface-card)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 10px 0" }}>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <SidebarPanel onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
