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
} from "lucide-react";
import { stylist } from "../data/mockData";

const nav = [
  { to: "/", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
  { to: "/appointments", label: "Appointments", labelAr: "المواعيد", icon: CalendarClock },
  { to: "/passport", label: "Beauty Passport", labelAr: "جواز الجمال", icon: BookHeart, starred: true },
  { to: "/route", label: "Route", labelAr: "المسار", icon: Map },
  { to: "/business", label: "Business", labelAr: "الأعمال", icon: LineChart },
  { to: "/ai", label: "AI Studio", labelAr: "الذكاء الاصطناعي", icon: Sparkles },
  { to: "/salon", label: "Salon", labelAr: "الصالون", icon: Store },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-72 shrink-0 flex-col bg-surface border-r border-line h-screen sticky top-0">
      <div className="flex items-center gap-3 px-7 py-8">
        <div className="h-11 w-11 rounded-2xl bg-wine flex items-center justify-center shrink-0">
          <Scissors size={18} className="text-onaccent" />
        </div>
        <div>
          <p className="font-display text-xl leading-none tracking-tight text-ivory">SalmaRoute</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-mono-tag mt-1.5">BeautyOS</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-3">
        {nav.map(({ to, label, labelAr, icon: Icon, starred }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
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
          {stylist.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ivory truncate">{stylist.name}</p>
          <p className="text-xs text-muted truncate">{stylist.role} · {stylist.city}</p>
        </div>
      </div>
    </aside>
  );
}
