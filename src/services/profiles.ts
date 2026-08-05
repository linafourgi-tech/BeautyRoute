import { supabase } from '../lib/supabase'
import { assertAllowedFields, assertValidUuid, isValidHttpUrl, trimIfString } from '../lib/validation'

const UPDATABLE_PROFILE_FIELDS = ['full_name', 'phone', 'avatar_url'] as const

// Phase 13 Step 4: narrowed from select('*') after verifying every current
// consumer (useSession()/SessionContext, Login.jsx) -- only full_name,
// phone, and onboarding_completed are ever read; avatar_url is kept
// deliberately even though nothing displays it yet (it's a real,
// recently-hardened settable field -- see updateProfile()'s validation --
// not dead/vestigial, so excluding it would be a speculative guess, not a
// verified narrowing). role/created_at/updated_at are confirmed unread
// anywhere in the frontend.
const PROFILE_COLUMNS = 'id, full_name, phone, avatar_url, onboarding_completed'

// 1. Get a single profile by id
export async function getProfile(id: string) {
  assertValidUuid(id, 'Profile id')
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
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
