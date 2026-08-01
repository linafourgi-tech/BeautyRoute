// Centered wizard shell, visually consistent with AuthShell (same tokens,
// same warm background) but a single wide column instead of a split screen —
// the Services/Availability steps need more room than a login form does.
export function OnboardingShell({ children }) {
  return (
    <div
      className="beautyroute-ds"
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        justifyContent: "center",
        padding: "var(--space-16) var(--space-6)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-primary)", marginBottom: 32, textAlign: "center" }}>
          Beauty<span style={{ color: "var(--accent-gold)" }}>Route</span>
        </div>
        <div
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-lg)",
            padding: "var(--space-10)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
