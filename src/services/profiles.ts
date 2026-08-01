import { supabase } from '../lib/supabase'

// 1. Get a single profile by id
export async function getProfile(id: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// 2. Update a profile (e.g. during onboarding: full_name, phone, avatar_url)
export async function updateProfile(id: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
