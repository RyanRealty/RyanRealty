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
import { classifyLeadSource } from '@/lib/data/crm/leadSourceTaxonomy'
import { SITE_SUBMIT_TAGS } from '@/lib/crm/response-clock'

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

/**
 * The site's own host written as a source ('ryan-realty.com', a preview host,
 * localhost). Every site door wrote this until FUNNEL-4 (2026-09-23): 76 of 88
 * site leads in the 30 days to 2026-09-22 carry it. It names no door, so the
 * reuse path treats it as an empty source and lets the first real door fill it.
 */
export function isSiteHostSource(source: string | null | undefined): boolean {
  const s = String(source ?? '').trim().toLowerCase()
  if (!s) return false
  return /^(?:[a-z0-9-]+\.)*ryan-?realty\.(?:com|vercel\.app)$/.test(s) || /^localhost(?::\d+)?$/.test(s)
}

/**
 * First-touch source on the REUSE path (FUNNEL-4, 2026-09-23). The reuse path
 * used to overwrite crm_people.source with whatever door the person came
 * through last, so an inbound caller who later used the contact form lost
 * 'inbound-call' and every report read the latest door as the origin. Now the
 * column keeps the first door; a later, different door lands as a
 * `source:<door>` tag (the same tag shape a create writes). An empty source,
 * or the bare site host (isSiteHostSource), is not a door and gets filled by
 * the first real one. Pure.
 */
export function reuseSourcePatch(
  existingSource: string | null | undefined,
  incomingSource: string | null | undefined,
): { source?: string; tag?: string } {
  const incoming = String(incomingSource ?? '').trim()
  if (!incoming) return {}
  const existing = String(existingSource ?? '').trim()
  if (existing.toLowerCase() === incoming.toLowerCase()) return {}
  if (!existing || (isSiteHostSource(existing) && !isSiteHostSource(incoming))) return { source: incoming }
  return { tag: `source:${incoming}` }
}

/**
 * Is this person ONLY an outreach-list row (skip-traced expired/FSBO owner,
 * Farm, Import, Sphere), with no sign they came through one of our forms?
 * Those rows never auto-enroll or alert; a person who filled in a site form
 * does. Since FUNNEL-4 crm_people.source is first-touch, so a listed owner who
 * later submits keeps source 'expired-listing-cron' and gains the form's
 * `source:<door>` tag: the tag is the inbound signal. One predicate for the
 * instant path (lib/crm/enroll.ts) and the 15-minute sweep
 * (app/api/cron/crm-auto-enroll). Pure.
 */
export function isOutreachListOnly(
  source: string | null | undefined,
  tags: readonly string[] | null | undefined,
): boolean {
  if (!classifyLeadSource(source ?? null).outreachList) return false
  const lowered = (tags ?? []).map((t) => String(t).trim().toLowerCase())
  return !lowered.some((t) => (SITE_SUBMIT_TAGS as readonly string[]).includes(t))
}
