import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { Input, Button } from "../components/ui";
import { updatePassword, onAuthStateChange, getSession } from "../services/auth";
import "../styles/beautyroute/styles.css";

const MIN_PASSWORD_LENGTH = 6;

function validate({ password, confirmPassword }) {
  const errors = {};
  if (!password) errors.password = "Password is required.";
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `At least ${MIN_PASSWORD_LENGTH} characters.`;
  if (confirmPassword !== password) errors.confirmPassword = "Passwords don't match.";
  return errors;
}

// A valid reset link establishes a recovery session and fires
// PASSWORD_RECOVERY; an expired/invalid one leaves an #error=... fragment
// in the URL instead and never fires that event. Checking the hash first
// gives an immediate answer for the invalid case without waiting on
// anything async.
function readUrlError() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("error");
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // loading | ready | invalid | done
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (readUrlError()) {
      setPhase("invalid");
      return;
    }

    const { data: subscription } = onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPhase("ready");
    });

    // Fallback in case PASSWORD_RECOVERY already fired before this
    // listener attached -- an existing session at this point still means
    // the link was valid.
    getSession().then((session) => {
      setPhase((prev) => (prev === "loading" ? (session ? "ready" : "invalid") : prev));
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate({ password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setLoading(true);
    try {
      await updatePassword(password);
      setPhase("done");
    } catch (err) {
      setFormError(err.message || "Could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "loading") {
    return (
      <AuthShell>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Checking your reset link…</p>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          This link is invalid or has expired
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Password reset links expire after a short time. Request a new one to continue.
        </p>
        <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
          <Link to="/forgot-password" style={{ color: "var(--accent-gold-strong)" }}>
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (phase === "done") {
    return (
      <AuthShell>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Password updated
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Button variant="gold" size="lg" onClick={() => navigate("/login")}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} noValidate>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Choose a new password
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Enter a new password for your account.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="New password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            hint={fieldErrors.password ? undefined : `At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
          />
          {formError && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>
          )}
          <Button variant="gold" size="lg" type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
