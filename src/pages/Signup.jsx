import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { Input, Button } from "../components/ui";
import { signUpUser } from "../services/auth";
import "../styles/beautyroute/styles.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validate({ fullName, email, password }) {
  const errors = {};
  if (!fullName.trim()) errors.fullName = "Full name is required.";
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `At least ${MIN_PASSWORD_LENGTH} characters.`;
  return errors;
}

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate({ fullName, email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setFormNotice("");
    setLoading(true);
    try {
      const data = await signUpUser(email, password, { full_name: fullName });
      if (data?.session) {
        navigate("/onboarding");
      } else if (data?.user?.identities?.length === 0) {
        // Supabase's anti-enumeration response: this email is already
        // registered. No account was created and no email was sent, even
        // though the call itself didn't error.
        setFormError("An account with this email already exists. Try signing in instead.");
      } else {
        // Email confirmation is required before a session is issued.
        setFormNotice("Account created — check your email to confirm before signing in.");
      }
    } catch (err) {
      setFormError(err.message || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Create your professional account
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Manage your business and showcase your work.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Full name"
            placeholder="Sara Al-Otaibi"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            hint={fieldErrors.password ? undefined : `At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          {formError && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>
          )}
          {formNotice && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--success-fg)" }}>{formNotice}</p>
          )}
          <Button variant="gold" size="lg" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </div>
      </form>
      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--accent-gold-strong)" }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
