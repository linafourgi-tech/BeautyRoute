import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type Client = Database['public']['Tables']['clients']['Row']
type InsertClient = Database['public']['Tables']['clients']['Insert']
type UpdateClient = Database['public']['Tables']['clients']['Update']

// 1. Get all clients for a specific workspace (salon)
export async function getClients(workspaceId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })
  
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