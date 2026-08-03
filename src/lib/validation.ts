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
