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
  // Replaces the old mock's arbitrary array order with a real, sorted
  // signal -- but naming it accurately matters exactly as much as the data
  // being real.
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
    <Layout
      title="Business Engine"
      subtitle="Revenue, expenses, longest-standing clients and reports — the numbers behind the chair."
    >
      {failed && (
        <div className="beautyroute-ds">
          <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />
        </div>
      )}

      {!failed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* en-US pinned explicitly, matching StylistDashboard's
                toLocaleString("en-US") -- an unpinned call renders with
                whatever thousands separator the host's default locale
                uses (e.g. "9 999" instead of "9,999"), which isn't a
                Riyadh-facing formatting choice. */}
            <MetricCard label="Revenue (6 mo)" value={isLoading ? "—" : `SAR ${totalRevenue.toLocaleString("en-US")}`} accent="gold" />
            <MetricCard label="Expenses (6 mo)" value={isLoading ? "—" : `SAR ${totalExpenses.toLocaleString("en-US")}`} accent="danger" />
            <MetricCard label="Net" value={isLoading ? "—" : `SAR ${(totalRevenue - totalExpenses).toLocaleString("en-US")}`} accent="sage" />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 mb-6">
            <h2 className="font-display text-lg text-ivory mb-4">Revenue vs expenses</h2>
            {isLoading ? (
              <div className="beautyroute-ds">
                <Skeleton height={260} radius="var(--radius-lg)" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B9905A" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#B9905A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DCCC" />
                  <XAxis dataKey="month" stroke="#8C7B6C" fontSize={12} />
                  <YAxis stroke="#8C7B6C" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#FFFFFF", border: "1px solid #E8DCCC", borderRadius: 12, color: "#2B241F" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#B9905A" fill="url(#rev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="#9C5568" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-display text-lg text-ivory mb-4">Longest-standing clients</h2>

            {isLoading && (
              <div className="beautyroute-ds space-y-3">
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
                <Skeleton height={40} radius="var(--radius-lg)" />
              </div>
            )}

            {!isLoading && longestStandingClients.length === 0 && (
              <div className="beautyroute-ds">
                <EmptyState title="No clients yet" description="Your longest-standing clients will show up here once you've added some." />
              </div>
            )}

            {!isLoading && longestStandingClients.length > 0 && (
              <div className="space-y-2">
                {longestStandingClients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-[11px] font-medium text-wine">
                        {initials(c.name)}
                      </span>
                      <span className="text-ivory text-sm">{c.name}</span>
                    </div>
                    <span className="text-muted text-xs font-mono-tag">client since {c.since}</span>
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

const accentClass = {
  gold: "text-gold",
  danger: "text-danger",
  sage: "text-sage",
};

function MetricCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-muted text-xs uppercase tracking-wide">{label}</p>
      <p className={`font-display text-2xl mt-1 ${accentClass[accent]}`}>{value}</p>
    </div>
  );
}
