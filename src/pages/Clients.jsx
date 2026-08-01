import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Trash2, Pencil, BookHeart } from "lucide-react";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getClients, createClient, updateClient, deleteClient } from "../services/clients";
import { Button, Input, Select, Dialog, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const EMPTY_FORM = { full_name: "", phone: "", email: "", tier: "Bronze", internal_notes: "" };

// Postgres foreign-key-violation SQLSTATE -- thrown when deleting a client
// who has appointment/visit history (clients has no archive column, so a
// blocked delete is the schema's real, existing behavior, not a bug to hide).
const FK_VIOLATION = "23503";

export default function Clients() {
  const navigate = useNavigate();
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
        if (!cancelled) setError(err.message || "Couldn't load clients.");
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
      setFormError("Full name is required.");
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
      setFormError(err.message || "Couldn't save this client.");
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
        setDeleteError("This client has appointment or visit history and can't be deleted.");
      } else {
        setDeleteError(err.message || "Couldn't delete this client.");
      }
    } finally {
      setDeleting(false);
    }
  }

  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  return (
    <div className="beautyroute-ds" style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "var(--font-body)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-10) var(--space-6)" }}>
        <Link to="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-md)", color: "var(--text-primary)", margin: 0 }}>Clients</h1>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "4px 0 0" }}>Everyone you've worked with, in one place.</p>
          </div>
          <Button variant="gold" icon={<Plus size={16} />} onClick={openCreate}>New client</Button>
        </div>

        {!failed && (
          <div style={{ marginBottom: 20 }}>
            <Input
              icon={<Search size={15} style={{ color: "var(--text-tertiary)" }} />}
              placeholder="Search by name, phone, or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

        {!failed && isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={56} radius="var(--radius-lg)" />
            <Skeleton height={56} radius="var(--radius-lg)" />
            <Skeleton height={56} radius="var(--radius-lg)" />
          </div>
        )}

        {!failed && !isLoading && filtered.length === 0 && (
          <EmptyState
            title={query ? "No clients match your search" : "No clients yet"}
            description={query ? "Try a different name, phone, or email." : "Add your first client to get started."}
            action={!query && <Button variant="gold" onClick={openCreate}>Add a client</Button>}
          />
        )}

        {!failed && !isLoading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((client) => (
              <div
                key={client.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 20px",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{client.full_name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
                    {[client.phone, client.email].filter(Boolean).join(" · ") || "No contact info on file"} · {client.tier}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button variant="secondary" size="sm" icon={<BookHeart size={13} />} onClick={() => navigate(`/passport?client=${client.id}`)}>Passport</Button>
                  <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(client)}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => { setDeleteTarget(client); setDeleteError(""); }}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? "Edit client" : "New client"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={formError && !form.full_name.trim() ? formError : undefined} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label="Tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} options={TIERS} />
          <Input label="Notes" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} hint="Private -- visible only to your team" />
          {formError && form.full_name.trim() && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete client?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="gold" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {deleteTarget && `This will permanently remove ${deleteTarget.full_name}. This can't be undone.`}
        </p>
        {deleteError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{deleteError}</p>}
      </Dialog>
    </div>
  );
}
