import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Plus } from "lucide-react";
import Layout from "../components/Layout";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { getAppointments, createAppointment, updateAppointment, deleteAppointment, setAppointmentServices } from "../services/appointments";
import { getClients } from "../services/clients";
import { getServices } from "../services/services";
import { toAppointmentViewModel } from "../lib/appointmentView";
import { useAppLang } from "../hooks/useAppLang";
import { t, translateEnum, intlLocale } from "../lib/i18n";
import { Button, Input, Select, Tag, Dialog, Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds, replacing every hand-built element (day tabs, appointment
// cards, status pills, and -- most importantly -- both modals) with the
// shared components/ui/ library already proven on Clients/Services/
// Dashboard. Every data hook, effect, handler, and piece of state below is
// byte-for-byte the same as before; only markup/styling changed.

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "noshow"];
const STATUS_TONE = {
  confirmed: "success",
  completed: "success",
  pending: "warning",
  cancelled: "error",
  noshow: "error",
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    clientId: "",
    date: todayISODate(),
    time: "10:00",
    status: "pending",
    location: "",
    notes: "",
    serviceIds: [],
  };
}

export default function Appointments() {
  const { lang } = useAppLang();
  const { workspaceId, loading: workspaceLoading, error: workspaceError, refresh: refreshWorkspace } = useCurrentWorkspace();
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [active, setActive] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (workspaceLoading) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!workspaceId) {
        if (!cancelled) {
          setAppointments([]);
          setClients([]);
          setServices([]);
          setLoading(false);
        }
        return;
      }

      try {
        const [appointmentRows, clientRows, serviceRows] = await Promise.all([
          getAppointments(workspaceId),
          getClients(workspaceId),
          getServices(workspaceId),
        ]);
        if (cancelled) return;
        setAppointments((appointmentRows ?? []).map(toAppointmentViewModel));
        setClients(clientRows ?? []);
        setServices((serviceRows ?? []).filter((s) => s.is_active));
      } catch (err) {
        if (!cancelled) setError(err.message || t("appointments.errorFallback", lang));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // `lang` is deliberately excluded -- it's only used for the fallback
    // error-message translation inside this effect's catch(), and
    // re-running the fetch on a language switch would be a real, wasteful,
    // unnecessary network request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaceLoading, reloadToken]);

  function retry() {
    refreshWorkspace();
    setReloadToken((t) => t + 1);
  }

  const dates = useMemo(
    () => [...new Set(appointments.map((a) => a.date))].sort(),
    [appointments]
  );

  useEffect(() => {
    if (dates.length > 0 && !dates.includes(active)) {
      setActive(dates[0]);
    }
  }, [dates, active]);

  const dayAppts = useMemo(
    () => appointments.filter((a) => a.date === active),
    [appointments, active]
  );
  const isLoading = workspaceLoading || loading;
  const failed = workspaceError || error;

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm(), date: active || todayISODate() });
    setFormErrors({});
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(appt) {
    setEditingId(appt.id);
    setForm({
      clientId: appt.clientId || "",
      date: appt.date,
      time: appt.time,
      status: appt.status,
      location: appt.location === "—" ? "" : appt.location,
      notes: "",
      serviceIds: appt.serviceIds || [],
    });
    setFormErrors({});
    setFormError("");
    setModalOpen(true);
  }

  function toggleService(id) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id],
    }));
  }

  function validate() {
    const errors = {};
    if (!form.clientId) errors.clientId = t("appointments.validation.client", lang);
    if (!form.date) errors.date = t("appointments.validation.date", lang);
    if (!form.time) errors.time = t("appointments.validation.time", lang);
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setSaving(true);
    try {
      const startDateTime = new Date(`${form.date}T${form.time}:00`);
      const totalMinutes = form.serviceIds.length > 0
        ? form.serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.duration_minutes || 0), 0)
        : 30;
      const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);

      const payload = {
        workspace_id: workspaceId,
        client_id: form.clientId,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: form.status,
        location_address: form.location.trim() || null,
        notes: form.notes.trim() || null,
      };

      const appointmentId = editingId
        ? (await updateAppointment(editingId, payload)).id
        : (await createAppointment(payload)).id;

      await setAppointmentServices(appointmentId, form.serviceIds);

      setModalOpen(false);
      refresh();
    } catch (err) {
      setFormError(err.message || t("appointments.saveErrorFallback", lang));
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setActionError("");
    setActing(true);
    try {
      await updateAppointment(cancelTarget.id, { status: "cancelled" });
      setCancelTarget(null);
      refresh();
    } catch (err) {
      setActionError(err.message || t("appointments.cancelErrorFallback", lang));
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError("");
    setActing(true);
    try {
      await deleteAppointment(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setActionError(err.message || t("appointments.deleteErrorFallback", lang));
    } finally {
      setActing(false);
    }
  }

  return (
    <Layout
      title={t("appointments.title", lang)}
      subtitle={t("appointments.subtitle", lang)}
      headerActions={
        <Button variant="gold" icon={<Plus size={16} />} onClick={openCreate} disabled={isLoading || !!failed}>
          {t("appointments.newBooking", lang)}
        </Button>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-6)", overflowX: "auto", paddingBottom: 4 }}>
        {dates.map((d) => (
          <Tag key={d} selected={active === d} onClick={() => setActive(d)}>
            {new Date(d).toLocaleDateString(intlLocale(lang), { weekday: "short", day: "numeric", month: "short" })}
          </Tag>
        ))}
      </div>

      {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

      {!failed && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={72} radius="var(--radius-lg)" />
          <Skeleton height={72} radius="var(--radius-lg)" />
          <Skeleton height={72} radius="var(--radius-lg)" />
        </div>
      )}

      {!failed && !isLoading && dayAppts.length === 0 && (
        <EmptyState title={t("appointments.emptyTitle", lang)} description={t("appointments.emptyDescription", lang)} />
      )}

      {!failed && !isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dayAppts.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                padding: "14px var(--space-5)",
                background: "var(--surface-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div style={{ textAlign: "center", flexShrink: 0, width: 56 }}>
                <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--accent-gold-strong)", fontSize: "var(--text-body)", lineHeight: 1 }}>{a.time}</p>
              </div>
              <button
                onClick={() => openEdit(a)}
                style={{ flex: 1, minWidth: 180, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-body)" }}
              >
                <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>{a.client}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>{a.service}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <MapPin size={12} /> {a.location}
                  <Clock size={12} style={{ marginLeft: 12 }} /> {t("appointments.travelPlaceholder", lang)}
                </p>
              </button>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-overline)",
                  padding: "5px 12px",
                  borderRadius: "var(--radius-pill)",
                  flexShrink: 0,
                  border: "1px solid var(--" + STATUS_TONE[a.status] + "-fg)",
                  color: "var(--" + STATUS_TONE[a.status] + "-fg)",
                }}
              >
                {translateEnum("status", a.status, lang)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {a.status !== "cancelled" && (
                  <Button variant="ghost" size="sm" onClick={() => { setCancelTarget(a); setActionError(""); }}>{t("action.cancel", lang)}</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(a); setActionError(""); }}>{t("action.delete", lang)}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "var(--space-8)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border-default)", padding: "var(--space-5)", fontSize: "var(--text-body-sm)", color: "var(--text-tertiary)" }}>
        {t("appointments.comingSoon", lang)}
      </div>

      <Dialog
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? t("appointments.editBooking", lang) : t("appointments.newBookingTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>{t("action.cancel", lang)}</Button>
            <Button variant="gold" onClick={handleSubmit} disabled={saving}>
              {saving ? t("action.saving", lang) : editingId ? t("appointments.saveChanges", lang) : t("appointments.bookAppointment", lang)}
            </Button>
          </>
        }
      >
        {/* A real <form>, even though its own submit button lives in
            Dialog's separate footer slot (the shared Button component has
            no passthrough for a `form="id"` attribute to link them by id):
            pressing Enter in one of these fields still triggers this form's
            onSubmit natively, and it gives the "edit booking prefills the
            right service" kind of test a real .closest("form") to scope
            into, exactly like the previous hand-built modal did. */}
        <form onSubmit={handleSubmit}>
          {/* Composition pass: tighter inter-field rhythm (10px, not 14),
              and Status+Location share a row -- both are short single-line
              fields, and stacking them full-width was exactly the kind of
              unnecessary extra height that made this dialog read as
              oversized rather than a compact, operational form. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Select
              label={t("appointments.client", lang)}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              placeholder={t("appointments.selectClient", lang)}
              options={clients.map((c) => ({ value: c.id, label: c.full_name }))}
            />
            {formErrors.clientId && <p style={{ margin: "-6px 0 0", fontSize: 12, color: "var(--error-fg)" }}>{formErrors.clientId}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label={t("appointments.date", lang)} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={formErrors.date} />
              <Input label={t("appointments.startTime", lang)} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} error={formErrors.time} />
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <legend style={{ display: "block", width: "100%", padding: 0, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{t("appointments.services", lang)}</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {services.length === 0 && <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{t("appointments.noActiveServices", lang)}</p>}
                {services.map((s) => (
                  <Tag key={s.id} selected={form.serviceIds.includes(s.id)} onClick={() => toggleService(s.id)}>
                    {s.name} · {s.duration_minutes}min
                  </Tag>
                ))}
              </div>
            </fieldset>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
              <Select
                label={t("appointments.status", lang)}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={STATUSES.map((s) => ({ value: s, label: translateEnum("status", s, lang) }))}
              />
              <Input label={t("appointments.location", lang)} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("appointments.locationPlaceholder", lang)} />
            </div>

            {formError && <p style={{ margin: 0, fontSize: 13, color: "var(--error-fg)" }}>{formError}</p>}
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!cancelTarget}
        onClose={() => !acting && setCancelTarget(null)}
        title={t("appointments.cancelTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={acting}>{t("action.neverMind", lang)}</Button>
            <Button variant="gold" onClick={handleCancel} disabled={acting}>{acting ? t("action.working", lang) : t("appointments.cancelBooking", lang)}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{cancelTarget && t("appointments.cancelBody", lang, { client: cancelTarget.client, time: cancelTarget.time })}</p>
        {actionError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{actionError}</p>}
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !acting && setDeleteTarget(null)}
        title={t("appointments.deleteTitle", lang)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={acting}>{t("action.neverMind", lang)}</Button>
            <Button variant="gold" onClick={handleDelete} disabled={acting}>{acting ? t("action.working", lang) : t("action.delete", lang)}</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{deleteTarget && t("appointments.deleteBody", lang, { client: deleteTarget.client, time: deleteTarget.time })}</p>
        {actionError && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--error-fg)" }}>{actionError}</p>}
      </Dialog>
    </Layout>
  );
}
