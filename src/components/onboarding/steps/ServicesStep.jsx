import { useEffect, useMemo, useState } from "react";
import { Button, Input, Tag, Skeleton, EmptyState } from "../../ui";
import { getServiceTemplates } from "../../../services/serviceTemplates";

// value: array of { templateId, name, duration, price }
export function ServicesStep({ value, onChange, onNext, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getServiceTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load service templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const t of templates) {
      (byCategory[t.category] ??= []).push(t);
    }
    return byCategory;
  }, [templates]);

  const selectedIds = new Set(value.map((s) => s.templateId));

  function toggleTemplate(template) {
    if (selectedIds.has(template.id)) {
      onChange(value.filter((s) => s.templateId !== template.id));
    } else {
      onChange([
        ...value,
        {
          templateId: template.id,
          // import_service_templates() inserts this exact original name into
          // services — kept so we can match the created row back up even if
          // the user renames it below.
          originalName: template.name,
          name: template.name,
          duration: template.default_duration,
          price: template.default_price,
        },
      ]);
    }
  }

  function updateSelected(templateId, patch) {
    onChange(value.map((s) => (s.templateId === templateId ? { ...s, ...patch } : s)));
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "0 0 6px" }}>
        Set up your services
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 20px" }}>
        Pick a few starter services — you can edit the name, duration, and price for each, and add more later.
      </p>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </div>
      )}

      {!loading && error && (
        <p style={{ fontSize: 13, color: "var(--error-fg)" }}>{error}</p>
      )}

      {!loading && !error && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 14 }}>
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 8px" }}>
                {category}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {rows.map((t) => (
                  <Tag key={t.id} selected={selectedIds.has(t.id)} onClick={() => toggleTemplate(t)}>
                    {t.name}
                  </Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && !loading && !error && (
        <div style={{ marginTop: 16 }}>
          <EmptyState title="No services selected yet" description="Tap any service above to add it — or skip this step and add services later." />
        </div>
      )}

      {value.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
            Selected ({value.length})
          </p>
          {value.map((s) => (
            <div key={s.templateId} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <Input value={s.name} onChange={(e) => updateSelected(s.templateId, { name: e.target.value })} />
              <Input type="number" value={s.duration} onChange={(e) => updateSelected(s.templateId, { duration: Number(e.target.value) })} hint="min" />
              <Input type="number" value={s.price} onChange={(e) => updateSelected(s.templateId, { price: Number(e.target.value) })} hint="SAR" />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="gold" onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
