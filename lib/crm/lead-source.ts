/**
 * Maps a captured utm_source/utm_medium pair to a clean, human-readable
 * channel label for crm_people.source, and builds the structured paid-channel
 * attribution tags (channel:*, campaign:*, ad-content:*).
 *
 * Every lead landing page was parsing utm_source correctly off the referer
 * but then discarding it — crm_people.source got a hardcoded site-domain
 * string regardless of traffic origin, and sendEvent() never read the
 * `campaign` object it was handed (dead param). That made
 * "how many leads came from Facebook" mechanically unanswerable: the query
 * `source ILIKE '%facebook%'` was guaranteed zero rows no matter how many
 * people actually converted from a Meta ad. Fixed 2026-07-09.
 */

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  fb: 'Facebook',
  instagram: 'Instagram',
  ig: 'Instagram',
  google: 'Google',
  bing: 'Bing',
  newsletter: 'Newsletter',
  gbp: 'Google Business Profile',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  x: 'X',
  twitter: 'X',
  youtube: 'YouTube',
}

/**
 * Resolve the crm_people.source value for a lead. `fallback` is the LP's own
 * default label (e.g. 'seller-lp') used when there's no utm_source (direct
 * traffic, organic search, a typed-in URL) — preserves prior behavior for
 * non-paid traffic instead of writing a raw utm_source string.
 */
export function resolveLeadSource(utmSource: string | undefined, fallback: string): string {
  const key = utmSource?.trim().toLowerCase()
  if (!key) return fallback
  return SOURCE_LABELS[key] ?? (utmSource!.trim().charAt(0).toUpperCase() + utmSource!.trim().slice(1))
}

function slugifyTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Structured paid-channel attribution tags for a lead. channel:<n> covers
 * "which platform," campaign:<n> covers "which campaign," ad-content:<n>
 * covers "which specific ad/creative" (from utm_content) — the granularity
 * needed to answer "how many people who saw ad X actually converted."
 */
export function resolvePaidAttributionTags(params: {
  utmSource?: string
  utmCampaign?: string
  utmContent?: string
}): string[] {
  const key = params.utmSource?.trim().toLowerCase()
  if (!key) return []
  const tags: string[] = [`channel:${key === 'fb' ? 'fb-ads' : key === 'facebook' ? 'fb-ads' : `${slugifyTag(key)}-ads`}`]
  if (params.utmCampaign) tags.push(`campaign:${slugifyTag(params.utmCampaign)}`)
  if (params.utmContent) tags.push(`ad-content:${slugifyTag(params.utmContent)}`)
  return tags
}
