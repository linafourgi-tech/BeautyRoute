import { Button, Checkbox, Input } from "../../ui";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

// value: { days: { mon: bool, ... }, startTime: "09:00", endTime: "18:00" }
export function AvailabilityStep({ value, onChange, onNext, onBack }) {
  function toggleDay(key) {
    onChange({ ...value, days: { ...value.days, [key]: !value.days[key] } });
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
        When are you available?
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 24px" }}>
        Clients will only be able to book within these hours — you can fine-tune this later.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {DAYS.map((d) => (
          <Checkbox key={d.key} label={d.label} checked={value.days[d.key]} onChange={() => toggleDay(d.key)} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Input
          label="Start time"
          type="time"
          value={value.startTime}
          onChange={(e) => onChange({ ...value, startTime: e.target.value })}
        />
        <Input
          label="End time"
          type="time"
          value={value.endTime}
          onChange={(e) => onChange({ ...value, endTime: e.target.value })}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="gold" onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
