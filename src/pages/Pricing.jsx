import { Check } from "lucide-react";
import { Button, Badge } from "../components/ui";
import { useSession } from "../hooks/useSession";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSubscription } from "../hooks/useSubscription";
import { isTrial, getRemainingTrialDays } from "../services/subscription";
import { PLANS, PLAN_ORDER } from "../lib/plans";
import "../styles/beautyroute/styles.css";

export default function Pricing() {
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
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-primary)", marginBottom: 20 }}>
            Beauty<span style={{ color: "var(--accent-gold)" }}>Route</span>
          </div>
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
