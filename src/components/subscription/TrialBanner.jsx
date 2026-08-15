import { useNavigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import { useCurrentWorkspace } from "../../hooks/useCurrentWorkspace";
import { useSubscription } from "../../hooks/useSubscription";
import {
  getRemainingTrialDays,
  isTrial,
  isExpired,
  isTrialEndingSoon,
} from "../../services/subscription";
import "../../styles/beautyroute/styles.css";

// Self-contained: resolves its own workspace/subscription via the shared
// hooks and renders nothing for a signed-out visitor or an active
// (non-trial, non-expired) workspace.
export function TrialBanner() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { workspaceId } = useCurrentWorkspace();
  const { subscription } = useSubscription(user ? workspaceId : null);

  if (sessionLoading || !user || !subscription) return null;

  const expired = isExpired(subscription);
  const trial = isTrial(subscription);
  if (!expired && !trial) return null;

  const warning = expired || isTrialEndingSoon(subscription);
  const days = getRemainingTrialDays(subscription);

  // Design-refinement pass: this used to re-declare className="beautyroute-ds"
  // on its own root. TrialBanner only ever renders inside Layout, which
  // already establishes .beautyroute-ds[data-theme="dark"] one level up --
  // re-declaring the bare class here (without data-theme="dark" on this same
  // element) matched the *light* .beautyroute-ds rule instead and silently
  // reset every inherited dark token back to light, which is exactly why the
  // banner looked visually disconnected from the rest of the dark shell.
  // Same bug, same fix shape as Sidebar.jsx and ErrorState.jsx.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "10px 20px",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        color: warning ? "var(--error-fg)" : "var(--text-secondary)",
        background: warning ? "var(--error-bg)" : "var(--surface-card-alt)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span>
        {expired
          ? "Your trial has ended."
          : `Your free trial ends in ${days} day${days === 1 ? "" : "s"}.`}
      </span>
      <button
        type="button"
        onClick={() => navigate("/pricing")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontWeight: 600,
          fontSize: 13,
          color: "var(--accent-gold-strong)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        {expired ? "Upgrade Now" : "View plans"}
      </button>
    </div>
  );
}
