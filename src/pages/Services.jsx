import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getServices, createService, updateService, deleteService, importServiceTemplates } from "../services/services";
import { getServiceTemplates } from "../services/serviceTemplates";
import { Button, Input, Select, Switch, Tag, Dialog, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

const CATEGORIES = ["consultation", "haircut", "styling", "color", "treatment", "extensions", "bridal", "specialty"];
const EMPTY_FORM = { name: "", category: "haircut", duration_minutes: "45", price: "0" };
const FK_VIOLATION = "23503";

export default function Services() {
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
        if (!cancelled) setError(err.message || "Couldn't load services.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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
    if (!form.name.trim()) return "Service name is required.";
    const duration = Number(form.duration_minutes);
    if (!Number.isFinite(duration) || duration <= 0) return "Duration must be a positive number of minutes.";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return "Price can't be negative.";
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
      setFormError(err.message || "Couldn't save this service.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service) {
    const updated = await updateService(service.id, { is_active: !service.is_active }).catch((err) => {
      setError(err.message || "Couldn't update this service.");
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
        setDeleteError("This service has been booked before and can't be deleted -- try disabling it instead.");
      } else {
        setDeleteError(err.message || "Couldn't delete this service.");
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
      setTemplates((rows ?? []).filter((t) => !existingNames.has(t.name)));
    } catch (err) {
      setTemplatesError(err.message || "Couldn't load service templates.");
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
      setTemplatesError(err.message || "Couldn't import those templates.");
    } finally {
      setImporting(false);
    }
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <Layout
      title="Services"
      titleAr="الخدمات"
      subtitle="What you offer, and what it costs."
      headerActions={
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={openImport}>Import templates</Button>
          <Button variant="gold" icon={<Plus size={16} />} onClick={openCreate}>New service</Button>
        </div>
      }
    >
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={56} radius="var(--radius-lg)" />
          <Skeleton height={56} radius="var(--radius-lg)" />
        </div>
      )}

      {!failed && !isLoading && services.length === 0 && (
        <EmptyState
          title="No services yet"
          description="Create your own, or import from the starter catalog to get going fast."
          action={<Button variant="gold" onClick={openImport}>Import templates</Button>}
        />
      )}

      {!failed && !isLoading && services.length > 0 &&
        Object.entries(grouped).map(([category, rows]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)", margin: "0 0 10px" }}>
              {category}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((service) => (
                <div
                  key={service.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    padding: "14px 20px",
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    opacity: service.is_active ? 1 : 0.55,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{service.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
                      {service.duration_minutes} min · SAR {service.price}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <Switch checked={service.is_active} onChange={() => toggleActive(service)} label="Active" />
                    <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(service)}>Edit</Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => { setDeleteTarget(service); setDeleteError(""); }}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? "Edit service" : "New service"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORIES} />
          <Input label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          <Input label="Price (SAR)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          {formError && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete service?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="gold" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {deleteTarget && `This will permanently remove "${deleteTarget.name}". This can't be undone.`}
        </p>
        {deleteError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{deleteError}</p>}
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => !importing && setImportOpen(false)}
        title="Import service templates"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</Button>
            <Button variant="gold" onClick={handleImport} disabled={importing || selectedTemplateIds.length === 0}>
              {importing ? "Importing…" : `Import ${selectedTemplateIds.length || ""}`.trim()}
            </Button>
          </>
        }
      >
        {templatesLoading && <Skeleton height={120} />}
        {!templatesLoading && templatesError && <p style={{ fontSize: 13, color: "var(--error-fg)" }}>{templatesError}</p>}
        {!templatesLoading && !templatesError && templates.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)" }}>You've already added every starter template.</p>
        )}
        {!templatesLoading && !templatesError && templates.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {templates.map((t) => (
              <Tag key={t.id} selected={selectedTemplateIds.includes(t.id)} onClick={() => toggleTemplate(t.id)}>
                {t.name}
              </Tag>
            ))}
          </div>
        )}
      </Dialog>
    </Layout>
  );
}
