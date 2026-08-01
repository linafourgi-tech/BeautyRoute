import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type Visit = Database['public']['Tables']['visits']['Row']
type InsertVisit = Database['public']['Tables']['visits']['Insert']
type UpdateVisit = Database['public']['Tables']['visits']['Update']

// 1. Get the entire visit history for a specific client (great for reviewing past formulas).
// Joins through to the linked appointment's booked services -- a visit has no
// direct link to services, only via its optional appointment_id.
export async function getClientVisitHistory(clientId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      appointments (
        id,
        start_time,
        end_time,
        appointment_services (
          services ( id, name, price, duration_minutes )
        )
      )
    `)
    .eq('client_id', clientId)
    .order('visit_date', { ascending: false })

  if (error) throw error
  return data
}

// 2. Create a historical log entry after an appointment finishes
export async function createVisitLog(visit: InsertVisit) {
  const { data, error } = await supabase
    .from('visits')
    .insert(visit)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 3. Update past visit notes or hair formula details
export async function updateVisitLog(id: string, updates: UpdateVisit) {
  const { data, error } = await supabase
    .from('visits')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}