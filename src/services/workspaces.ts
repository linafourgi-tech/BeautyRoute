import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type Workspace = Database['public']['Tables']['workspaces']['Row']
type InsertWorkspace = Database['public']['Tables']['workspaces']['Insert']
type UpdateWorkspace = Database['public']['Tables']['workspaces']['Update']

// 1. Get all workspaces owned by the logged-in user
export async function getWorkspaces() {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
  
  if (error) throw error
  return data
}

// 2. Get a single workspace by ID
export async function getWorkspaceById(id: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

// 3. Create a new workspace (Salon)
export async function createWorkspace(workspace: InsertWorkspace) {
  const { data, error } = await supabase
    .from('workspaces')
    .insert(workspace)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 4. Update an existing workspace's details (e.g., changing salon name, hours, or phone)
export async function updateWorkspace(id: string, updates: UpdateWorkspace) {
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}