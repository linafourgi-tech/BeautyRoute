import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/validation'

// 1. Sign up a new user (Salon owner / Manager)
export async function signUpUser(email: string, password: string, metadata: Record<string, unknown> = {}) {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: metadata },
  })

  if (error) throw error
  return data
}

// 2. Log in an existing user
export async function signInUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
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
//
// Routed through the shared /auth/confirm callback (with ?next telling it
// where to continue afterwards) rather than straight to /reset-password.
// Supabase's actual recovery-link format (token_hash+type, a PKCE code, or
// the legacy #access_token fragment) isn't something this app controls or
// can rely on staying constant -- /auth/confirm is the one place that
// handles all of them, so this must go through it too instead of assuming
// ResetPassword.jsx's own page can parse whatever link Supabase happens to
// send directly.
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
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

// 9. Confirm an email-based auth link (magic link, password recovery,
// signup confirmation, invite, email change) using Supabase's token_hash +
// type verification -- the format Supabase's default hosted email
// templates currently use. Used by the /auth/confirm callback route, not
// called directly from any form.
export async function verifyAuthOtp(tokenHash: string, type: EmailOtpType) {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) throw error
  return data
}

// 10. Confirm an email-based auth link delivered via the PKCE `code` query
// param instead of token_hash. Also used by /auth/confirm -- which format
// actually shows up depends on Supabase project/template settings this
// codebase doesn't control, so both must be supported.
export async function exchangeAuthCode(code: string) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
  return data
}