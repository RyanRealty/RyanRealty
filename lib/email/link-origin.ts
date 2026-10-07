/**
 * The origin every link and image inside an outbound email points at.
 *
 * Production's NEXT_PUBLIC_SITE_URL is the Vercel alias, so tracked clicks,
 * the open pixel and unsubscribe links in every email went out on the alias
 * host while the mail itself came from ryan-realty.com. A sender domain and a
 * link domain that do not match is a phishing signal to Outlook and Gmail, and
 * the alias is what a reader sees on hover (Matt 2026-10-07, the Keats email).
 *
 * The global variable stays as it is: canonicals, auth fallbacks, crons and
 * PDF renders read it, and moving them is the site cutover, not this. Only
 * email links resolve here: the production hosts become the canonical origin,
 * and any other host (a preview, localhost) is kept, so a test send never
 * points at production with a secret production does not hold.
 */

export const CANONICAL_EMAIL_ORIGIN = 'https://ryan-realty.com'

/** Hosts that ARE production. The alias serves /api/* and files but 308s every page to the apex. */
const PRODUCTION_HOSTS = new Set([
  'ryan-realty.com',
  'www.ryan-realty.com',
  'ryanrealty.vercel.app', // staging-host-ok: the production alias being mapped AWAY from
])

export function emailLinkOrigin(raw: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = (raw ?? '').trim()
  if (!value) return CANONICAL_EMAIL_ORIGIN
  try {
    const u = new URL(value)
    return PRODUCTION_HOSTS.has(u.hostname.toLowerCase()) ? CANONICAL_EMAIL_ORIGIN : u.origin
  } catch {
    return CANONICAL_EMAIL_ORIGIN
  }
}

/**
 * Point a synced Gmail signature's production-alias URLs (headshot, logo,
 * links) at the canonical origin. Gmail stores the signature as the broker
 * installed it; this changes only the host, never a path or a word.
 */
export function canonicalizeEmailHosts(html: string): string {
  return html.replace(/https?:\/\/ryanrealty\.vercel\.app(?=[/"'\s?#)]|$)/gi, CANONICAL_EMAIL_ORIGIN)
}
