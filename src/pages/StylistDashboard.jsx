import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, MapPin, Search, X } from "lucide-react";
import Layout from "../components/Layout";
import { useSession } from "../hooks/useSession";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getTodaysAppointments } from "../services/appointments";
import { getClients } from "../services/clients";
import { getMonthlyRevenue } from "../services/revenue";
import { toAppointmentViewModel } from "../lib/appointmentView";
import { resolveWorkspaceLang } from "../lib/locale";
import { t, translateEnum, intlLocale } from "../lib/i18n";
import { Skeleton, EmptyState, Input } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

// Design migration (Phase 2, design-system-dashboard-shell): reworked to
// match the Claude Design "Professional Dashboard" reference's Overview
// page (project cd3127fb-33c9-4e08-a9c0-448004aebd5a,
// ui_kits/professional-dashboard/DashboardViews.jsx) -- a compact 4-up
// stat-card grid plus a "Today" bookings list, instead of Phase 1's larger
// editorial card layout. Every data hook, effect, handler, and piece of
// state below is byte-for-byte the same as Phase 1; only JSX
// markup/styling changed and one display-only element was removed (see
// below) -- no query, service call, or navigation behavior was touched.
//
// Removed: the "Today's route" map placeholder box and its Stops/Drive
// time/Est. fuel mini-stats. Both were already non-functional before this
// PR -- the placeholder was static text never wired to Mapbox, and the
// travel stats were computed from travelMinFromPrev/distanceKmFromPrev,
// which lib/appointmentView.js's own comment documents as hardcoded
// zero placeholders ("No schema support for routing/distance data yet...
// explicit placeholders, not fabricated numbers"), so they always read "0
// min" / "SAR 0". The reference's own Overview doesn't show a route/map
// card either -- that detail lives on its separate "Maps & Route" page,
// which maps to this app's existing /route (RouteEngine.jsx, untouched,
// out of scope) -- so the "Full map" link below still leads to the real,
// unchanged Mapbox-powered route experience.

// clients table has no photo/avatar column — explicit placeholder, not fabricated.
function toClientViewModel(row) {
  return {
    id: row.id,
    name: row.full_name,
    lastVisit: row.last_visit_at ? row.last_visit_at.slice(0, 10) : "No visits yet",
    photo: null,
  };
}

const STATUS_TONE = {
  confirmed: { fg: "var(--success-fg)", bg: "var(--success-bg)" },
  completed: { fg: "var(--success-fg)", bg: "var(--success-bg)" },
  pending: { fg: "var(--warning-fg)", bg: "var(--warning-bg)" },
  cancelled: { fg: "var(--error-fg)", bg: "var(--error-bg)" },
  noshow: { fg: "var(--error-fg)", bg: "var(--error-bg)" },
};

function StatCard({ value, metric }) {
  // Numeric/short values (counts, "SAR 1,234") get the full display size;
  // longer text values ("Not available") step down so they never wrap
  // awkwardly inside the compact card.
  const isLong = typeof value === "string" && value.length > 8;
  return (
    <div style={{ padding: "var(--space-5)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: isLong ? 18 : 28, color: "var(--text-primary)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: "var(--text-body-sm)", color: "var(--text-secondary)", margin: "2px 0 0" }}>{metric}</p>
    </div>
  );
}

function BookingRow({ appt, onClick, lang }) {
  const tone = STATUS_TONE[appt.status] || STATUS_TONE.pending;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "var(--space-4) var(--space-5)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-card)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, var(--espresso-700), var(--bg-sunken))", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.client}</p>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {appt.service} · {appt.time}
        </p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: tone.fg, background: tone.bg, padding: "4px 10px", borderRadius: "var(--radius-pill)", textTransform: "capitalize", flexShrink: 0 }}>
        {translateEnum("status", appt.status, lang)}
      </span>
    </button>
  );
}

