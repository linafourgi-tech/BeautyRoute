import { useState } from "react";
import { Input, Button } from "../../ui";

const TYPES = [
  { value: "freelancer", label: "Freelancer / mobile professional" },
  { value: "salon", label: "Salon / studio" },
];

export function BusinessStep({ value, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({});

  function set(patch) {
    onChange({ ...value, ...patch });
  }

  function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview-only for now — no Storage bucket/upload pipeline exists yet.
    // avatarPreviewUrl is local (object URL) and never sent to Supabase.
    set({ avatarFile: file, avatarPreviewUrl: URL.createObjectURL(file) });
  }

  function validate() {
    const errs = {};
    if (!value.fullName.trim()) errs.fullName = "Full name is required.";
    if (!value.businessName.trim()) errs.businessName = "Business name is required.";
    if (!value.city.trim()) errs.city = "City is required.";
    return errs;
  }

  function handleNext() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) onNext();
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
        Tell us about your business
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 24px" }}>
        This is what clients and your team will see.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => set({ businessType: t.value })}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border-default)",
              background: value.businessType === t.value ? "var(--charcoal-900)" : "transparent",
              color: value.businessType === t.value ? "var(--ivory-100)" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <label style={{ cursor: "pointer" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: value.avatarPreviewUrl ? `url(${value.avatarPreviewUrl}) center/cover` : "var(--bg-sunken)",
              border: "1px dashed var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            {!value.avatarPreviewUrl && "Add photo"}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: "none" }} />
        </label>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, maxWidth: 260 }}>
          Optional for now — you can add a profile photo here whenever you're ready.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Full name" placeholder="Sara Al-Otaibi" value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} error={errors.fullName} />
        <Input label="Business name" placeholder="Sara's Beauty Studio" value={value.businessName} onChange={(e) => set({ businessName: e.target.value })} error={errors.businessName} />
        <Input label="Phone number" placeholder="+966 5X XXX XXXX" value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
        <Input label="City" placeholder="Riyadh" value={value.city} onChange={(e) => set({ city: e.target.value })} error={errors.city} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="gold" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );
}
