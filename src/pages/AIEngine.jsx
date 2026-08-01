import { useRef, useState, useEffect } from "react";
import { Sparkles, Send, ShieldAlert } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { hasFeature } from "../services/subscription";
import { FeatureGate } from "../components/subscription/FeatureGate";
import { sendAssistantMessage, AiUnavailableError } from "../services/ai";

const EXAMPLE_QUESTIONS = [
  "What appointments are scheduled today?",
  "Which clients have not returned recently?",
  "Summarize this client's history.",
  "Which services are currently inactive?",
  "What happened during the client's latest visit?",
];

export default function AIEngine() {
  const { workspace, workspaceId, loading: workspaceLoading } = useCurrentWorkspace();
  const { subscription, loading: subLoading } = useSubscription(workspaceId);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending || !workspaceId) return;
    setError(null);
    const history = messages.slice(-20).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const { text: reply } = await sendAssistantMessage(workspaceId, trimmed, history);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err instanceof AiUnavailableError ? err : new AiUnavailableError("unknown", "Something went wrong. Please try again."));
    } finally {
      setSending(false);
    }
  }

  const isLoading = workspaceLoading || subLoading;
  const gated = !isLoading && !hasFeature(subscription, "ai");

  return (
    <Layout
      title="AI Assistant"
      subtitle="Ask about your workspace — appointments, clients, and services. Grounded in your real data, never invented."
    >
      {isLoading && <p className="text-muted text-sm">Loading…</p>}

      {gated && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <Sparkles size={22} className="text-gold mx-auto mb-3" />
          <h2 className="font-display text-xl text-ivory mb-2">AI Assistant is a Professional feature</h2>
          <p className="text-muted text-sm max-w-md mx-auto">
            Upgrade your plan to ask the AI assistant about your appointments, clients, and services.
          </p>
        </div>
      )}

      {!isLoading && !gated && (
        <FeatureGate subscription={subscription} feature="ai">
          <div className="flex flex-col rounded-3xl border border-line bg-surface overflow-hidden" style={{ height: "min(70vh, 640px)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2">
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-full bg-wine flex items-center justify-center">
                  <Sparkles size={14} className="text-onaccent" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ivory leading-tight">Workspace Assistant</p>
                  <p className="text-[11px] text-muted leading-tight">{workspace?.display_brand || workspace?.name || "No workspace selected"}</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {messages.length === 0 && !error && (
                <div>
                  <p className="text-muted text-sm mb-3">Try asking:</p>
                  <div className="space-y-2">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="w-full flex items-center gap-2.5 text-left text-[13px] text-ivory border border-line rounded-xl px-3.5 py-2.5 hover:border-wine/50 hover:bg-surface-2 transition-colors"
                      >
                        <Sparkles size={13} className="text-wine shrink-0" />
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="text-muted text-xs mt-4">
                    I can only answer questions about data already in BeautyRoute — I can't take actions like booking or messaging clients.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user" ? "bg-wine text-onaccent" : "bg-surface-2 text-ivory border border-line"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-surface-2 text-muted border border-line rounded-2xl px-4 py-2.5 text-[13px]">Thinking…</div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger">
                  <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                  <span>{error.message}</span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-line p-4 flex items-center gap-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your appointments, clients, or services…"
                disabled={sending}
                className="flex-1 bg-surface-2 border border-line rounded-full px-4 py-2.5 text-sm text-ivory placeholder:text-muted outline-none focus:border-wine disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="h-10 w-10 rounded-full bg-wine text-onaccent flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </FeatureGate>
      )}

      {!isLoading && !gated && (
        <p className="text-muted text-xs mt-4">
          Responses are AI-generated from your workspace data and may be incomplete or wrong — always review before relying on them or sharing with a client.
        </p>
      )}
    </Layout>
  );
}
