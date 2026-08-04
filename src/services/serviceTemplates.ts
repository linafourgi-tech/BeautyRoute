import { supabase } from '../lib/supabase'

// Phase 13 Step 4: narrowed from select('*') after verifying both current
// consumers (onboarding/steps/ServicesStep.jsx, Services.jsx's "Import
// templates" flow) -- neither reads color_hex, description, is_active, or
// created_at. display_order is still usable as an ORDER BY key below
// without being in the SELECT list (PostgREST doesn't require it).
const SERVICE_TEMPLATE_COLUMNS = 'id, name, category, default_duration, default_price'

// 1. Get the global starter service catalog (not workspace-scoped, read-only for everyone)
export async function getServiceTemplates() {
  const { data, error } = await supabase
    .from('service_templates')
    .select(SERVICE_TEMPLATE_COLUMNS)
    .order('category')
    .order('display_order')

  if (error) throw error
  return data
}
