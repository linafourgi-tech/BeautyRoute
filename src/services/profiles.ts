import { supabase } from '../lib/supabase'
import { assertAllowedFields, assertValidUuid, isValidHttpUrl, trimIfString } from '../lib/validation'

const UPDATABLE_PROFILE_FIELDS = ['full_name', 'phone', 'avatar_url'] as const

// 1. Get a single profile by id
export async function getProfile(id: string) {
  assertValidUuid(id, 'Profile id')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// 2. Update a profile (e.g. during onboarding: full_name, phone, avatar_url).
// Only these three columns may ever be set here -- anything else (role,
// id, timestamps) is rejected outright rather than silently forwarded.
export async function updateProfile(id: string, updates: Record<string, unknown>) {
  assertValidUuid(id, 'Profile id')
  assertAllowedFields(updates, UPDATABLE_PROFILE_FIELDS, 'updateProfile')

  const normalized: Record<string, unknown> = { ...updates }
  if ('full_name' in normalized) normalized.full_name = trimIfString(normalized.full_name)
  if ('phone' in normalized) normalized.phone = trimIfString(normalized.phone)
  if ('avatar_url' in normalized && normalized.avatar_url != null && !isValidHttpUrl(normalized.avatar_url)) {
    throw new Error('avatar_url must be a valid http(s) URL.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(normalized)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
