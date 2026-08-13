// Shared, low-risk input-validation helpers for the service layer (Phase
// 12 Security Review, Step 8). None of these change behavior for an
// already-valid request -- they only reject malformed input earlier and
// more clearly than letting it reach Supabase/Postgres unfiltered.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function assertValidUuid(value: unknown, label: string): void {
  if (!isValidUuid(value)) {
    throw new Error(`${label} must be a valid id.`)
  }
}

// Only accepts a well-formed http(s) URL -- rejects javascript:/data:/
// file:/relative paths and any other scheme. Deliberately does not
// restrict to a specific host: this app doesn't own where these images
// are hosted (see services/files.ts), it only rejects non-URL/unsafe
// values before they're persisted and later rendered as an <img src>.
export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// Rejects any key in `updates` that isn't explicitly allowed, instead of
// silently accepting (and forwarding to Supabase) whatever shape the
// caller happens to pass. Every current caller already only ever passes
// allowed keys, so this changes nothing for valid requests -- it only
// turns a future accidental (or malicious) extra field into a clear,
// immediate error instead of a silent pass-through update.
export function assertAllowedFields(
  updates: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(updates).filter((key) => !allowedSet.has(key))
  if (unknown.length > 0) {
    throw new Error(`${context}: field(s) not allowed: ${unknown.join(', ')}`)
  }
}

export function trimIfString<T>(value: T): T | string {
  return typeof value === 'string' ? value.trim() : value
}

// Supabase Auth already treats email matching as case-insensitive
// internally, so lowercasing here doesn't change which account a request
// resolves to -- it just makes that resolution consistent regardless of
// how the caller typed it, and strips accidental leading/trailing
// whitespace that would otherwise silently fail to match a real account.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Only accepts an internal, same-app path as a post-auth-confirmation
// redirect target (e.g. a `?next=/reset-password` query param on the
// /auth/confirm callback route) -- never an absolute URL, a protocol-
// relative URL (`//evil.com`), or anything else that could send a user off
// this app immediately after a real Supabase auth confirmation succeeds.
// That's an open-redirect vector otherwise, since `next` is attacker-
// influenceable (it comes from a URL query string).
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('://')) return false
  return true
}

// The exact set of `type` values Supabase's token_hash-based OTP
// verification accepts for an email link (supabase-js's own EmailOtpType
// union). Validated here before the value -- read straight from the URL's
// `type` query param, so attacker-influenceable -- is forwarded to
// supabase.auth.verifyOtp().
const EMAIL_OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])

export function isEmailOtpType(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_OTP_TYPES.has(value)
}
