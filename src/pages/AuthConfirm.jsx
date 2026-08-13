import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { exchangeAuthCode, getSession, verifyAuthOtp } from "../services/auth";
import { isEmailOtpType, isSafeInternalPath } from "../lib/validation";
import "../styles/beautyroute/styles.css";

// Public, unguarded confirmation endpoint for every Supabase email-link flow
// (magic link, password recovery, signup confirmation, invite, email
// change). This route must NOT sit behind ProtectedRoute: ProtectedRoute
// redirects an unauthenticated visitor to /login before any token in the
// URL could ever be consumed, which is exactly the bug this page exists to
// fix (see docs/PROJECT_ROADMAP.md's Phase 14 auth-callback investigation).
//
// Supabase's actual email-template format isn't something this app
// controls or can rely on staying fixed, so this defensively supports every
// currently-documented shape rather than assuming one:
//   (a) ?token_hash=...&type=...   -> supabase.auth.verifyOtp(...)
//   (b) ?code=...                  -> supabase.auth.exchangeCodeForSession(...)
//   (c) neither param present      -> the Supabase client may already have
//       consumed a legacy #access_token=... fragment during its own
//       initialization (detectSessionInUrl, on by default) before this
//       effect ever ran; check for an already-established session instead
//       of assuming the link is invalid.
//
// Deliberately thin: on success this only navigates to `next` (or `/`) and
// lets the existing ProtectedRoute/SessionContext/OnboardingRoute logic
// decide where the user actually belongs -- it does not duplicate any of
// that routing/onboarding/subscription logic itself.
export default function AuthConfirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState("loading"); // loading | invalid
  const ranRef = useRef(false);

  useEffect(() => {
    // A token_hash/code is single-use -- StrictMode's double-invoke (or any
    // other re-render) must never submit it twice, which would consume it
    // on the first, harmless call and then fail the second with a
    // confusing "already used" error.
    if (ranRef.current) return;
    ranRef.current = true;

    async function confirm() {
      const nextParam = searchParams.get("next");
      const next = isSafeInternalPath(nextParam) ? nextParam : "/";

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      try {
        if (tokenHash && isEmailOtpType(type)) {
          await verifyAuthOtp(tokenHash, type);
        } else if (code) {
          await exchangeAuthCode(code);
        } else {
          const session = await getSession();
          if (!session) {
            setPhase("invalid");
            return;
          }
        }
        navigate(next, { replace: true });
      } catch {
        // Never surface the raw Supabase error (it can describe internal
        // state, and its content isn't ours to control) or any part of the
        // token/code itself -- a generic message is enough for the user to
        // act on, and nothing here is ever logged.
        setPhase("invalid");
      }
    }

    confirm();
  }, [searchParams, navigate]);

  if (phase === "invalid") {
    return (
      <AuthShell>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          This link is invalid or has expired
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Links expire after a short time, or can only be used once. Request a new one, or sign in with your password.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: "var(--accent-gold-strong)" }}>
            Request a new link
          </Link>
          <Link to="/login" style={{ fontSize: 13, color: "var(--accent-gold-strong)" }}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Confirming your link…</p>
    </AuthShell>
  );
}
