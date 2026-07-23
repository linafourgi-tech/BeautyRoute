import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { revenueByMonth, clients } from "../data/mockData";
import Layout from "../components/Layout";

export default function BusinessEngine() {
  const total = revenueByMonth.reduce((s, m) => s + m.revenue, 0);
  const expenses = revenueByMonth.reduce((s, m) => s + m.expenses, 0);

  return (
    <Layout
      title="Business Engine"
      subtitle="Revenue, expenses, loyal customers and reports — the numbers behind the chair."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Revenue (6 mo)" value={`SAR ${total.toLocaleString()}`} accent="gold" />
        <MetricCard label="Expenses (6 mo)" value={`SAR ${expenses.toLocaleString()}`} accent="danger" />
        <MetricCard label="Net" value={`SAR ${(total - expenses).toLocaleString()}`} accent="sage" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 mb-6">
        <h2 className="font-display text-lg text-ivory mb-4">Revenue vs expenses</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={revenueByMonth}>
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
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg text-ivory mb-4">Most loyal clients</h2>
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
              <div className="flex items-center gap-3">
                <img src={c.photo} className="h-8 w-8 rounded-full object-cover" alt="" />
                <span className="text-ivory text-sm">{c.name}</span>
              </div>
              <span className="text-muted text-xs font-mono-tag">client since {c.since}</span>
            </div>
          ))}
        </div>
      </div>
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
