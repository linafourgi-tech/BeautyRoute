import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type InsertAppointment = Database['public']['Tables']['appointments']['Insert']
type UpdateAppointment = Database['public']['Tables']['appointments']['Update']

// Phase 13 Step 3: how far back/forward the Appointments page's day-tabs
// look, instead of loading a workspace's entire appointment history just to
// populate a handful of day tabs. Deliberately generous in both directions
// -- this app has no real usage history yet (pre-launch), so there's
// nothing currently relied upon that a tighter window could silently hide;
// 90 days back covers "recent history" review, 180 days forward covers
// even a far-out booking (e.g. a wedding booked a season ahead). This
// bounds the query (the actual scalability concern -- unbounded growth
// across a workspace's entire multi-year lifetime) without materially
// changing what any realistic current booking pattern shows. Revisit this
// window if real usage ever needs a wider range -- see
// docs/quality/PHASE_13_STEP_3... (Performance report) for the full
// reasoning.
const APPOINTMENTS_WINDOW_DAYS_PAST = 90
const APPOINTMENTS_WINDOW_DAYS_FUTURE = 180
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// 1. Get appointments for a salon with client and booked-service details
// attached, bounded to a rolling window around today (see
// APPOINTMENTS_WINDOW_DAYS_PAST/FUTURE above) rather than the workspace's
// entire history. Uses the existing idx_appointments_time_window
// (workspace_id, start_time, end_time) index via the workspace_id +
// start_time-range filter below.
export async function getAppointments(workspaceId: string) {
  const now = Date.now()
  const windowStart = new Date(now - APPOINTMENTS_WINDOW_DAYS_PAST * ONE_DAY_MS).toISOString()
  const windowEnd = new Date(now + APPOINTMENTS_WINDOW_DAYS_FUTURE * ONE_DAY_MS).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone
      ),
      appointment_services (
        custom_price,
        services (
          id,
          name,
          price,
          duration_minutes
        )
      )
    `)
    .eq('workspace_id', workspaceId)
    .gte('start_time', windowStart)
    .lt('start_time', windowEnd)
    .order('start_time', { ascending: true })

  if (error) throw error
  return data
}

// 1a. Get ONLY today's appointments for a salon -- used by the dashboard,
// which only ever displays "today's route," not the workspace's history.
// Bounded to a single UTC calendar day, matching this app's existing
// "today" semantics exactly (see lib/appointmentView.js's date derivation,
// also UTC-based via ISO-string slicing) -- not workspace-timezone-aware,
// which preserves the dashboard's prior client-side-filtered behavior
// exactly rather than silently changing what counts as "today" for a
// non-UTC workspace. Uses the same idx_appointments_time_window index as
// getAppointments() above.
export async function getTodaysAppointments(workspaceId: string) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const startOfDay = `${todayStr}T00:00:00.000Z`
  const endOfDay = new Date(new Date(startOfDay).getTime() + ONE_DAY_MS).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone
      ),
      appointment_services (
        custom_price,
        services (
          id,
          name,
          price,
          duration_minutes
        )
      )
    `)
    .eq('workspace_id', workspaceId)
    .gte('start_time', startOfDay)
    .lt('start_time', endOfDay)
    .order('start_time', { ascending: true })

  if (error) throw error
  return data
}

// 2. Book a new appointment
export async function createAppointment(appointment: InsertAppointment) {
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointment)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 3. Update appointment details or status (e.g., changing from 'scheduled' to 'completed')
export async function updateAppointment(id: string, updates: UpdateAppointment) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 4. Cancel or delete an appointment
export async function deleteAppointment(id: string) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 5. Get a single client's appointment history (Beauty Passport's
// "appointment history" section -- narrower and cheaper than fetching the
// whole workspace's appointments just to filter client-side).
export async function getAppointmentsByClient(clientId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_services (
        services ( id, name, price, duration_minutes )
      )
    `)
    .eq('client_id', clientId)
    .order('start_time', { ascending: false })

  if (error) throw error
  return data
}

// 6. Replace the set of services booked on an appointment. Delete-then-insert
// so the same function works for both first-time booking and edits.
// appointment_services.appointment_id is ON DELETE CASCADE, so deleting the
// appointment itself already cleans these up -- this is only for changing
// which services are attached while the appointment still exists.
export async function setAppointmentServices(appointmentId: string, serviceIds: string[]) {
  const { error: deleteError } = await supabase
    .from('appointment_services')
    .delete()
    .eq('appointment_id', appointmentId)

  if (deleteError) throw deleteError
  if (serviceIds.length === 0) return []

  const { data, error: insertError } = await supabase
    .from('appointment_services')
    .insert(serviceIds.map((serviceId) => ({ appointment_id: appointmentId, service_id: serviceId })))
    .select()

  if (insertError) throw insertError
  return data
}