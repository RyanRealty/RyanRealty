/**
 * CMA send doors.
 *
 * Primary path: Review EmailBodyEditor on /admin/cmas/[slug].
 * People compose (`composeCma`) is secondary — only for in-person deep links
 * that already have a valid person + slug. Never hop to /admin/people List
 * with Template Blank / empty subject+body.
 */

/** Review outbound dock — EmailBodyEditor prefilled. Never People Blank. */
export function cmaReviewSendHref(slug: string): string | null {
  const s = String(slug ?? '').trim().toLowerCase()
  if (!s) return null
  // UUIDs are delivery ids, not review slugs — refuse so we never 404 / Blank.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null
  return `/admin/cmas/${s}`
}

/**
 * Deep link into person-page compose (secondary). Returns null when inputs
 * cannot prefill — callers must not fall back to /admin/people List.
 */
export function cmaCrmComposeHref(opts: {
  personId: number
  slug: string
  channel?: 'email' | 'sms'
}): string | null {
  const personId = Number(opts.personId)
  const slug = String(opts.slug ?? '').trim().toLowerCase()
  if (!Number.isFinite(personId) || personId <= 0 || !slug) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) return null
  const params = new URLSearchParams()
  params.set('composeCma', slug)
  params.set('replyChannel', opts.channel === 'sms' ? 'sms' : 'email')
  return `/admin/people/${personId}?${params.toString()}#comms`
}
