import { Button, Badge } from "../../ui";

const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function ReadyStep({ business, services, availability, onFinish, onBack, saving, error }) {
  const activeDays = Object.entries(availability.days)
    .filter(([, on]) => on)
    .map(([key]) => DAY_LABELS[key]);

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
        You're all set
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 24px" }}>
        Review everything below, then finish to start your 7-day trial.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <SummarySection title="Business">
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--text-primary)" }}>{business.businessName}</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>
            {business.businessType === "salon" ? "Salon / studio" : "Freelancer / mobile professional"} · {business.city}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
            {business.fullName}{business.phone ? ` · ${business.phone}` : ""}
          </p>
        </SummarySection>

        <SummarySection title="Services">
          {services.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>No services selected yet — you can add these anytime.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {services.map((s) => (
                <Badge key={s.templateId} tone="neutral">{s.name} · {s.duration}min · SAR {s.price}</Badge>
              ))}
            </div>
          )}
        </SummarySection>

        <SummarySection title="Availability">
          {activeDays.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>No working days selected yet.</p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)" }}>
              {activeDays.join(", ")} · {availability.startTime}–{availability.endTime}
            </p>
          )}
        </SummarySection>
      </div>

      {error && (
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--error-fg)" }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
        <Button variant="ghost" onClick={onBack} disabled={saving}>Back</Button>
        <Button variant="gold" size="lg" onClick={onFinish} disabled={saving}>
          {saving ? "Setting things up…" : "Go to my dashboard"}
        </Button>
      </div>
    </div>
  );
}

function SummarySection({ title, children }) {
  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 8px" }}>
        {title}
      </p>
      {children}
    </div>
  );
}
