// Maps a Supabase appointments row (with clients + appointment_services joins,
// see services/appointments.ts) to the flat shape the Appointments/RouteEngine
// pages were already written against.
export function toAppointmentViewModel(row) {
  const start = new Date(row.start_time);
  const date = row.start_time.slice(0, 10);
  const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const service = (row.appointment_services ?? [])
    .map((link) => link.services?.name)
    .filter(Boolean)
    .join(", ");

  return {
    id: row.id,
    clientId: row.client_id,
    // Raw service ids/durations attached to this appointment -- needed to
    // prefill the edit form; `service` below stays a display string for the
    // list view, unchanged for existing consumers.
    serviceIds: (row.appointment_services ?? []).map((link) => link.services?.id).filter(Boolean),
    date,
    time,
    client: row.clients?.full_name ?? "Unknown client",
    service: service || "No service on file",
    location: row.location_address ?? "—",
    status: row.status,
    // No schema support for routing/distance data yet (no travel-time or
    // distance columns/tables exist). Explicit placeholders, not fabricated
    // numbers — mirrors the same-named mock fields these pages used to read.
    travelMinFromPrev: 0,
    distanceKmFromPrev: 0,
  };
}
