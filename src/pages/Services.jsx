import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getServices, createService, updateService, deleteService, importServiceTemplates } from "../services/services";
import { getServiceTemplates } from "../services/serviceTemplates";
import { Button, Input, Select, Switch, Tag, Dialog, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import { useAppLang } from "../hooks/useAppLang";
import { t, translateEnum } from "../lib/i18n";
import "../styles/beautyroute/styles.css";

const CATEGORIES = ["consultation", "haircut", "styling", "color", "treatment", "extensions", "bridal", "specialty"];
const EMPTY_FORM = { name: "", category: "haircut", duration_minutes: "45", price: "0" };
const FK_VIOLATION = "23503";

export default function Services() {
  const { lang } = useAppLang();
  const { workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (workspaceLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      if (!workspaceId) {
        if (!cancelled) {
          setServices([]);
          setLoading(false);
        }
        return;
      }
      try {
        const rows = await getServices(workspaceId);
        if (!cancelled) setServices(rows ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message || t("services.errorFallback", lang));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // `lang` is deliberately excluded -- see Appointments.jsx's identical
    // comment for why (fallback error-message translation only, not worth
    // an extra fetch on a language switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaceLoading, reloadToken]);

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const s of services) (byCategory[s.category] ??= []).push(s);
    return byCategory;
  }, [services]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      category: service.category,
      duration_minutes: String(service.duration_minutes),
      price: String(service.price),
    });
    setFormError("");
    setFormOpen(true);
  }

  function validateForm() {
    if (!form.name.trim()) return t("services.validation.name", lang);
    const duration = Number(form.duration_minutes);
    if (!Number.isFinite(duration) || duration <= 0) return t("services.validation.duration", lang);
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return t("services.validation.price", lang);
    return "";
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        duration_minutes: Number(form.duration_minutes),
        price: Number(form.price),
      };
      if (editingId) {
        const updated = await updateService(editingId, payload);
        setServices((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const created = await createService({ ...payload, workspace_id: workspaceId });
        setServices((prev) => [...prev, created]);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err.message || t("services.saveErrorFallback", lang));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service) {
    const updated = await updateService(service.id, { is_active: !service.is_active }).catch((err) => {
      setError(err.message || t("services.updateErrorFallback", lang));
      return null;
    });
    if (updated) setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      if (err.code === FK_VIOLATION) {
        setDeleteError(t("services.deleteBlocked", lang));
      } else {
        setDeleteError(err.message || t("services.deleteErrorFallback", lang));
      }
    } finally {
      setDeleting(false);
    }
  }

  async function openImport() {
    setImportOpen(true);
    setSelectedTemplateIds([]);
    setTemplatesError("");
    setTemplatesLoading(true);
    try {
      const rows = await getServiceTemplates();
      const existingNames = new Set(services.map((s) => s.name));
      setTemplates((rows ?? []).filter((tpl) => !existingNames.has(tpl.name)));
    } catch (err) {
      setTemplatesError(err.message || t("services.templatesErrorFallback", lang));
    } finally {
      setTemplatesLoading(false);
    }
  }

  function toggleTemplate(id) {
    setSelectedTemplateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleImport() {
    if (selectedTemplateIds.length === 0) return;
    setImporting(true);
    try {
      await importServiceTemplates(workspaceId, selectedTemplateIds);
      const rows = await getServices(workspaceId);
      setServices(rows ?? []);
      setImportOpen(false);
    } catch (err) {
      setTemplatesError(err.message || t("services.importErrorFallback", lang));
    } finally {
      setImporting(false);
    }
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <Layout
      title={t("services.title", lang)}
      subtitle={isLoading ? t("services.subtitleLoading", lang) : t("services.subtitle", lang, { count: services.length })}
      headerActions={
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={openImport}>{t("services.importTemplates", lang)}</Button>
          <Button variant="gold" icon={<Plus size={16} />} onClick={openCreate}>{t("services.newService", lang)}</Button>
        </div>
      }
    >
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
          <Skeleton height={56} radius="var(--radius-lg)" />
          <Skeleton height={56} radius="var(--radius-lg)" />
        </div>
      )}

      {!failed && !isLoading && services.length === 0 && (
        <EmptyState
          title={t("services.emptyTitle", lang)}
          description={t("services.emptyDescription", lang)}
          action={<Button variant="gold" onClick={openImport}>{t("services.importTemplates", lang)}</Button>}
        />
      )}

      {/* Composition pass: same fix as Clients -- a service row used to
          stretch across the full page width with justify-content:space-
          between, which read as an unnecessarily wide, sparse bar whenever
          a category had few items. Capping the grouped list at a narrower
          content width keeps it dense regardless of category size. */}
      {!failed && !isLoading && services.length > 0 && (
        <div style={{ maxWidth: 760 }}>
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 8px" }}>
                {translateEnum("category", category, lang)}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((service) => (
                  <div
                    key={service.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 16px",
                      background: "var(--surface-card)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-lg)",
                      opacity: service.is_active ? 1 : 0.55,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
                        {t("services.durationPrice", lang, { duration: service.duration_minutes, price: service.price })}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <Switch checked={service.is_active} onChange={() => toggleActive(service)} label={t("services.active", lang)} />
                      <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(service)}>{t("action.edit", lang)}</Button>
                      <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => { setDeleteTarget(service); setDeleteError(""); }}>{t("action.delete", lang)}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? t("services.editService", lang) : t("services.newServiceTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? t("action.saving", lang) : t("action.save", lang)}</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label={t("services.serviceName", lang)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select
            label={t("services.category", lang)}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={CATEGORIES.map((cat) => ({ value: cat, label: translateEnum("category", cat, lang) }))}
          />
          <Input label={t("services.durationMinutes", lang)} type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          <Input label={t("services.priceSAR", lang)} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          {formError && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("services.deleteTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleDelete} disabled={deleting}>{deleting ? t("action.deleting", lang) : t("action.delete", lang)}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {deleteTarget && t("services.deleteBody", lang, { name: deleteTarget.name })}
        </p>
        {deleteError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{deleteError}</p>}
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => !importing && setImportOpen(false)}
        title={t("services.importTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importing}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleImport} disabled={importing || selectedTemplateIds.length === 0}>
              {importing ? t("services.importing", lang) : t("services.import", lang, { count: selectedTemplateIds.length || "" })}
            </Button>
          </>
        }
      >
        {templatesLoading && <Skeleton height={120} />}
        {!templatesLoading && templatesError && <p style={{ fontSize: 13, color: "var(--error-fg)" }}>{templatesError}</p>}
        {!templatesLoading && !templatesError && templates.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>{t("services.allTemplatesAdded", lang)}</p>
        )}
        {!templatesLoading && !templatesError && templates.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {templates.map((tpl) => (
              <Tag key={tpl.id} selected={selectedTemplateIds.includes(tpl.id)} onClick={() => toggleTemplate(tpl.id)}>
                {tpl.name}
              </Tag>
            ))}
          </div>
        )}
      </Dialog>
    </Layout>
  );
}
