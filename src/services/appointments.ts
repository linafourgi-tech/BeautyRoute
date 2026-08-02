import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type InsertAppointment = Database['public']['Tables']['appointments']['Insert']
type UpdateAppointment = Database['public']['Tables']['appointments']['Update']

// 1. Get all appointments for a salon with client and booked-service details attached
export async function getAppointments(workspaceId: string) {
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