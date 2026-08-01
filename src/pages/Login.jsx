import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { Input, Button, Checkbox } from "../components/ui";
import { signInUser, getCurrentUser } from "../services/auth";
import { getProfile } from "../services/profiles";
import "../styles/beautyroute/styles.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setLoading(true);
    try {
      await signInUser(email, password);
      const user = await getCurrentUser();
      const profile = user ? await getProfile(user.id) : null;
      navigate(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
    } catch (err) {
      setFormError(err.message || "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 28px" }}>
          Sign in to manage your business and showcase your work.
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
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <Checkbox label="Remember me" checked={remember} onChange={setRemember} />
          {formError && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>
          )}
          <Button variant="gold" size="lg" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
        New to BeautyRoute?{" "}
        <Link to="/signup" style={{ color: "var(--accent-gold-strong)" }}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
