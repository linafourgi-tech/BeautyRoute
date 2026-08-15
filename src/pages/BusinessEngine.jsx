import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getClients } from "../services/clients";
import { getRevenueSeries } from "../services/revenue";
import { getExpensesSeries } from "../services/expenses";
import { Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
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
        if (!cancelled) setError(err.message || "Couldn't load your business numbers.");
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
    <Layout title="Business Engine" titleAr="الأعمال" subtitle="Revenue, expenses, longest-standing clients and reports — the numbers behind the chair.">
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: "var(--space-6)" }}>
            {/* en-US pinned explicitly, matching StylistDashboard's
                toLocaleString("en-US") -- an unpinned call renders with
                whatever thousands separator the host's default locale
                uses (e.g. "9 999" instead of "9,999"), which isn't a
                Riyadh-facing formatting choice. */}
            <MetricCard label="Revenue (6 mo)" value={isLoading ? "—" : `SAR ${totalRevenue.toLocaleString("en-US")}`} accent="gold" />
            <MetricCard label="Expenses (6 mo)" value={isLoading ? "—" : `SAR ${totalExpenses.toLocaleString("en-US")}`} accent="danger" />
            <MetricCard label="Net" value={isLoading ? "—" : `SAR ${(totalRevenue - totalExpenses).toLocaleString("en-US")}`} accent="sage" />
          </div>

          <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)", marginBottom: "var(--space-6)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 var(--space-4)" }}>Revenue vs expenses</h2>
            {isLoading ? (
              <Skeleton height={260} radius="var(--radius-lg)" />
            ) : (
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
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 var(--space-4)" }}>Longest-standing clients</h2>

            {isLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
              </div>
            )}

            {!isLoading && longestStandingClients.length === 0 && (
              <EmptyState title="No clients yet" description="Your longest-standing clients will show up here once you've added some." />
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
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>client since {c.since}</span>
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
