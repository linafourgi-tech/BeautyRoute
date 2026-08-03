import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'
import { assertAllowedFields, assertValidUuid } from '../lib/validation'

type InsertWorkspace = Database['public']['Tables']['workspaces']['Insert']
type UpdateWorkspace = Database['public']['Tables']['workspaces']['Update']

// Deliberately excludes plan_tier, subscription_status, trial_started_at,
// trial_ends_at, owner_id, slug, id, created_at, updated_at -- none of
// those should ever be settable through a generic "update workspace
// details" call. There is no current caller of updateWorkspace() yet (no
// business-settings UI exists), so this is a forward-looking guard rather
// than a change to any existing behavior.
const UPDATABLE_WORKSPACE_FIELDS = [
  'name',
  'display_brand',
  'timezone',
  'currency',
  'locale',
  'city',
  'district',
  'business_type',
] as const

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
  assertValidUuid(id, 'Workspace id')
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
  assertValidUuid(id, 'Workspace id')
  assertAllowedFields(updates as Record<string, unknown>, UPDATABLE_WORKSPACE_FIELDS, 'updateWorkspace')

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
    p_business_name: businessName.trim(),
    p_business_type: businessType,
    p_city: city.trim(),
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
  assertValidUuid(workspaceId, 'Workspace id')
  const { error } = await supabase.rpc('delete_workspace', { p_workspace_id: workspaceId })
  if (error) throw error
}

const UPDATABLE_WORKSPACE_SETTINGS_FIELDS = [
  'theme_config',
  'business_hours',
  'booking_rules',
  'notification_triggers',
  'billing_meta',
  'social_links',
] as const

// 7. Update a workspace's settings row (e.g. business_hours during onboarding)
export async function updateWorkspaceSettings(workspaceId: string, updates: Record<string, unknown>) {
  assertValidUuid(workspaceId, 'Workspace id')
  assertAllowedFields(updates, UPDATABLE_WORKSPACE_SETTINGS_FIELDS, 'updateWorkspaceSettings')

  const { data, error } = await supabase
    .from('workspace_settings')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) throw error
  return data
}