export default function StylistDashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { profile } = useSession();
  const { workspace, workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();
  const lang = resolveWorkspaceLang(workspace);

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const firstName = (profile?.full_name || "there").split(" ")[0];

  useEffect(() => {
    if (workspaceLoading) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!workspaceId) {
        if (!cancelled) {
          setAppointments([]);
          setClients([]);
          setMonthlyRevenue(null);
          setLoading(false);
        }
        return;
      }

      try {
        const [appointmentRows, clientRows, revenueSummary] = await Promise.all([
          getTodaysAppointments(workspaceId),
          getClients(workspaceId),
          getMonthlyRevenue(workspaceId),
        ]);
        if (cancelled) return;
        setAppointments((appointmentRows ?? []).map(toAppointmentViewModel));
        setClients((clientRows ?? []).map(toClientViewModel));
        setMonthlyRevenue(revenueSummary.totalNet);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading, reloadToken]);

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  // appointments is already scoped to today only (getTodaysAppointments()
  // filters server-side -- see services/appointments.ts), so this just
  // orders what's already the correct set; no client-side date filter
  // needed anymore.
  const todays = useMemo(
    () => [...appointments].sort((a, b) => a.time.localeCompare(b.time)),
    [appointments]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, clients]);

  function goToPassport(clientId) {
    setQuery("");
    navigate(`/passport?client=${clientId}`);
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  const search = (
    <div style={{ position: "relative", width: 260 }}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("dashboard.searchPlaceholder", lang)}
        icon={<Search size={15} color="var(--text-tertiary)" />}
      />
      {/* Both the clear button and the dropdown below use insetInlineEnd,
          not a physical `right` -- Input's own icon already flips
          correctly under RTL (it's plain flex flow, not absolute
          positioning), and these two need to anchor to that same "end"
          edge consistently in both directions rather than staying pinned
          to the physical right in RTL mode. */}
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label={t("dashboard.clearSearch", lang)}
          style={{ position: "absolute", insetInlineEnd: 12, top: 15, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
        >
          <X size={14} />
        </button>
      )}

      {query && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 8,
            width: 320,
            insetInlineEnd: 0,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          {results.length === 0 && (
            <p style={{ padding: "14px 18px", fontSize: "var(--text-body-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              {t("dashboard.noClientMatch", lang, { query })}
            </p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => goToPassport(c.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }}
            >
              <img src={c.photo} alt="" style={{ height: 32, width: 32, borderRadius: "var(--radius-pill)", objectFit: "cover", background: "var(--bg-sunken)" }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("dashboard.lastVisit", lang, { date: c.lastVisit })}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Layout
      title={isLoading ? t("dashboard.greeting", lang) : t("dashboard.greeting", lang, { name: firstName })}
      headerActions={search}
    >
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                <Skeleton height={84} radius="var(--radius-lg)" />
                <Skeleton height={84} radius="var(--radius-lg)" />
                <Skeleton height={84} radius="var(--radius-lg)" />
                <Skeleton height={84} radius="var(--radius-lg)" />
              </>
            ) : (
              <>
                <StatCard value={todays.length} metric={t("dashboard.stat.appointmentsToday", lang)} />
                <StatCard value={clients.length} metric={t("dashboard.stat.activePassports", lang)} />
                <StatCard value={`SAR ${(monthlyRevenue ?? 0).toLocaleString(intlLocale(lang))}`} metric={t("dashboard.stat.revenueThisMonth", lang)} />
                {/* No reviews/ratings table exists in the schema yet -- an
                    honest unavailable state, never a fabricated number. */}
                <StatCard value={t("dashboard.notAvailable", lang)} metric={t("dashboard.stat.averageRating", lang)} />
              </>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: 0 }}>{t("dashboard.today", lang)}</h2>
              <Link to="/route" style={{ fontSize: "var(--text-body-sm)", color: "var(--accent-gold-strong)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                {t("dashboard.fullMap", lang)} <ArrowUpRight size={13} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {isLoading && (
                <>
                  <Skeleton height={64} radius="var(--radius-lg)" />
                  <Skeleton height={64} radius="var(--radius-lg)" />
                </>
              )}

              {!isLoading && todays.length === 0 && (
                <EmptyState title={t("dashboard.emptyTitle", lang)} description={t("dashboard.emptyDescription", lang)} />
              )}

              {!isLoading && todays.map((a) => (
                <BookingRow key={a.id} appt={a} onClick={() => goToPassport(a.clientId)} lang={lang} />
              ))}
            </div>
          </div>

          {!isLoading && todays.length > 0 && (
            <p style={{ fontSize: "var(--text-caption)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <MapPin size={12} /> {todays[0].location}
              {todays.length > 1 ? t("dashboard.moreStops", lang, { count: todays.length - 1 }) : ""}
            </p>
          )}
        </div>
      )}
    </Layout>
  );
}
