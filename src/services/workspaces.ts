import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

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

// 5. One-time onboarding bootstrap: creates the workspace, the caller's
// workspace_staff membership, and a default workspace_settings row, and
// starts the trial period. See bootstrap_professional_workspace() in
// supabase/migrations/20260724130000_professional_onboarding.sql. Guarded
// server-side to run at most once per profile. Returns the new workspace id.
export async function bootstrapWorkspace(businessName: string, businessType: string, city: string) {
  const { data, error } = await supabase.rpc('bootstrap_professional_workspace', {
    p_business_name: businessName,
    p_business_type: businessType,
    p_city: city,
  })

  if (error) throw error
  return data as string
}

// 6. Permanently delete a workspace and everything scoped to it, in a
// single safe, ordered, auditable operation. See delete_workspace() in
// supabase/migrations/20260803120000_safe_workspace_deletion.sql -- the
// database function enforces that only the workspace's owner can call this
// successfully (any other caller, or a stale/non-owner session, gets a
// thrown error and no rows are touched).
export async function deleteWorkspace(workspaceId: string) {
  const { error } = await supabase.rpc('delete_workspace', { p_workspace_id: workspaceId })
  if (error) throw error
}

// 7. Update a workspace's settings row (e.g. business_hours during onboarding)
export async function updateWorkspaceSettings(workspaceId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('workspace_settings')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) throw error
  return data
}