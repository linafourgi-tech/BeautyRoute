import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Plus, X } from "lucide-react";
import Layout from "../components/Layout";
import { getAppointments, createAppointment, updateAppointment, deleteAppointment, setAppointmentServices } from "../services/appointments";
import { getClients } from "../services/clients";
import { getServices } from "../services/services";
import { toAppointmentViewModel } from "../lib/appointmentView";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { Skeleton, EmptyState } from "../components/ui";
import { ErrorState } from "../components/ErrorState";
import "../styles/beautyroute/styles.css";

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "noshow"];

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
        if (!cancelled) setError(err.message || "Couldn't load your appointments.");
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

  const dates = useMemo(
    () => [...new Set(appointments.map((a) => a.date))].sort(),
    [appointments]
  );

  useEffect(() => {
    if (dates.length > 0 && !dates.includes(active)) {
      setActive(dates[0]);
    }
  }, [dates, active]);

  const dayAppts = appointments.filter((a) => a.date === active);
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
    if (!form.clientId) errors.clientId = "Select a client.";
    if (!form.date) errors.date = "Pick a date.";
    if (!form.time) errors.time = "Pick a start time.";
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
      setFormError(err.message || "Couldn't save this appointment.");
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
      setActionError(err.message || "Couldn't cancel this appointment.");
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
      setActionError(err.message || "Couldn't delete this appointment.");
    } finally {
      setActing(false);
    }
  }

  return (
    <Layout
      title="Appointment Engine"
      subtitle="Booking, calendar, waiting list, cancellations and reminders — all in one thread."
    >
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm border transition-colors ${
              active === d
                ? "bg-wine border-wine text-onaccent"
                : "border-line text-muted hover:text-ivory"
            }`}
          >
            {new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </button>
        ))}
        <button
          onClick={openCreate}
          disabled={isLoading || !!failed}
          className="ml-auto shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-gold text-gold hover:bg-gold hover:text-onaccent transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={15} /> New booking
        </button>
      </div>

      <div className="space-y-3">
        {failed && <ErrorState message={typeof failed === "string" ? failed : failed.message} onRetry={retry} />}

        {!failed && isLoading && (
          <div className="beautyroute-ds space-y-3">
            <Skeleton height={72} radius="var(--radius-lg)" />
            <Skeleton height={72} radius="var(--radius-lg)" />
            <Skeleton height={72} radius="var(--radius-lg)" />
          </div>
        )}

        {!failed && !isLoading && dayAppts.length === 0 && (
          <div className="beautyroute-ds">
            <EmptyState title="Nothing booked yet" description="Appointments booked for this day will show up here." />
          </div>
        )}

        {!failed && !isLoading && dayAppts.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-5 flex items-center gap-5">
            <div className="text-center shrink-0 w-16">
              <p className="font-mono-tag text-gold text-lg leading-none">{a.time}</p>
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => openEdit(a)}>
              <p className="text-ivory font-medium">{a.client}</p>
              <p className="text-muted text-sm">{a.service}</p>
              <p className="text-muted text-xs flex items-center gap-1 mt-1">
                <MapPin size={12} /> {a.location}
                <Clock size={12} className="ml-3" /> ~45 min
              </p>
            </button>
            <span className={`text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0 ${
              a.status === "confirmed" ? "border-sage text-sage" :
              a.status === "cancelled" || a.status === "noshow" ? "border-danger text-danger" :
              "border-gold text-gold"
            }`}>
              {a.status}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {a.status !== "cancelled" && (
                <button
                  onClick={() => { setCancelTarget(a); setActionError(""); }}
                  className="text-xs text-muted hover:text-gold border border-line rounded-full px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => { setDeleteTarget(a); setActionError(""); }}
                className="text-xs text-muted hover:text-danger border border-line rounded-full px-3 py-1.5 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
        Coming to this engine: waiting-list auto-fill when a slot cancels, peak-day pricing suggestions,
        and WhatsApp-native reminders sent 24h and 2h before each visit.
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setModalOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-ivory">{editingId ? "Edit booking" : "New booking"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-muted hover:text-ivory">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Client" error={formErrors.clientId}>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" error={formErrors.date}>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                  />
                </Field>
                <Field label="Start time" error={formErrors.time}>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                  />
                </Field>
              </div>

              <Field label="Services">
                <div className="flex flex-wrap gap-2">
                  {services.length === 0 && <p className="text-xs text-muted">No active services yet.</p>}
                  {services.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        form.serviceIds.includes(s.id)
                          ? "bg-wine border-wine text-onaccent"
                          : "border-line text-muted hover:text-ivory"
                      }`}
                    >
                      {s.name} · {s.duration_minutes}min
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Location">
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Al Narjis, Riyadh"
                  className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-sm text-ivory outline-none focus:border-wine"
                />
              </Field>

              {formError && <p className="text-xs text-danger">{formError}</p>}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm text-muted hover:text-ivory px-4 py-2">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-wine text-onaccent text-sm font-medium px-5 py-2.5 disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Book appointment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this appointment?"
          message={`${cancelTarget.client} at ${cancelTarget.time} will be marked as cancelled.`}
          confirmLabel="Cancel booking"
          error={actionError}
          acting={acting}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this appointment?"
          message={`This permanently removes ${deleteTarget.client}'s booking at ${deleteTarget.time}. This can't be undone.`}
          confirmLabel="Delete"
          error={actionError}
          acting={acting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Layout>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-danger mt-1">{error}</span>}
    </label>
  );
}

function ConfirmDialog({ title, message, confirmLabel, error, acting, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !acting && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg text-ivory mb-2">{title}</h2>
        <p className="text-sm text-muted">{message}</p>
        {error && <p className="text-xs text-danger mt-3">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={acting} className="text-sm text-muted hover:text-ivory px-4 py-2">
            Never mind
          </button>
          <button
            onClick={onConfirm}
            disabled={acting}
            className="rounded-full bg-wine text-onaccent text-sm font-medium px-5 py-2.5 disabled:opacity-50"
          >
            {acting ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
