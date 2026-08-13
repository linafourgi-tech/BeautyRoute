import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { useSession } from "../hooks/useSession";
import { useWorkspaceContext } from "../contexts/useWorkspaceContext";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 1, design-system-dashboard-shell): reskinned onto
// the beautyroute-ds tokens already proven on Login/Signup -- every route,
// label, bilingual string, active-state rule, and workspace-switcher
// behavior below is unchanged from the previous Tailwind-themed version.
// Only the visual layer (inline styles + design tokens instead of
// src/index.css's "Quiet Luxury" Tailwind classes) changed.
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

export default function Sidebar() {
  const { profile } = useSession();
  const { workspaces, workspace, workspaceId, selectWorkspace, loading: workspacesLoading, error: workspacesError } = useWorkspaceContext();

  const displayName = profile?.full_name?.trim() || "Your account";
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <aside
      className="beautyroute-ds hidden md:flex md:w-72 shrink-0 flex-col h-screen sticky top-0"
      style={{ background: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)", fontFamily: "var(--font-body)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "var(--space-8) var(--space-6) var(--space-6)" }}>
        <div style={{ height: 44, width: 44, borderRadius: "var(--radius-lg)", background: "var(--charcoal-900)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Scissors size={18} color="var(--ivory-100)" />
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1, letterSpacing: "var(--ls-display)", color: "var(--text-primary)", margin: 0 }}>
          Beauty<span style={{ color: "var(--accent-gold-strong)" }}>Route</span>
        </p>
      </div>

      {/* Workspace switcher -- native <select> so keyboard operation (open,
          navigate, select, close) is correct for free rather than hand-rolled */}
      <div style={{ padding: "0 var(--space-4)", marginBottom: "var(--space-2)" }}>
        {workspacesLoading ? (
          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", padding: "12px 16px", fontSize: "var(--text-caption)", color: "var(--text-tertiary)" }}>
            Loading workspace…
          </div>
        ) : workspacesError ? (
          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--error-fg)", padding: "12px 16px", fontSize: "var(--text-caption)", color: "var(--error-fg)" }}>
            Couldn't load workspaces
          </div>
        ) : workspaces.length === 0 ? null : workspaces.length === 1 ? (
          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", padding: "12px 16px" }}>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 2px" }}>Workspace</p>
            <p style={{ fontSize: "var(--text-body-sm)", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name}</p>
          </div>
        ) : (
          <label style={{ display: "block", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", padding: "12px 16px", cursor: "pointer" }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", display: "block", marginBottom: 2 }}>
              Workspace
            </span>
            <select
              value={workspaceId ?? ""}
              onChange={(e) => selectWorkspace(e.target.value)}
              aria-label="Switch workspace"
              style={{ width: "100%", background: "transparent", fontSize: "var(--text-body-sm)", color: "var(--text-primary)", border: "none", outline: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav style={{ flex: 1, padding: "0 var(--space-4)", marginTop: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {nav.map(({ to, label, labelAr, icon: Icon, starred }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderRadius: "var(--radius-lg)",
              padding: "13px 16px",
              textDecoration: "none",
              transition: `background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)`,
              background: isActive ? "var(--bg-sunken)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={1.6} color={isActive ? "var(--accent-gold-strong)" : "currentColor"} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "var(--text-body-sm)", fontWeight: isActive ? 600 : 500, lineHeight: 1.25 }}>{label}</span>
                  <span style={{ display: "block", fontSize: 11, lineHeight: 1.25, marginTop: 2, color: "var(--text-tertiary)" }}>{labelAr}</span>
                </span>
                {starred && <span style={{ fontSize: 12, color: "var(--accent-gold-strong)" }}>★</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ margin: "var(--space-4)", marginTop: "var(--space-5)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ height: 40, width: 40, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", color: "var(--accent-gold-strong)", fontSize: 14, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "var(--text-body-sm)", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name || "No workspace yet"}</p>
        </div>
      </div>
    </aside>
  );
}
