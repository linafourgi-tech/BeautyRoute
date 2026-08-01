import { Navigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import { useCurrentWorkspace } from "../../hooks/useCurrentWorkspace";
import { useSubscription } from "../../hooks/useSubscription";
import { canAccessApplication } from "../../services/subscription";
import { RouteLoading } from "./RouteLoading";
import { UpgradeRequired } from "../subscription/UpgradeRequired";

// Wraps every real application route. Order of checks matters for avoiding
// redirect loops: we never redirect on a "no" until we've actually finished
// loading that piece of state -- an unresolved "no" is not the same as a
// real "no".
export function ProtectedRoute({ children }) {
  const { user, profile, loading: sessionLoading } = useSession();
  const { workspaceId, loading: workspaceLoading } = useCurrentWorkspace();
  const subscriptionEnabled = Boolean(user) && Boolean(profile?.onboarding_completed);
  const { subscription, loading: subscriptionLoading } = useSubscription(subscriptionEnabled ? workspaceId : null);

  if (sessionLoading) return <RouteLoading />;

  if (!user) return <Navigate to="/login" replace />;

  if (!profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;

  // Still resolving workspace/subscription -- don't render gated content or
  // an upgrade screen off a guess.
  if (workspaceLoading || (subscriptionEnabled && subscriptionLoading)) return <RouteLoading />;

  if (!canAccessApplication(subscription)) return <UpgradeRequired />;

  return children;
}
