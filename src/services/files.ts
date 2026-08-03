import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase-types'
import { assertValidUuid, isValidHttpUrl } from '../lib/validation'

type InsertFile = Database['public']['Tables']['files']['Insert']

// 1. Get files attached to a specific record (e.g. entity_type='visit', entity_id=visit.id)
export async function getFilesForEntity(entityType: string, entityId: string) {
  assertValidUuid(entityId, 'Entity id')
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
// pass an already-hosted URL rather than a local file). file_url is
// validated as a well-formed http(s) URL before it's persisted -- this
// table's rows get rendered back as <img src={file_url}>, so anything
// other than a real http(s) URL has no legitimate reason to be stored here.
export async function createFile(file: InsertFile) {
  if (!isValidHttpUrl(file.file_url)) {
    throw new Error('file_url must be a valid http(s) URL.')
  }
  assertValidUuid(file.workspace_id, 'Workspace id')
  assertValidUuid(file.entity_id, 'Entity id')

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
  assertValidUuid(id, 'File id')
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (error) throw error
}
