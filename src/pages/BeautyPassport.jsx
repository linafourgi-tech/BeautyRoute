import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Phone, Mail, Plus, ChevronDown, ChevronUp, Image as ImageIcon, Sparkles, Copy, Check, Search } from "lucide-react";
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
import { Button, Input, Select, Dialog } from "../components/ui";
import { useAppLang } from "../hooks/useAppLang";
import { t, translateEnum, intlLocale } from "../lib/i18n";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds, replacing the hand-built visit-log form and AI-result
// panel (both previously raw `fixed inset-0` overlays) with the shared
// Dialog/Input/Select/Button components. Every data hook, effect, handler,
// and piece of state below is byte-for-byte the same as before; only
// markup/styling changed.

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
  const { lang } = useAppLang();
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
        if (!cancelled) setClientsError(err.message || t("passport.clientsErrorFallback", lang));
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
        if (!cancelled) setDetailError(err.message || t("passport.detailErrorFallback", lang));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
    // `lang` is deliberately excluded -- see Appointments.jsx's identical
    // comment for why (fallback error-message translation only, not worth
    // an extra fetch on a language switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setFormError(t("passport.validation.visitDate", lang));
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
      setFormError(err.message || t("passport.saveVisitErrorFallback", lang));
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
      const message = err instanceof AiUnavailableError ? err.message : t("passport.ai.genericError", lang);
      setAiPanel({ kind, title, warn, loading: false, error: message, text: "" });
    }
  }

  function openAiSummary() {
    runAiAction("summary", t("passport.ai.summaryTitle", lang), false, () => generateClientSummary(workspaceId, client.id));
  }

  function openAiNextVisit() {
    runAiAction("next_visit", t("passport.ai.nextVisitTitle", lang), false, () => generateNextVisitRecommendation(workspaceId, client.id));
  }

  function openAiAftercare(visit) {
    runAiAction("aftercare", t("passport.ai.aftercareTitle", lang), true, () => generateAftercareInstructions(workspaceId, visit.id));
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
      title={t("passport.title", lang)}
      subtitle={t("passport.subtitle", lang)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Client list */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("passport.searchPlaceholder", lang)}
              icon={<Search size={15} style={{ color: "var(--text-tertiary)" }} />}
            />
          </div>

          {clientsError && <p style={{ fontSize: 12, color: "var(--error-fg)" }}>{clientsError}</p>}
          {isLoading && <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("passport.loadingClients", lang)}</p>}
          {!isLoading && !clientsError && filteredClients.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("passport.noClientsYet", lang)}</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!isLoading && filteredClients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSearchParams({ client: c.id })}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid " + (selectedId === c.id ? "var(--accent-gold-strong)" : "var(--border-subtle)"),
                  background: "var(--surface-card)",
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ height: 38, width: 38, borderRadius: "50%", background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", color: "var(--accent-gold-strong)", fontSize: 13, flexShrink: 0 }}>
                  {initials(c.full_name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.full_name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.last_visit_at ? t("passport.lastVisit", lang, { date: c.last_visit_at.slice(0, 10) }) : t("passport.noVisitsYet", lang)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Storybook */}
        {client && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* Cover */}
            <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-6)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
                <div style={{ height: 76, width: 76, borderRadius: "50%", background: "var(--bg-sunken)", border: "3px solid var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 26, color: "var(--accent-gold-strong)", flexShrink: 0 }}>
                  {initials(client.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--accent-gold-strong)" }}>{t("passport.eyebrow", lang)}</p>
                  <h2 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", color: "var(--text-primary)" }}>{client.full_name}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
                    {t("passport.clientSince", lang, { date: new Date(client.created_at).toLocaleDateString(intlLocale(lang), { year: "numeric", month: "long" }) })}
                  </p>
                </div>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", background: "var(--bg-sunken)", color: "var(--accent-gold-strong)", padding: "6px 14px", borderRadius: "var(--radius-pill)", fontWeight: 600 }}>
                  {translateEnum("tier", client.tier, lang)}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: "var(--space-6)" }}>
                <InfoCard icon={Phone} label={t("passport.phone", lang)} value={client.phone || t("passport.notOnFile", lang)} />
                <InfoCard icon={Mail} label={t("passport.email", lang)} value={client.email || t("passport.notOnFile", lang)} />
                <InfoCard
                  icon={AlertTriangle}
                  label={t("passport.allergies", lang)}
                  value={client.allergies?.length ? client.allergies.join(", ") : t("passport.noneOnFile", lang)}
                  warn={client.allergies?.length > 0}
                />
                <InfoCard icon={ImageIcon} label={t("passport.notes", lang)} value={client.internal_notes || t("passport.noInternalNotes", lang)} />
              </div>

              {aiEnabled && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-subtle)" }}>
                  <Button variant="secondary" size="sm" icon={<Sparkles size={13} />} onClick={openAiSummary}>{t("passport.generateSummary", lang)}</Button>
                  <Button variant="secondary" size="sm" icon={<Sparkles size={13} />} onClick={openAiNextVisit}>{t("passport.suggestNextVisit", lang)}</Button>
                </div>
              )}
            </div>

            {detailError && <p style={{ fontSize: 14, color: "var(--error-fg)" }}>{detailError}</p>}

            {/* Appointment history */}
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--text-primary)", margin: "0 0 var(--space-4)" }}>{t("passport.appointmentHistory", lang)}</h3>
              {detailLoading && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("route.loading", lang)}</p>}
              {!detailLoading && appointments.length === 0 && (
                <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("passport.noAppointmentsYet", lang)}</p>
              )}
              {!detailLoading && appointments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {appointments.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "12px 16px", fontSize: 14 }}>
                      <span style={{ color: "var(--text-primary)" }}>
                        {new Date(a.start_time).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {(a.appointment_services ?? []).map((l) => l.services?.name).filter(Boolean).join(", ") || t("passport.noServicesOnFile", lang)}
                      </span>
                      <span style={{ color: "var(--text-tertiary)", textTransform: "uppercase", fontSize: 11, letterSpacing: "var(--ls-overline)" }}>{translateEnum("status", a.status, lang)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visit timeline */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: 0 }}>{t("passport.herStorySoFar", lang)}</h3>
                <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={openLogVisit}>{t("passport.logVisit", lang)}</Button>
              </div>

              {detailLoading && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("route.loading", lang)}</p>}
              {!detailLoading && visits.length === 0 && (
                <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("passport.noVisitsLogged", lang)}</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visits.map((v) => {
                  const expanded = expandedVisitId === v.id;
                  const services = visitServices(v);
                  const duration = visitDuration(v);
                  const files = visitFiles[v.id] ?? [];
                  const before = files.find((f) => f.file_purpose === "before");
                  const after = files.find((f) => f.file_purpose === "after");

                  return (
                    <div key={v.id} style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", overflow: "hidden" }}>
                      <button onClick={() => toggleVisit(v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-5)", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}>
                        <div>
                          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-h4)", color: "var(--text-primary)" }}>{new Date(v.visit_date).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
                            {services.length > 0 ? services.join(", ") : t("passport.noLinkedServices", lang)}
                            {duration ? ` · ${duration}` : ""}
                            {v.staff_id === user?.id ? t("passport.youSuffix", lang) : ""}
                          </p>
                        </div>
                        {expanded ? <ChevronUp size={18} color="var(--text-tertiary)" /> : <ChevronDown size={18} color="var(--text-tertiary)" />}
                      </button>

                      {expanded && (
                        <div style={{ padding: "0 var(--space-5) var(--space-5)", display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                          <PassportField label={t("passport.field.services", lang)}>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>{services.length > 0 ? services.join(", ") : "—"}</p>
                          </PassportField>
                          <PassportField label={t("passport.field.notes", lang)}>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: "var(--lh-body)" }}>{v.summary_notes || t("passport.noNotesOnFile", lang)}</p>
                          </PassportField>
                          <PassportField label={t("passport.field.photos", lang)}>
                            {before || after ? (
                              <div style={{ display: "flex", gap: 12 }}>
                                {before && <img src={before.file_url} alt="Before" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-lg object-cover" style={{ border: "1px solid var(--border-subtle)" }} />}
                                {after && <img src={after.file_url} alt="After" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-lg object-cover" style={{ border: "1px solid var(--border-subtle)" }} />}
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)" }}>{t("passport.noPhotosOnFile", lang)}</p>
                            )}
                          </PassportField>
                          <PassportField label={t("passport.field.formula", lang)}>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>{v.formula_data?.mix || "—"}</p>
                          </PassportField>
                          <PassportField label={t("passport.field.nextRecommendation", lang)}>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>{v.formula_data?.recommendation || "—"}</p>
                          </PassportField>
                          {(v.products_used ?? []).length > 0 && (
                            <PassportField label={t("passport.field.productsUsed", lang)}>
                              <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>{v.products_used.join(", ")}</p>
                            </PassportField>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <button onClick={() => openEditVisit(v)} style={{ fontSize: 12, color: "var(--accent-gold-strong)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                              {t("passport.editThisVisit", lang)}
                            </button>
                            {aiEnabled && services.length > 0 && (
                              <button onClick={() => openAiAftercare(v)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-gold-strong)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                                <Sparkles size={12} /> {t("passport.generateAftercare", lang)}
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

      <Dialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingVisitId ? t("passport.editVisitTitle", lang) : t("passport.logVisitTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleSaveVisit} disabled={saving}>{saving ? t("action.saving", lang) : editingVisitId ? t("appointments.saveChanges", lang) : t("passport.logVisitAction", lang)}</Button>
          </>
        }
      >
        <form onSubmit={handleSaveVisit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label={t("passport.visitDate", lang)} type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />

            <Select
              label={t("passport.linkedAppointment", lang)}
              value={form.appointment_id}
              onChange={(e) => setForm({ ...form, appointment_id: e.target.value })}
              placeholder={t("passport.noLinkedAppointment", lang)}
              options={appointments.map((a) => ({
                value: a.id,
                label: `${new Date(a.start_time).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short", year: "numeric" })} — ${(a.appointment_services ?? []).map((l) => l.services?.name).filter(Boolean).join(", ") || t("passport.noServicesLabel", lang)}`,
              }))}
            />

            <div>
              <label htmlFor="visit-notes" style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{t("passport.field.notes", lang)}</label>
              <textarea
                id="visit-notes"
                value={form.summary_notes}
                onChange={(e) => setForm({ ...form, summary_notes: e.target.value })}
                rows={3}
                style={{ width: "100%", background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
            </div>

            <Input label={t("passport.productsUsedCsv", lang)} value={form.products_used} onChange={(e) => setForm({ ...form, products_used: e.target.value })} />
            <Input label={t("passport.formula", lang)} value={form.formula_mix} onChange={(e) => setForm({ ...form, formula_mix: e.target.value })} placeholder={t("passport.formulaPlaceholder", lang)} />
            <Input label={t("passport.nextRecommendation", lang)} value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} placeholder={t("passport.nextRecommendationPlaceholder", lang)} />
            <Input label={t("passport.beforePhotoUrl", lang)} value={form.before_photo_url} onChange={(e) => setForm({ ...form, before_photo_url: e.target.value })} placeholder="https://…" />
            <Input label={t("passport.afterPhotoUrl", lang)} value={form.after_photo_url} onChange={(e) => setForm({ ...form, after_photo_url: e.target.value })} placeholder="https://…" />

            {formError && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
          </div>
        </form>
      </Dialog>

      {aiPanel && <AiResultPanel panel={aiPanel} onClose={() => setAiPanel(null)} lang={lang} />}
    </Layout>
  );
}

function AiResultPanel({ panel, onClose, lang }) {
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
    <Dialog
      open
      onClose={onClose}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--accent-gold-strong)" /> {panel.title}
        </span>
      }
    >
      {panel.loading && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{t("passport.ai.generating", lang)}</p>}
      {panel.error && <p style={{ fontSize: 14, color: "var(--error-fg)" }}>{panel.error}</p>}

      {!panel.loading && !panel.error && (
        <>
          {panel.warn && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderRadius: "var(--radius-md)", border: "1px solid var(--error-fg)", background: "var(--error-bg)", padding: "10px 14px", fontSize: 12, color: "var(--error-fg)", marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{t("passport.ai.medicalWarning", lang)}</span>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            style={{ width: "100%", background: "var(--surface-card-alt)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-body)", outline: "none", resize: "none", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{t("passport.ai.reviewNote", lang)}</p>
            <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-gold-strong)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("passport.ai.copied", lang) : t("passport.ai.copy", lang)}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function InfoCard({ icon: Icon, label, value, warn }) {
  return (
    <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid " + (warn ? "var(--error-fg)" : "var(--border-subtle)"), background: warn ? "var(--error-bg)" : "var(--bg-sunken)", padding: "14px 18px" }}>
      <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", display: "flex", alignItems: "center", gap: 6, color: warn ? "var(--error-fg)" : "var(--text-tertiary)" }}>
        <Icon size={13} /> {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function PassportField({ label, children }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "var(--ls-overline)", color: "var(--text-tertiary)" }}>{label}</p>
      {children}
    </div>
  );
}
