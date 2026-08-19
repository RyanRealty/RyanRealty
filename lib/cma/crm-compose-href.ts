/**
 * Deep link from a CMA into CRM compose on the person page.
 * Send happens in EmailComposer / SmsComposer — not Gmail, not mailto.
 */

export function cmaCrmComposeHref(opts: {
  personId: number
  slug: string
  channel?: 'email' | 'sms'
}): string {
  const personId = Number(opts.personId)
  const slug = opts.slug.trim().toLowerCase()
  if (!Number.isFinite(personId) || personId <= 0 || !slug) return '/admin/people'
  const params = new URLSearchParams()
  params.set('composeCma', slug)
  params.set('replyChannel', opts.channel === 'sms' ? 'sms' : 'email')
  return `/admin/people/${personId}?${params.toString()}#comms`
}
