import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUser } from "../services/auth";
import { getProfile } from "../services/profiles";
import { supabase } from "../lib/supabase";
import { SessionContext } from "./useSessionContext";

// Phase 13 Step 2: single source of truth for "who is signed in and what's
// their profile," shared by every page/guard that used to call useSession()
// independently -- each of those calls resolved the same getCurrentUser()
// + getProfile() pair on its own, refetching from scratch on every route
// mount (React Router unmounts/remounts ProtectedRoute per navigation) and,
// in StylistDashboard's case, a SECOND time on the very same page load on
// top of ProtectedRoute's own fetch just moments earlier. Same fix shape as
// WorkspaceContext (Phase 9): one Provider wrapping the whole app, fetched
// once per app lifetime and re-resolved only on a real auth-state change,
// not on every component that happens to ask.
//
// useSession() (src/hooks/useSession.ts) is now a thin wrapper over this
// context with the exact same return shape as before, so every existing
// caller (Sidebar, TrialBanner, ProtectedRoute, OnboardingRoute, Onboarding,
// Pricing, BeautyPassport, StylistDashboard) needed zero changes.
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (!mountedRef.current) return;
      setUser(currentUser);

      if (currentUser) {
        const currentProfile = await getProfile(currentUser.id);
        if (mountedRef.current) setProfile(currentProfile);
      } else if (mountedRef.current) {
        setProfile(null);
      }
    } catch {
      // getCurrentUser() throws AuthSessionMissingError when there's no
      // active session -- an expected state for a signed-out visitor, not a
      // real failure. Treat it as "no user" rather than letting it surface
      // as an uncaught rejection. Same handling as the original useSession.
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Same reasoning as WorkspaceProvider: this Provider wraps the whole
    // app and mounts once for its entire lifetime, so a single on-mount
    // refresh() would never see a later sign-in/sign-out/token refresh.
    // Subscribing to onAuthStateChange makes this re-resolve exactly when
    // it actually needs to, not on every component that asks.
    refresh();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, profile, loading, refresh }),
    [user, profile, loading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
