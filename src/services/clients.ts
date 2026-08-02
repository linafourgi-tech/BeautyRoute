import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type InsertClient = Database['public']['Tables']['clients']['Insert']
type UpdateClient = Database['public']['Tables']['clients']['Update']

// 1. Get all clients for a specific workspace (salon)
export async function getClients(workspaceId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('full_name', { ascending: true })
  
  if (error) throw error
  return data
}

// 2. Get a single client's profile by their ID
export async function getClientById(id: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

// 3. Add a new client to the workspace
export async function createClient(client: InsertClient) {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 4. Update a client's details (e.g., updating contact info or formula notes)
export async function updateClient(id: string, updates: UpdateClient) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 5. Remove a client. There's no archive/soft-delete column on this table --
// clients.client_id has ON DELETE RESTRICT from appointments and visits, so
// this throws if the client has any booking history. Callers should catch
// that and explain it, not treat it as a generic failure.
export async function deleteClient(id: string) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) throw error
}