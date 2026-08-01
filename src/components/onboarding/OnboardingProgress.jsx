const ONBOARDING_STEPS = ["Welcome", "Business", "Services", "Availability", "Ready!"];

// Renders: label above, then a row of filled/empty dots joined by lines —
// filled through the current step, empty after it.
export function OnboardingProgress({ step }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <p style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h4)",
        color: "var(--text-primary)",
        margin: "0 0 14px",
      }}>
        {ONBOARDING_STEPS[step]}
      </p>
      <div style={{ display: "flex", alignItems: "center" }}>
        {ONBOARDING_STEPS.map((label, i) => (
          <div key={label} style={{ display: "contents" }}>
            <span
              aria-label={label}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                flexShrink: 0,
                background: i <= step ? "var(--accent-gold)" : "transparent",
                border: i <= step ? "1px solid var(--accent-gold-strong)" : "1px solid var(--border-strong)",
                transition: "background var(--dur-base) var(--ease-standard)",
              }}
            />
            {i < ONBOARDING_STEPS.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 2,
                  background: i < step ? "var(--accent-gold)" : "var(--border-default)",
                  transition: "background var(--dur-base) var(--ease-standard)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
