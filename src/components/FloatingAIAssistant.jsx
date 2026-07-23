import { useState } from "react";
import { Sparkles, X, Send, TrendingUp, Clock3, Crown } from "lucide-react";
import { appointments, revenueByMonth, clients } from "../data/mockData";

const QUICK_QUESTIONS = [
  { icon: Clock3, text: "Show me my peak booking hours this month" },
  { icon: TrendingUp, text: "How is revenue trending?" },
  { icon: Crown, text: "Who is my most loyal client?" },
];

/**
 * Rule-based demo responder — genuinely reads mock data rather than
 * returning static copy. Swap for a real model call against the
 * Business + Beauty Memory engines when the backend exists.
 */
function answer(question) {
  const q = question.toLowerCase();

  if (q.includes("peak") || q.includes("hour")) {
    const counts = {};
    appointments.forEach((a) => { counts[a.time] = (counts[a.time] || 0) + 1; });
    const [time] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["—"];
    return `Your busiest slot is ${time} — that's when you get the most bookings. Consider blocking prep time right before it.`;
  }

  if (q.includes("revenue") || q.includes("trend") || q.includes("money")) {
    const last = revenueByMonth[revenueByMonth.length - 1];
    const prev = revenueByMonth[revenueByMonth.length - 2];
    const delta = (((last.revenue - prev.revenue) / prev.revenue) * 100).toFixed(0);
    const direction = delta >= 0 ? "up" : "down";
    return `${last.month} revenue is SAR ${last.revenue.toLocaleString()}, ${direction} ${Math.abs(delta)}% from ${prev.month}. Net after expenses: SAR ${(last.revenue - last.expenses).toLocaleString()}.`;
  }

  if (q.includes("loyal") || q.includes("best client") || q.includes("vip")) {
    const vip = clients.find((c) => c.tags.includes("VIP")) ?? clients[0];
    return `${vip.name} — client since ${new Date(vip.since).getFullYear()}, with ${vip.timeline.length} logged visits and a ${vip.tags.join(", ").toLowerCase()} profile.`;
  }

  if (q.includes("cancel")) {
    const pending = appointments.filter((a) => a.status === "pending").length;
    return `You have ${pending} appointment${pending === 1 ? "" : "s"} still pending confirmation — worth a reminder nudge.`;
  }

  return "I can help with booking patterns, revenue trends, and your most loyal clients — try one of the questions below, or ask me anything about your business.";
}

export default function FloatingAIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi Salma — ask me anything about your business." },
  ]);
  const [input, setInput] = useState("");

  function send(text) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: answer(text) }]);
    setInput("");
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[340px] max-h-[65vh] rounded-3xl border border-line bg-surface shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-surface-2">
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-wine flex items-center justify-center">
                <Sparkles size={14} className="text-onaccent" />
              </span>
              <div>
                <p className="text-sm font-medium text-ivory leading-tight">AI Business Assistant</p>
                <p className="text-[11px] text-muted leading-tight">مساعدك الذكي</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ivory">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user" ? "bg-wine text-onaccent" : "bg-surface-2 text-ivory border border-line"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-2 pt-1">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => send(q.text)}
                    className="w-full flex items-center gap-2.5 text-left text-[13px] text-ivory border border-line rounded-xl px-3 py-2.5 hover:border-wine/50 hover:bg-surface-2 transition-colors"
                  >
                    <q.icon size={14} className="text-wine shrink-0" />
                    {q.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about your business…"
              className="flex-1 bg-surface-2 border border-line rounded-full px-4 py-2 text-[13px] text-ivory placeholder:text-muted outline-none focus:border-wine"
            />
            <button
              onClick={() => send(input)}
              className="h-8 w-8 rounded-full bg-wine text-onaccent flex items-center justify-center shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-wine text-onaccent shadow-xl flex items-center justify-center hover:bg-wine-light transition-colors"
        aria-label="Open AI Business Assistant"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </>
  );
}
