import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import Layout from "../components/Layout";

const suggestions = [
  "What formula did I use on Nour last time?",
  "Suggest a color for a client with warm undertones",
  "Which clients are overdue for a follow-up?",
  "Draft a WhatsApp reminder for tomorrow's bookings",
];

export default function AIEngine() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi Salma — I'm your AI Business Coach. Ask me about a client, a formula, or your schedule." },
  ]);
  const [input, setInput] = useState("");

  function send(text) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "ai", text: "This is a demo response — connect this engine to your model + client database to answer from real Beauty Passport data." },
    ]);
    setInput("");
  }

  return (
    <Layout
      title="AI Engine"
      subtitle="Not a generic chatbot — an AI trained on beauty: face analysis, hair recommendations, and business coaching."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface flex flex-col h-[520px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-wine text-onaccent" : "bg-surface-2 text-ivory border border-line"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask the AI Engine…"
              className="flex-1 bg-surface-2 border border-line rounded-full px-4 py-2 text-sm text-ivory placeholder:text-muted outline-none focus:border-gold"
            />
            <button
              onClick={() => send(input)}
              className="h-9 w-9 rounded-full bg-gold text-onaccent flex items-center justify-center shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-display text-lg text-ivory mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-gold" /> Try asking
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full text-left text-sm text-muted hover:text-ivory border border-line rounded-lg px-3 py-2 hover:border-gold/50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
