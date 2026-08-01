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
import { useWorkspaceContext } from "../contexts/WorkspaceContext";

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
    <aside className="hidden md:flex md:w-72 shrink-0 flex-col bg-surface border-r border-line h-screen sticky top-0">
      <div className="flex items-center gap-3 px-7 py-8">
        <div className="h-11 w-11 rounded-2xl bg-wine flex items-center justify-center shrink-0">
          <Scissors size={18} className="text-onaccent" />
        </div>
        <div>
          <p className="font-display text-xl leading-none tracking-tight text-ivory">BeautyRoute</p>
        </div>
      </div>

      {/* Workspace switcher -- native <select> so keyboard operation (open,
          navigate, select, close) is correct for free rather than hand-rolled */}
      <div className="px-4 mb-2">
        {workspacesLoading ? (
          <div className="rounded-2xl border border-line px-4 py-3 text-xs text-muted">Loading workspace…</div>
        ) : workspacesError ? (
          <div className="rounded-2xl border border-danger/40 px-4 py-3 text-xs text-danger">Couldn't load workspaces</div>
        ) : workspaces.length === 0 ? null : workspaces.length === 1 ? (
          <div className="rounded-2xl border border-line px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">Workspace</p>
            <p className="text-sm text-ivory truncate">{workspace?.name}</p>
          </div>
        ) : (
          <label className="block rounded-2xl border border-line px-4 py-3 focus-within:border-wine transition-colors cursor-pointer">
            <span className="text-[10px] uppercase tracking-wide text-muted block mb-0.5">Workspace</span>
            <select
              value={workspaceId ?? ""}
              onChange={(e) => selectWorkspace(e.target.value)}
              aria-label="Switch workspace"
              className="w-full bg-transparent text-sm text-ivory outline-none cursor-pointer"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-3">
        {nav.map(({ to, label, labelAr, icon: Icon, starred }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-colors ${
                isActive
                  ? "bg-wine text-onaccent"
                  : "text-ivory hover:bg-surface-2"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={1.6} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className={`block text-[11px] leading-tight mt-0.5 ${isActive ? "text-onaccent/70" : "text-muted"}`}>
                    {labelAr}
                  </span>
                </span>
                {starred && (
                  <span className={`text-xs ${isActive ? "text-onaccent" : "text-gold"}`}>★</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 mb-6 mt-4 pt-5 border-t border-line flex items-center gap-3 px-2">
        <div className="h-10 w-10 rounded-full bg-surface-2 border border-line flex items-center justify-center font-display text-wine text-sm">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ivory truncate">{displayName}</p>
          <p className="text-xs text-muted truncate">{workspace?.name || "No workspace yet"}</p>
        </div>
      </div>
    </aside>
  );
}
