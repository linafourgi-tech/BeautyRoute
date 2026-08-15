import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Pencil, BookHeart } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getClients, createClient, updateClient, deleteClient } from "../services/clients";
import { Button, Input, Select, Dialog, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import { useAppLang } from "../hooks/useAppLang";
import { t, translateEnum } from "../lib/i18n";
import "../styles/beautyroute/styles.css";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const EMPTY_FORM = { full_name: "", phone: "", email: "", tier: "Bronze", internal_notes: "" };

function initials(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Postgres foreign-key-violation SQLSTATE -- thrown when deleting a client
// who has appointment/visit history (clients has no archive column, so a
// blocked delete is the schema's real, existing behavior, not a bug to hide).
const FK_VIOLATION = "23503";

export default function Clients() {
  const navigate = useNavigate();
  const { lang } = useAppLang();
  const { workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (workspaceLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      if (!workspaceId) {
        if (!cancelled) {
          setClients([]);
          setLoading(false);
        }
        return;
      }
      try {
        const rows = await getClients(workspaceId);
        if (!cancelled) setClients(rows ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message || t("clients.errorFallback", lang));
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, query]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(client) {
    setEditingId(client.id);
    setForm({
      full_name: client.full_name || "",
      phone: client.phone || "",
      email: client.email || "",
      tier: client.tier || "Bronze",
      internal_notes: client.internal_notes || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      setFormError(t("clients.validation.fullName", lang));
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tier: form.tier,
        internal_notes: form.internal_notes.trim() || null,
      };
      if (editingId) {
        const updated = await updateClient(editingId, payload);
        setClients((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await createClient({ ...payload, workspace_id: workspaceId });
        setClients((prev) => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err.message || t("clients.saveErrorFallback", lang));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      if (err.code === FK_VIOLATION) {
        setDeleteError(t("clients.deleteBlocked", lang));
      } else {
        setDeleteError(err.message || t("clients.deleteErrorFallback", lang));
      }
    } finally {
      setDeleting(false);
    }
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <Layout
      title={t("clients.title", lang)}
      subtitle={isLoading ? t("clients.subtitleLoading", lang) : t("clients.subtitle", lang, { count: clients.length })}
      headerActions={
        // Composition pass: search now sits in the header row next to the
        // primary action (matching StylistDashboard's pattern) instead of
        // its own full-width block below the header -- that extra block
        // was exactly the kind of unnecessary vertical space that made
        // this page feel like a separate, standalone CRUD screen rather
        // than an operational section of the same product.
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!failed && (
            <div style={{ width: 220 }}>
              <Input
                icon={<Search size={15} style={{ color: "var(--text-tertiary)" }} />}
                placeholder={t("clients.searchPlaceholder", lang)}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <Button variant="gold" icon={<Plus size={16} />} onClick={openCreate}>{t("clients.newClient", lang)}</Button>
        </div>
      }
    >
      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
          <Skeleton height={56} radius="var(--radius-lg)" />
          <Skeleton height={56} radius="var(--radius-lg)" />
          <Skeleton height={56} radius="var(--radius-lg)" />
        </div>
      )}

      {!failed && !isLoading && filtered.length === 0 && (
        <EmptyState
          title={query ? t("clients.emptySearchTitle", lang) : t("clients.emptyTitle", lang)}
          description={query ? t("clients.emptySearchDescription", lang) : t("clients.emptyDescription", lang)}
          action={!query && <Button variant="gold" onClick={openCreate}>{t("clients.addClient", lang)}</Button>}
        />
      )}

      {/* Composition pass: a client row used to stretch across the full
          max-w-6xl (1152px) content column with justify-content:space-between
          -- with few clients that read as one very wide, sparse bar (name on
          the far left, actions stranded far to the right) rather than a
          dense list. Capping the list itself at a narrower content width
          (matching the reference's list patterns, which never run list rows
          edge-to-edge across the full dashboard width) and adding an
          initials avatar to give the left side real visual weight fixes
          both complaints without touching any client data or behavior. */}
      {!failed && !isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
          {filtered.map((client) => (
            <div
              key={client.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                background: "var(--surface-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-pill)",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  color: "var(--accent-gold-strong)",
                }}
              >
                {initials(client.full_name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.full_name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[client.phone, client.email].filter(Boolean).join(" · ") || t("clients.noContactInfo", lang)} · {translateEnum("tier", client.tier, lang)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Button variant="secondary" size="sm" icon={<BookHeart size={13} />} onClick={() => navigate(`/passport?client=${client.id}`)}>{t("clients.passport", lang)}</Button>
                <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(client)}>{t("action.edit", lang)}</Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => { setDeleteTarget(client); setDeleteError(""); }}>{t("action.delete", lang)}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? t("clients.editClient", lang) : t("clients.newClientTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? t("action.saving", lang) : t("action.save", lang)}</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label={t("clients.fullName", lang)} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={formError && !form.full_name.trim() ? formError : undefined} />
          <Input label={t("clients.phone", lang)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t("clients.email", lang)} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select
            label={t("clients.tier", lang)}
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            options={TIERS.map((tier) => ({ value: tier, label: translateEnum("tier", tier, lang) }))}
          />
          <Input label={t("clients.notes", lang)} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} hint={t("clients.notesHint", lang)} />
          {formError && form.full_name.trim() && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("clients.deleteTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleDelete} disabled={deleting}>{deleting ? t("action.deleting", lang) : t("action.delete", lang)}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {deleteTarget && t("clients.deleteBody", lang, { name: deleteTarget.full_name })}
        </p>
        {deleteError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{deleteError}</p>}
      </Dialog>
    </Layout>
  );
}
