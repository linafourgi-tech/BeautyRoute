import { Navigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import { RouteLoading } from "./RouteLoading";

// Guards /onboarding specifically: must be signed in, and must NOT have
// already completed onboarding (an already-onboarded user is bounced to
// /dashboard rather than re-running the wizard).
export function OnboardingRoute({ children }) {
  const { user, profile, loading } = useSession();

  if (loading) return <RouteLoading />;

  if (!user) return <Navigate to="/login" replace />;

  if (profile?.onboarding_completed) return <Navigate to="/dashboard" replace />;

  return children;
}
