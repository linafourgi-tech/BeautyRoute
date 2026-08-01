import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type Service = Database['public']['Tables']['services']['Row']
type InsertService = Database['public']['Tables']['services']['Insert']
type UpdateService = Database['public']['Tables']['services']['Update']

// 1. Get the menu of services for a specific salon workspace
export async function getServices(workspaceId: string) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })
  
  if (error) throw error
  return data
}

// 2. Add a new service type to the menu
export async function createService(service: InsertService) {
  const { data, error } = await supabase
    .from('services')
    .insert(service)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 3. Update an existing service (like changing the price or time duration)
export async function updateService(id: string, updates: UpdateService) {
  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 4. Delete/remove a service from the active menu
export async function deleteService(id: string) {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 5. Copy starter service_templates into a workspace's own services (onboarding)
export async function importServiceTemplates(workspaceId: string, templateIds: string[]) {
  const { data, error } = await supabase.rpc('import_service_templates', {
    p_workspace_id: workspaceId,
    p_template_ids: templateIds,
  })

  if (error) throw error
  return data as number
}