import { Check, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Badge } from "../components/ui";
import { useSession } from "../hooks/useSession";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { isTrial, getRemainingTrialDays } from "../services/subscription";
import { PLANS, PLAN_ORDER } from "../lib/plans";
import "../styles/beautyroute/styles.css";

// Composition pass: Pricing intentionally stays on the LIGHT default
// beautyroute-ds theme, not the dark authenticated shell -- the design
// reference's own marketing/plan surfaces render light (no
// data-theme="dark"), the same convention already used for Login/Signup.
// Forcing it dark would actually contradict the reference, not match it.
// The real problem was that it had NO navigational chrome at all: someone
// clicking "View plans" from deep in the dark app landed on a page with no
// way back and no visual link to where they came from -- an abrupt dead
// end, not just a color change. Fixed with a slim top bar (wordmark + a
// real way back for a signed-in user), not a theme change. Every
// plan/feature/current-plan/CTA-disabled value below is unchanged.
export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { workspaceId } = useCurrentWorkspace();
  const { subscription } = useSubscription(user ? workspaceId : null);

  return (
    <div
      className="beautyroute-ds"
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px var(--space-6)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-primary)" }}>
          Beauty<span style={{ color: "var(--accent-gold)" }}>Route</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(user ? "/dashboard" : "/login")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
        >
          <ArrowLeft size={14} /> {user ? "Back to dashboard" : "Sign in"}
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-16) var(--space-6)" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-md)", color: "var(--text-primary)", margin: "0 0 12px" }}>
            Plans for every stage of your business
          </h1>
          {subscription && isTrial(subscription) && (
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>
              You're on a free trial — {getRemainingTrialDays(subscription)} day{getRemainingTrialDays(subscription) === 1 ? "" : "s"} left.
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const isCurrent = subscription?.plan_tier === key;
            return (
              <div
                key={key}
                style={{
                  background: "var(--surface-card)",
                  border: isCurrent ? "1px solid var(--accent-gold-strong)" : "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-md)",
                  padding: "var(--space-8)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: 0 }}>
                      {plan.displayName}
                    </h2>
                    {isCurrent && <Badge tone="gold">Current plan</Badge>}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 12px" }}>{plan.tagline}</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: 0 }}>
                    {plan.price}
                  </p>
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {Object.entries(plan.features).map(([feature, enabled]) => (
                    <li
                      key={feature}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: enabled ? "var(--text-primary)" : "var(--text-tertiary)",
                        opacity: enabled ? 1 : 0.5,
                      }}
                    >
                      <Check size={14} style={{ color: enabled ? "var(--success-fg)" : "var(--text-tertiary)", flexShrink: 0 }} />
                      {featureLabel(feature)}
                    </li>
                  ))}
                </ul>

                <Button variant={isCurrent ? "secondary" : "gold"} disabled>
                  Coming Soon
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function featureLabel(key) {
  const labels = {
    ai: "AI consultation & recommendations",
    routing: "Smart route optimization",
    staff: "Staff & team management",
    analytics: "Business analytics",
    unlimitedClients: "Unlimited clients",
  };
  return labels[key] ?? key;
}
