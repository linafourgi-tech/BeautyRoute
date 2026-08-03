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

// 5. Request a password reset email. Supabase's own API doesn't reveal
// whether the email is registered here either (no error, no distinct
// response for an unknown email), so callers must never branch on the
// result -- always show the same generic confirmation regardless.
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

// 6. Set a new password. Only succeeds while the caller holds an active
// recovery session (i.e. arrived via a valid, unexpired reset link).
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

// 7. Subscribe to auth state changes -- used by the reset-password page to
// detect the PASSWORD_RECOVERY event Supabase fires once a valid reset
// link has established a recovery session.
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

// 8. Get the current session -- a fallback check alongside
// onAuthStateChange, in case the PASSWORD_RECOVERY event already fired
// before the listener above was attached.
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}