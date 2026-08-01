import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'

type InsertFile = Database['public']['Tables']['files']['Insert']

// 1. Get files attached to a specific record (e.g. entity_type='visit', entity_id=visit.id)
export async function getFilesForEntity(entityType: string, entityId: string) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// 2. Attach a file reference (file_url must already point somewhere real --
// there's no Supabase Storage upload pipeline in this app yet, so callers
// pass an already-hosted URL rather than a local file)
export async function createFile(file: InsertFile) {
  const { data, error } = await supabase
    .from('files')
    .insert(file)
    .select()
    .single()

  if (error) throw error
  return data
}

// 3. Remove a file reference
export async function deleteFile(id: string) {
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (error) throw error
}
