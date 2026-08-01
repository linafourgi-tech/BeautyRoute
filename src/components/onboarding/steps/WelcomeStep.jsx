import { Button } from "../../ui";

export function WelcomeStep({ onNext }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-md)", color: "var(--text-primary)", margin: "0 0 12px" }}>
        Welcome to BeautyRoute
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-tertiary)", margin: "0 0 32px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
        Let's set up your beauty business in under 2 minutes.
      </p>
      <Button variant="gold" size="lg" onClick={onNext}>
        Get started
      </Button>
    </div>
  );
}
