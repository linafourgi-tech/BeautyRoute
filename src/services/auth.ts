import { supabase } from '../lib/supabase'

// 1. Sign up a new user (Salon owner / Manager)
export async function signUpUser(email: string, password: string, metadata: Record<string, unknown> = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })

  if (error) throw error
  return data
}

// 2. Log in an existing user
export async function signInUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

// 3. Log out the current user
export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// 4. Get the currently logged-in user session
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}