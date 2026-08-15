import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, ShieldAlert, Lock } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { hasFeature } from "../services/subscription";
import { FeatureGate } from "../components/subscription/FeatureGate";
import { sendAssistantMessage, AiUnavailableError } from "../services/ai";
import { Button } from "../components/ui";
import { useAppLang } from "../hooks/useAppLang";
import { t } from "../lib/i18n";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds. Every data hook, effect, and piece of state below is
// byte-for-byte the same as before; only markup/styling changed.

// Localization (design-refinement pass): example-question copy now lives in
// lib/i18n.js (ai.exampleQuestion.*) so it can be shown in either language;
// this array is now built inside the component from t(), not a static
// English-only module constant.
const EXAMPLE_QUESTION_KEYS = [
  "ai.exampleQuestion.today",
  "ai.exampleQuestion.notReturned",
  "ai.exampleQuestion.summarize",
  "ai.exampleQuestion.inactiveServices",
  "ai.exampleQuestion.lastVisit",
];

export default function AIEngine() {
  const navigate = useNavigate();
  const { lang } = useAppLang();
  const { workspace, workspaceId, loading: workspaceLoading } = useCurrentWorkspace();
  const { subscription, loading: subLoading } = useSubscription(workspaceId);
  const EXAMPLE_QUESTIONS = EXAMPLE_QUESTION_KEYS.map((key) => t(key, lang));

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
      setError(err instanceof AiUnavailableError ? err : new AiUnavailableError("unknown", t("ai.genericError", lang)));
    } finally {
      setSending(false);
    }
  }

  const isLoading = workspaceLoading || subLoading;
  const gated = !isLoading && !hasFeature(subscription, "ai");

  return (
    <Layout title={t("ai.title", lang)} subtitle={t("ai.subtitle", lang)}>
      {isLoading && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("ai.loading", lang)}</p>}

      {/* Composition pass: this was previously just descriptive text with no
          actual path forward -- an "upgrade wall" in the least useful sense.
          It now explains what the feature actually does (reusing the real
          EXAMPLE_QUESTIONS list, not invented copy) and gives a real CTA to
          /pricing, matching TrialBanner's existing "View plans" pattern.
          hasFeature()/FeatureGate gating logic is untouched -- this is
          presentation only. */}
      {gated && (
        <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-8) var(--space-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
            <span style={{ height: 44, width: 44, borderRadius: "50%", background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Lock size={18} color="var(--accent-gold-strong)" />
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 8px" }}>{t("ai.gatedTitle", lang)}</h2>
            <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: "0 0 20px" }}>
              {t("ai.gatedDescription", lang)}
            </p>
            <Button variant="gold" onClick={() => navigate("/pricing")}>{t("ai.viewPlans", lang)}</Button>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 28, paddingTop: 20, display: "grid", gap: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 4px", textAlign: "center" }}>{t("ai.whatYoullAsk", lang)}</p>
            {EXAMPLE_QUESTIONS.slice(0, 3).map((q) => (
              <div key={q} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                <Sparkles size={13} color="var(--accent-gold-strong)" style={{ flexShrink: 0 }} />
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !gated && (
        <FeatureGate subscription={subscription} feature="ai">
          <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", overflow: "hidden", height: "min(70vh, 640px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px var(--space-6)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-sunken)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ height: 32, width: 32, borderRadius: "50%", background: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Sparkles size={14} color="var(--charcoal-900)" />
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.2 }}>{t("ai.workspaceAssistant", lang)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.2 }}>{workspace?.display_brand || workspace?.name || t("ai.noWorkspaceSelected", lang)}</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 && !error && (
                <div>
                  <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: "0 0 12px" }}>{t("ai.tryAsking", lang)}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textAlign: "left",
                          fontSize: 13,
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          padding: "10px 14px",
                          background: "transparent",
                          cursor: "pointer",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        <Sparkles size={13} color="var(--accent-gold-strong)" style={{ flexShrink: 0 }} />
                        {q}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 16 }}>
                    {t("ai.disclaimer", lang)}
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "85%",
                      borderRadius: "var(--radius-lg)",
                      padding: "10px 16px",
                      fontSize: 13,
                      lineHeight: "var(--lh-body)",
                      whiteSpace: "pre-wrap",
                      background: m.role === "user" ? "var(--accent-gold)" : "var(--bg-sunken)",
                      color: m.role === "user" ? "var(--charcoal-900)" : "var(--text-primary)",
                      border: m.role === "user" ? "none" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {sending && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "var(--bg-sunken)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "10px 16px", fontSize: 13 }}>{t("ai.thinking", lang)}</div>
                </div>
              )}

              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: "var(--radius-md)", border: "1px solid var(--error-fg)", background: "var(--error-bg)", padding: "10px 14px", fontSize: 13, color: "var(--error-fg)" }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error.message}</span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              style={{ borderTop: "1px solid var(--border-subtle)", padding: "var(--space-4)", display: "flex", alignItems: "center", gap: 10 }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("ai.messagePlaceholder", lang)}
                disabled={sending}
                aria-label={t("ai.messageLabel", lang)}
                style={{
                  flex: 1,
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-pill)",
                  padding: "11px 18px",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  outline: "none",
                  opacity: sending ? 0.6 : 1,
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label={t("ai.send", lang)}
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: "50%",
                  background: "var(--accent-gold)",
                  color: "var(--charcoal-900)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                  opacity: sending || !input.trim() ? 0.5 : 1,
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </FeatureGate>
      )}

      {!isLoading && !gated && (
        <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 16 }}>
          {t("ai.footerDisclaimer", lang)}
        </p>
      )}
    </Layout>
  );
}
