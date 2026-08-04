import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Phone, Mail, Plus, X, ChevronDown, ChevronUp, Image as ImageIcon, Sparkles, Copy, Check } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useSession } from "../hooks/useSession";
import { useSubscription } from "../hooks/useSubscription";
import { hasFeature } from "../services/subscription";
import { getClients } from "../services/clients";
import { getAppointmentsByClient } from "../services/appointments";
import { getClientVisitHistory, createVisitLog, updateVisitLog } from "../services/visits";
import { getFilesForEntity, createFile } from "../services/files";
import { generateClientSummary, generateNextVisitRecommendation, generateAftercareInstructions, AiUnavailableError } from "../services/ai";

function initials(name) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function emptyVisitForm() {
  return {
    visit_date: new Date().toISOString().slice(0, 10),
    appointment_id: "",
    summary_notes: "",
    products_used: "",
    formula_mix: "",
    recommendation: "",
    before_photo_url: "",
    after_photo_url: "",
  };
}

export default function BeautyPassport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceId, loading: workspaceLoading } = useCurrentWorkspace();
  const { user } = useSession();
  const { subscription } = useSubscription(workspaceId);
  const aiEnabled = hasFeature(subscription, "ai");

  const [aiPanel, setAiPanel] = useState(null); // { kind, title, warn, loading, error, text } | null

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState(null);
  const [query, setQuery] = useState("");

  const selectedId = searchParams.get("client");
  const client = clients.find((c) => c.id === selectedId) ?? null;

  const [appointments, setAppointments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const [visitFiles, setVisitFiles] = useState({}); // visitId -> files[]

  const [formOpen, setFormOpen] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [form, setForm] = useState(emptyVisitForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspaceLoading) return;
    let cancelled = false;

    async function load() {
      setClientsLoading(true);
      setClientsError(null);
      if (!workspaceId) {
        if (!cancelled) {
          setClients([]);
          setClientsLoading(false);
        }
        return;
      }
      try {
        const rows = await getClients(workspaceId);
        if (!cancelled) {
          setClients(rows ?? []);
          if (!selectedId && rows?.[0]) {
            setSearchParams({ client: rows[0].id }, { replace: true });
          }
        }
      } catch (err) {
        if (!cancelled) setClientsError(err.message || "Couldn't load clients.");
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaceLoading]);

  useEffect(() => {
    if (!client) {
      setAppointments([]);
      setVisits([]);
      return;
    }
    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [apptRows, visitRows] = await Promise.all([
          getAppointmentsByClient(client.id),
          getClientVisitHistory(client.id),
        ]);
        if (cancelled) return;
        setAppointments(apptRows ?? []);
        setVisits(visitRows ?? []);
      } catch (err) {
        if (!cancelled) setDetailError(err.message || "Couldn't load this passport.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [client, reloadToken]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.full_name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q));
  }, [clients, query]);

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  async function toggleVisit(visit) {
    if (expandedVisitId === visit.id) {
      setExpandedVisitId(null);
      return;
    }
    setExpandedVisitId(visit.id);
    if (!visitFiles[visit.id]) {
      try {
        const files = await getFilesForEntity("visit", visit.id);
        setVisitFiles((prev) => ({ ...prev, [visit.id]: files ?? [] }));
      } catch {
        setVisitFiles((prev) => ({ ...prev, [visit.id]: [] }));
      }
    }
  }

  function openLogVisit() {
    setEditingVisitId(null);
    setForm(emptyVisitForm());
    setFormError("");
    setFormOpen(true);
  }

  function openEditVisit(visit) {
    setEditingVisitId(visit.id);
    setForm({
      visit_date: visit.visit_date,
      appointment_id: visit.appointment_id || "",
      summary_notes: visit.summary_notes || "",
      products_used: (visit.products_used || []).join(", "),
      formula_mix: visit.formula_data?.mix || "",
      recommendation: visit.formula_data?.recommendation || "",
      before_photo_url: "",
      after_photo_url: "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSaveVisit(e) {
    e.preventDefault();
    if (!form.visit_date) {
      setFormError("Pick a visit date.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        client_id: client.id,
        appointment_id: form.appointment_id || null,
        staff_id: user?.id || null,
        visit_date: form.visit_date,
        summary_notes: form.summary_notes.trim() || null,
        products_used: form.products_used.trim() ? form.products_used.split(",").map((p) => p.trim()).filter(Boolean) : null,
        formula_data: { mix: form.formula_mix.trim(), recommendation: form.recommendation.trim() },
      };

      let visitId = editingVisitId;
      if (editingVisitId) {
        await updateVisitLog(editingVisitId, payload);
      } else {
        const created = await createVisitLog(payload);
        visitId = created.id;
      }

      if (form.before_photo_url.trim()) {
        await createFile({ workspace_id: workspaceId, entity_type: "visit", entity_id: visitId, file_url: form.before_photo_url.trim(), file_type: "image", file_purpose: "before" });
      }
      if (form.after_photo_url.trim()) {
        await createFile({ workspace_id: workspaceId, entity_type: "visit", entity_id: visitId, file_url: form.after_photo_url.trim(), file_type: "image", file_purpose: "after" });
      }

      setVisitFiles((prev) => {
        const next = { ...prev };
        delete next[visitId];
        return next;
      });
      setFormOpen(false);
      refresh();
    } catch (err) {
      setFormError(err.message || "Couldn't save this visit.");
    } finally {
      setSaving(false);
    }
  }

  async function runAiAction(kind, title, warn, action) {
    setAiPanel({ kind, title, warn, loading: true, error: null, text: "" });
    try {
      const { text } = await action();
      setAiPanel({ kind, title, warn, loading: false, error: null, text });
    } catch (err) {
      const message = err instanceof AiUnavailableError ? err.message : "Something went wrong. Please try again.";
      setAiPanel({ kind, title, warn, loading: false, error: message, text: "" });
    }
  }

  function openAiSummary() {
    runAiAction("summary", "Client summary", false, () => generateClientSummary(workspaceId, client.id));
  }

  function openAiNextVisit() {
    runAiAction("next_visit", "Next visit suggestion", false, () => generateNextVisitRecommendation(workspaceId, client.id));
  }

  function openAiAftercare(visit) {
    runAiAction("aftercare", "Aftercare instructions", true, () => generateAftercareInstructions(workspaceId, visit.id));
  }

  function visitDuration(visit) {
    const appt = visit.appointments;
    if (!appt?.start_time || !appt?.end_time) return null;
    const minutes = Math.round((new Date(appt.end_time) - new Date(appt.start_time)) / 60000);
    return `${minutes} min`;
  }

  function visitServices(visit) {
    return (visit.appointments?.appointment_services ?? [])
      .map((link) => link.services?.name)
      .filter(Boolean);
  }

  const isLoading = workspaceLoading || clientsLoading;

  return (
    <Layout
      title="Beauty Passport"
      titleAr="جواز الجمال"
      subtitle="Every client's story, remembered — a chronological record of formulas, looks, and notes."
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Client list */}
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-full bg-surface border border-line rounded-full px-4 py-2.5 text-sm text-ivory placeholder:text-muted outline-none focus:border-wine mb-3"
          />

          {clientsError && <p className="text-xs text-danger">{clientsError}</p>}
          {isLoading && <p className="text-xs text-muted">Loading clients…</p>}
          {!isLoading && !clientsError && filteredClients.length === 0 && (
            <p className="text-xs text-muted">No clients yet — add one from the Clients page.</p>
          )}

          <div className="space-y-2.5">
            {!isLoading && filteredClients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSearchParams({ client: c.id })}
                className={`w-full flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  selectedId === c.id ? "border-wine bg-surface" : "border-line bg-surface/60 hover:border-muted"
                }`}
              >
                <div className="h-11 w-11 rounded-full bg-surface-2 border border-line flex items-center justify-center font-display text-wine text-sm shrink-0">
                  {initials(c.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-ivory text-sm font-medium truncate">{c.full_name}</p>
                  <p className="text-muted text-xs truncate mt-0.5">
                    {c.last_visit_at ? `Last visit ${c.last_visit_at.slice(0, 10)}` : "No visits yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Storybook */}
        {client && (
          <div className="space-y-8">
            {/* Cover */}
            <div className="rounded-3xl border border-line bg-surface p-8 md:p-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                <div className="h-20 w-20 rounded-full bg-surface-2 border-4 border-surface-2 flex items-center justify-center font-display text-2xl text-wine shrink-0">
                  {initials(client.full_name)}
                </div>
                <div className="flex-1">
                  <p className="font-mono-tag text-[11px] uppercase tracking-[0.16em] text-gold">Beauty Passport</p>
                  <h2 className="font-display text-3xl text-ivory mt-1">{client.full_name}</h2>
                  <p className="text-muted text-sm mt-1">
                    Client since {new Date(client.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long" })}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-wide bg-surface-2 text-wine px-3 py-1.5 rounded-full font-medium self-start sm:self-center">
                  {client.tier}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <InfoCard icon={Phone} label="Phone" value={client.phone || "Not on file"} />
                <InfoCard icon={Mail} label="Email" value={client.email || "Not on file"} />
                <InfoCard
                  icon={AlertTriangle}
                  label="Allergies"
                  value={client.allergies?.length ? client.allergies.join(", ") : "None on file"}
                  warn={client.allergies?.length > 0}
                />
                <InfoCard icon={ImageIcon} label="Notes" value={client.internal_notes || "No internal notes"} />
              </div>

              {aiEnabled && (
                <div className="flex flex-wrap gap-2.5 mt-6 pt-6 border-t border-line">
                  <button
                    onClick={openAiSummary}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-xs border border-gold text-gold hover:bg-gold hover:text-onaccent transition-colors"
                  >
                    <Sparkles size={13} /> Generate summary
                  </button>
                  <button
                    onClick={openAiNextVisit}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-xs border border-gold text-gold hover:bg-gold hover:text-onaccent transition-colors"
                  >
                    <Sparkles size={13} /> Suggest next visit
                  </button>
                </div>
              )}
            </div>

            {detailError && <p className="text-sm text-danger">{detailError}</p>}

            {/* Appointment history */}
            <div>
              <h3 className="font-display text-xl text-ivory mb-4">Appointment history</h3>
              {detailLoading && <p className="text-muted text-sm">Loading…</p>}
              {!detailLoading && appointments.length === 0 && (
                <p className="text-muted text-sm">No appointments booked yet.</p>
              )}
              {!detailLoading && appointments.length > 0 && (
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                      <span className="text-ivory">
                        {new Date(a.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-muted">
                        {(a.appointment_services ?? []).map((l) => l.services?.name).filter(Boolean).join(", ") || "No services on file"}
                      </span>
                      <span className="text-muted uppercase text-[11px] tracking-wide">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visit timeline */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-2xl text-ivory">Her story so far</h3>
                <button
                  onClick={openLogVisit}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-gold text-gold hover:bg-gold hover:text-onaccent transition-colors"
                >
                  <Plus size={15} /> Log a visit
                </button>
              </div>

              {detailLoading && <p className="text-muted text-sm">Loading…</p>}
              {!detailLoading && visits.length === 0 && (
                <p className="text-muted text-sm">No visits logged yet — log the first one above.</p>
              )}

              <div className="space-y-4">
                {visits.map((v) => {
                  const expanded = expandedVisitId === v.id;
                  const services = visitServices(v);
                  const duration = visitDuration(v);
                  const files = visitFiles[v.id] ?? [];
                  const before = files.find((f) => f.file_purpose === "before");
                  const after = files.find((f) => f.file_purpose === "after");

                  return (
                    <div key={v.id} className="rounded-2xl border border-line bg-surface overflow-hidden">
                      <button onClick={() => toggleVisit(v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
                        <div>
                          <p className="font-display text-lg text-ivory">{new Date(v.visit_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p className="text-muted text-xs mt-0.5">
                            {services.length > 0 ? services.join(", ") : "No linked services"}
                            {duration ? ` · ${duration}` : ""}
                            {v.staff_id === user?.id ? " · You" : ""}
                          </p>
                        </div>
                        {expanded ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                      </button>

                      {expanded && (
                        <div className="px-6 pb-6 space-y-4 border-t border-line pt-4">
                          <Field label="Services">
                            <p className="text-ivory text-sm">{services.length > 0 ? services.join(", ") : "—"}</p>
                          </Field>
                          <Field label="Notes">
                            <p className="text-ivory/80 text-sm leading-relaxed">{v.summary_notes || "No notes on file."}</p>
                          </Field>
                          <Field label="Photos">
                            {before || after ? (
                              <div className="flex gap-3">
                                {before && <img src={before.file_url} alt="Before" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-lg object-cover border border-line" />}
                                {after && <img src={after.file_url} alt="After" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-lg object-cover border border-line" />}
                              </div>
                            ) : (
                              <p className="text-muted text-xs">No photos on file.</p>
                            )}
                          </Field>
                          <Field label="Formula">
                            <p className="text-ivory text-sm">{v.formula_data?.mix || "—"}</p>
                          </Field>
                          <Field label="Next recommendation">
                            <p className="text-ivory text-sm">{v.formula_data?.recommendation || "—"}</p>
                          </Field>
                          {(v.products_used ?? []).length > 0 && (
                            <Field label="Products used">
                              <p className="text-ivory text-sm">{v.products_used.join(", ")}</p>
                            </Field>
                          )}
                          <div className="flex items-center gap-4">
                            <button onClick={() => openEditVisit(v)} className="text-xs text-gold hover:underline">
                              Edit this visit
                            </button>
                            {aiEnabled && services.length > 0 && (
                              <button onClick={() => openAiAftercare(v)} className="flex items-center gap-1.5 text-xs text-gold hover:underline">
                                <Sparkles size={12} /> Generate aftercare
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setFormOpen(false)}>
          <form onSubmit={handleSaveVisit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-ivory">{editingVisitId ? "Edit visit" : "Log a visit"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="text-muted hover:text-ivory">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Visit date">
                <input
                  type="date"
                  value={form.visit_date}
                  onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              <Field label="Linked appointment (optional -- determines services shown & duration)">
                <select
                  value={form.appointment_id}
                  onChange={(e) => setForm({ ...form, appointment_id: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                >
                  <option value="">No linked appointment</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" — "}
                      {(a.appointment_services ?? []).map((l) => l.services?.name).filter(Boolean).join(", ") || "no services"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.summary_notes}
                  onChange={(e) => setForm({ ...form, summary_notes: e.target.value })}
                  rows={3}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine resize-none"
                />
              </Field>

              <Field label="Products used (comma separated)">
                <input
                  value={form.products_used}
                  onChange={(e) => setForm({ ...form, products_used: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              <Field label="Formula">
                <input
                  value={form.formula_mix}
                  onChange={(e) => setForm({ ...form, formula_mix: e.target.value })}
                  placeholder="e.g. 7.3 + 20vol, 30min"
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              <Field label="Next recommendation">
                <input
                  value={form.recommendation}
                  onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                  placeholder="e.g. Gloss refresh in 6 weeks"
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              <Field label="Before photo URL (optional)">
                <input
                  value={form.before_photo_url}
                  onChange={(e) => setForm({ ...form, before_photo_url: e.target.value })}
                  placeholder="https://…"
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>
              <Field label="After photo URL (optional)">
                <input
                  value={form.after_photo_url}
                  onChange={(e) => setForm({ ...form, after_photo_url: e.target.value })}
                  placeholder="https://…"
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              {formError && <p className="text-xs text-danger">{formError}</p>}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-muted hover:text-ivory px-4 py-2">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-full bg-wine text-onaccent text-sm font-medium px-5 py-2.5 disabled:opacity-50">
                {saving ? "Saving…" : editingVisitId ? "Save changes" : "Log visit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {aiPanel && (
        <AiResultPanel panel={aiPanel} onClose={() => setAiPanel(null)} />
      )}
    </Layout>
  );
}

function AiResultPanel({ panel, onClose }) {
  const [text, setText] = useState(panel.text);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(panel.text);
  }, [panel.text]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser -- not worth surfacing
      // as an error state, the text is still selectable manually.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ivory flex items-center gap-2">
            <Sparkles size={17} className="text-gold" /> {panel.title}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ivory">
            <X size={18} />
          </button>
        </div>

        {panel.loading && <p className="text-muted text-sm">Generating…</p>}
        {panel.error && <p className="text-sm text-danger">{panel.error}</p>}

        {!panel.loading && !panel.error && (
          <>
            {panel.warn && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-xs text-danger mb-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>This is AI-generated general guidance, not medical advice. Review it carefully before sharing it with your client.</span>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px] text-muted">AI-generated — nothing here is saved automatically. Review before using it.</p>
              <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gold hover:underline shrink-0 ml-3">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, warn }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${warn ? "border-danger/40 bg-danger/5" : "border-line bg-surface-2"}`}>
      <p className={`text-[11px] uppercase tracking-wide flex items-center gap-1.5 ${warn ? "text-danger" : "text-muted"}`}>
        <Icon size={13} /> {label}
      </p>
      <p className="text-ivory text-[15px] mt-1.5">{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">{label}</p>
      {children}
    </div>
  );
}
