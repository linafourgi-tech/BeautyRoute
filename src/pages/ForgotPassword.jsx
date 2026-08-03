import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { Input, Button } from "../components/ui";
import { requestPasswordReset } from "../services/auth";
import "../styles/beautyroute/styles.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email }) {
  const errors = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate({ email });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      // Same confirmation whether or not this email has an account on
      // file -- never reveal account existence through this flow either.
      setSubmitted(true);
    } catch (err) {
      setFormError(err.message || "Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthShell>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Check your email
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          If an account exists for that email, we've sent a link to reset your password.
        </p>
        <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
          <Link to="/login" style={{ color: "var(--accent-gold-strong)" }}>
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} noValidate>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Enter your email and we'll send you a link to reset your password.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          {formError && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>
          )}
          <Button variant="gold" size="lg" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </div>
      </form>
      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
        Remembered your password?{" "}
        <Link to="/login" style={{ color: "var(--accent-gold-strong)" }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
