import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getClients } from "../services/clients";
import { getRevenueSeries } from "../services/revenue";
import { getExpensesSeries } from "../services/expenses";
import { Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import { useAppLang } from "../hooks/useAppLang";
import { t, intlLocale } from "../lib/i18n";
import "../styles/beautyroute/styles.css";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds. Every data hook, effect, and piece of state below is
// byte-for-byte the same as before; only markup/styling changed -- including
// the recharts colors, which move from hardcoded old-theme hex to the
// equivalent beautyroute-ds dark-theme token hex (tokens/colors.css's
// [data-theme="dark"] block) since SVG presentation attributes here take
// literal color values, not CSS custom properties.

const LONGEST_STANDING_CLIENTS_SHOWN = 5;

// clients table has no photo/avatar column -- explicit placeholder, not
// fabricated (same convention as StylistDashboard's toClientViewModel).
function toClientViewModel(row) {
  return {
    id: row.id,
    name: row.full_name,
    since: row.created_at ? row.created_at.slice(0, 10) : null,
  };
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const ACCENT_COLOR = {
  gold: "var(--accent-gold-strong)",
  danger: "var(--error-fg)",
  sage: "var(--success-fg)",
};

export default function BusinessEngine() {
  const { lang } = useAppLang();
  const { workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();

  const [revenueSeries, setRevenueSeries] = useState([]);
  const [expenseSeries, setExpenseSeries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (workspaceLoading) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!workspaceId) {
        if (!cancelled) {
          setRevenueSeries([]);
          setExpenseSeries([]);
          setClients([]);
          setLoading(false);
        }
        return;
      }

      try {
        const [revenue, expenses, clientRows] = await Promise.all([
          getRevenueSeries(workspaceId),
          getExpensesSeries(workspaceId),
          getClients(workspaceId),
        ]);
        if (cancelled) return;
        setRevenueSeries(revenue);
        setExpenseSeries(expenses);
        setClients((clientRows ?? []).map(toClientViewModel));
      } catch (err) {
        if (!cancelled) setError(err.message || t("business.errorFallback", lang));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // `lang` is deliberately excluded -- see Appointments.jsx's identical
    // comment for why (fallback error-message translation only, not worth
    // an extra fetch on a language switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaceLoading, reloadToken]);

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  // Zip the two independently-fetched series into the {month, revenue,
  // expenses} shape the chart expects. Safe to zip by index rather than by
  // monthKey because both services build their buckets through the same
  // lib/monthSeries.js helper with the same `months`/referenceDate
  // defaults, so they're always the same length and month order.
  const chartData = useMemo(
    () =>
      revenueSeries.map((point, i) => ({
        month: point.label,
        revenue: point.total,
        expenses: expenseSeries[i]?.total ?? 0,
      })),
    [revenueSeries, expenseSeries]
  );

  const totalRevenue = chartData.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = chartData.reduce((s, m) => s + m.expenses, 0);
  // A brand-new workspace has 6 real months of zero-value points, not zero
  // points -- recharts renders that as a full-height flat line at the axis,
  // which reads as a broken/empty chart rather than "no data yet." Detect
  // that specific real case and show an actual empty state instead of a
  // chart with nothing meaningful to look at.
  const hasChartActivity = totalRevenue > 0 || totalExpenses > 0;

  // Deliberately labeled "longest-standing," not "most loyal" -- this is
  // ranked purely by earliest created_at (tenure), which is the only
  // client-ranking signal the current schema can honestly produce. It is
  // NOT a loyalty, engagement, or visit-frequency measure, and must not be
  // presented as one: a real "most loyal" ranking would need a
  // workspace-wide visit-count aggregate that doesn't exist yet
  // (services/visits.ts only exposes getClientVisitHistory(clientId), a
  // per-client query, not a workspace-wide one this page could sort by).
  const longestStandingClients = useMemo(
    () =>
      [...clients]
        .filter((c) => c.since)
        .sort((a, b) => a.since.localeCompare(b.since))
        .slice(0, LONGEST_STANDING_CLIENTS_SHOWN),
    [clients]
  );

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <Layout title={t("business.title", lang)} subtitle={t("business.subtitle", lang)}>
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: "var(--space-6)" }}>
            {/* Numeral formatting now follows the active language (via
                intlLocale()) instead of being pinned to en-US unconditionally
                -- ar-SA renders Arabic-Indic numerals, matching the design
                reference's own formatSAR() intent for SAR values. */}
            <MetricCard label={t("business.revenue6mo", lang)} value={isLoading ? "—" : `SAR ${totalRevenue.toLocaleString(intlLocale(lang))}`} accent="gold" />
            <MetricCard label={t("business.expenses6mo", lang)} value={isLoading ? "—" : `SAR ${totalExpenses.toLocaleString(intlLocale(lang))}`} accent="danger" />
            <MetricCard label={t("business.net", lang)} value={isLoading ? "—" : `SAR ${(totalRevenue - totalExpenses).toLocaleString(intlLocale(lang))}`} accent="sage" />
          </div>

          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)", marginBottom: "var(--space-6)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 var(--space-4)" }}>{t("business.revenueVsExpenses", lang)}</h2>
            {isLoading && <Skeleton height={260} radius="var(--radius-lg)" />}
            {!isLoading && !hasChartActivity && (
              <EmptyState
                title={t("business.emptyChartTitle", lang)}
                description={t("business.emptyChartDescription", lang)}
              />
            )}
            {!isLoading && hasChartActivity && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.08)" />
                  <XAxis dataKey="month" stroke="#B7A488" fontSize={12} />
                  <YAxis stroke="#B7A488" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#1F1B18", border: "1px solid rgba(250,247,242,0.14)", borderRadius: 12, color: "#FAF7F2" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fill="url(#rev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="#B0453E" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 var(--space-4)" }}>{t("business.longestStandingClients", lang)}</h2>

            {isLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
              </div>
            )}

            {!isLoading && longestStandingClients.length === 0 && (
              <EmptyState title={t("business.emptyClientsTitle", lang)} description={t("business.emptyClientsDescription", lang)} />
            )}

            {!isLoading && longestStandingClients.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {longestStandingClients.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", padding: "10px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ height: 30, width: 30, borderRadius: "50%", background: "var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "var(--accent-gold-strong)" }}>
                        {initials(c.name)}
                      </span>
                      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("business.clientSince", lang, { date: c.since })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-5)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: 0 }}>{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", margin: "4px 0 0", color: ACCENT_COLOR[accent] }}>{value}</p>
    </div>
  );
}
