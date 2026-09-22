/**
 * Pull a usable profile-photo URL off a Supabase Auth user.
 *
 * WHY THE LETTER CIRCLE SHOWS. Chrome renders `viewer.avatar_url`. If this
 * function returns null, V3Chrome paints a navy initial instead of the Google
 * picture. That happened in two ways:
 *
 * 1. Only `identities[0]` was read. A Google-signed-in account that later
 *    picked up an email identity (or whose providers arrived email-first)
 *    stored the picture on the Google identity, not slot 0. Matt: it worked,
 *    then stopped.
 * 2. The URL was present but the <img> sent a Referer. Google's
 *    lh3.googleusercontent.com host 403s those requests, so the picture
 *    never painted. Chrome must set referrerPolicy="no-referrer" on the img.
 *
 * Walk metadata first (Supabase copies Google's picture there on a clean
 * Google-only sign-in), then every identity, Google preferred.
 */
export function normalizeAvatarUrl(user: {
  user_metadata?: Record<string, unknown> | null
  identities?: Array<{
    provider?: string
    identity_data?: Record<string, unknown> | null
  }> | null
}): string | null {
  const fromMeta = firstHttpUrl(
    user.user_metadata?.avatar_url,
    user.user_metadata?.picture,
    user.user_metadata?.avatarUrl,
  )
  if (fromMeta) return fromMeta

  const identities = user.identities ?? []
  const ranked = [
    ...identities.filter((identity) => isGoogleIdentity(identity)),
    ...identities.filter((identity) => !isGoogleIdentity(identity)),
  ]
  for (const identity of ranked) {
    const data = identity.identity_data
    const found = firstHttpUrl(data?.avatar_url, data?.picture, data?.avatarUrl)
    if (found) return found
  }
  return null
}

function isGoogleIdentity(identity: {
  provider?: string
  identity_data?: Record<string, unknown> | null
}): boolean {
  if (identity.provider === 'google') return true
  const iss = identity.identity_data?.iss
  return typeof iss === 'string' && iss.includes('google')
}

function firstHttpUrl(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
  }
  return null
}
