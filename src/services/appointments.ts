import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type Appointment = Database['public']['Tables']['appointments']['Row']
type InsertAppointment = Database['public']['Tables']['appointments']['Insert']
type UpdateAppointment = Database['public']['Tables']['appointments']['Update']

// 1. Get all appointments for a salon with client details attached
export async function getAppointments(workspaceId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      clients (
        id,
        name,
        email,
        phone
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