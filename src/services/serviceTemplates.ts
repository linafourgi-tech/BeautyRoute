import { supabase } from '../lib/supabase'

// 1. Get the global starter service catalog (not workspace-scoped, read-only for everyone)
export async function getServiceTemplates() {
  const { data, error } = await supabase
    .from('service_templates')
    .select('*')
    .order('category')
    .order('display_order')

  if (error) throw error
  return data
}
