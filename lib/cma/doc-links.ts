/**
 * Every address, place and next step in a CMA document is a link back into
 * ryan-realty.com, and every tap is tracked to the person AND to the document.
 *
 * Matt 2026-09-07: "everything should be linking back to my website, so if they
 * want to learn more about a comp etc, this must be tracked."
 *
 * ONE function builds every link in the document. It composes helpers that
 * already exist rather than hand-writing a URL:
 *
 *   listing → `listingTileHref` (lib/slug.ts) — the ONE canonical listing href
 *             builder the whole site uses, the one `ci:canonical-listings`
 *             guards the card around. A hand-built /listing/<key> would open a
 *             page that immediately redirects, losing the query string and with
 *             it the identity we just stamped.
 *   place   → `cmaSubdivisionHref` / `cmaCommunityHref` / `cmaCityHref`
 *             (lib/cma/cma-place-links.ts), which own the registry aliasing and
 *             the marketing→area redirects.
 *   market  → `reportsExploreYtdPath` (lib/slug.ts).
 *   search  → `homesForSalePath` / `publishRegionalSearchHref`.
 *
 * The five stamped params:
 *   agent=<brokerSlug>   routes the lead to the broker whose document this is
 *                        (AgentAttributionBridge writes the 90-day cookie).
 *   _pid=<crm_people.id> stitches the browser session to the contact
 *                        (PersonIdentityBridge → /api/track/e/identify), the
 *                        same param `attributeSiteLinks` stamps on email links.
 *   utm_source=cma
 *   utm_medium=document
 *   utm_campaign=<cmaSlug>  which DOCUMENT the tap came out of. Without it a
 *                        visit to a comp is an anonymous listing view; with it
 *                        `getCmaOutcomes` can count the tap as a visit for that
 *                        CMA and show the broker which comps were opened.
 *
 * NULL-SAFE BY CONSTRUCTION. Every kind has a working fallback and the function
 * returns a string, never null: a comp with no listing key gets a place-scoped
 * search, an unmapped place gets its city, an unpublished city gets the market
 * hub. A document must never print a dead link, and it must never print a link
 * that is silently un-tracked either — which is why the fallback still carries
 * the same five params.
 */

import {
  homesForSalePath,
  listingTileHref,
  reportsExploreYtdPath,
  slugify,
} from '@/lib/slug'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  cmaCityHref,
  cmaCommunityHref,
  cmaNeighborhoodHref,
  cmaSubdivisionHref,
} from '@/lib/cma/cma-place-links'

/**
 * The production origin, hard-coded on purpose. This URL is printed into a PDF
 * that lands in a stranger's inbox and outlives every deploy; a preview host
 * from NEXT_PUBLIC_SITE_URL baked into a sent document is a dead link forever.
 */
export const CMA_DOC_ORIGIN = 'https://ryan-realty.com'

export const CMA_DOC_UTM_SOURCE = 'cma'
export const CMA_DOC_UTM_MEDIUM = 'document'

export type TrackedDocLinkKind = 'listing' | 'place' | 'market' | 'search' | 'book' | 'site'

export type TrackedDocLinkCtx = {
  /** brokers slug for ?agent= — the broker whose document this is. */
  brokerSlug?: string | null
  /** crm_people.id for ?_pid= — the recipient this copy was built for. */
  personId?: number | null
  /** cmas.slug for ?utm_campaign= — WHICH document the tap came out of. */
  cmaSlug: string
}

/** A comp / competing listing as `render_args` carries it. */
export type TrackedListingTarget = {
  /** MLS `ListingKey` / `listing_key`. */
  listingKey?: string | null
  /** MLS number (`ListNumber`) — preferred in the canonical URL segment. */
  mlsNumber?: string | null
  /** Combined street line as the comp stores it, e.g. "1299 Ogden". */
  address?: string | null
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  subdivision?: string | null
  neighborhood?: string | null
}

/** A place, however much of it the caller happens to know. */
export type TrackedPlaceTarget = {
  city?: string | null
  subdivisionName?: string | null
  subdivisionSlug?: string | null
  communityName?: string | null
  communitySlug?: string | null
  neighborhoodSlug?: string | null
}

export type TrackedDocLinkTarget =
  | string
  | TrackedListingTarget
  | TrackedPlaceTarget
  | null
  | undefined

/** MLS sentinels that are the absence of a value, not a place. */
const MLS_MISSING = /^(n\/?a|none|null|undefined|—|-|other|not available|unknown)$/i

function clean(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  if (!s) return null
  return MLS_MISSING.test(s) ? null : s
}

function isObj(t: TrackedDocLinkTarget): t is Record<string, unknown> {
  return typeof t === 'object' && t !== null
}

/** "1299 Ogden" → { streetNumber: '1299', streetName: 'Ogden' }. */
function splitStreet(t: TrackedListingTarget): { streetNumber: string | null; streetName: string | null } {
  const number = clean(t.streetNumber)
  const name = clean(t.streetName)
  if (number || name) return { streetNumber: number, streetName: name }
  const address = clean(t.address)
  if (!address) return { streetNumber: null, streetName: null }
  const m = address.match(/^(\d[\dA-Za-z-]*)\s+(.+)$/)
  if (m) return { streetNumber: m[1]!, streetName: m[2]! }
  return { streetNumber: null, streetName: address }
}

// ── path resolution, one function per kind ───────────────────────────────────

/** Place-scoped search: the tightest working page we can name for an address. */
function searchPath(city: string | null, subdivision: string | null): string {
  if (!city) return publishRegionalSearchHref()
  return homesForSalePath(city, subdivision)
}

function listingPath(target: TrackedDocLinkTarget): string {
  if (typeof target === 'string') {
    const key = clean(target)
    return key ? listingTileHref({ listingKey: key }) : publishRegionalSearchHref()
  }
  if (!isObj(target)) return publishRegionalSearchHref()
  const t = target as TrackedListingTarget
  const listingKey = clean(t.listingKey)
  const mlsNumber = clean(t.mlsNumber)
  const city = clean(t.city)
  const subdivision = clean(t.subdivision)
  // No id at all — there is no listing page to open. A place-scoped search is
  // the honest destination; a /listing/ URL built from an address is a 404.
  if (!listingKey && !mlsNumber) return searchPath(city, subdivision)
  const { streetNumber, streetName } = splitStreet(t)
  return listingTileHref({
    listingKey: listingKey ?? mlsNumber,
    listNumber: mlsNumber,
    streetNumber,
    streetName,
    city,
    boundaryNeighborhood: clean(t.neighborhood),
    subdivisionName: subdivision,
  })
}

function placePath(target: TrackedDocLinkTarget): string {
  if (typeof target === 'string') {
    const slug = clean(target)
    return (slug ? cmaSubdivisionHref(slug) : null) ?? publishRegionalSearchHref()
  }
  if (!isObj(target)) return publishRegionalSearchHref()
  const t = target as TrackedPlaceTarget
  const city = clean(t.city)
  const href =
    cmaNeighborhoodHref(city, clean(t.neighborhoodSlug)) ??
    cmaSubdivisionHref(clean(t.subdivisionSlug)) ??
    cmaSubdivisionHref(clean(t.subdivisionName)) ??
    cmaCommunityHref(clean(t.communitySlug)) ??
    cmaCommunityHref(clean(t.communityName)) ??
    cmaCityHref(city)
  return href ?? searchPath(city, null)
}

function marketPath(target: TrackedDocLinkTarget): string {
  const city = typeof target === 'string' ? clean(target) : isObj(target) ? clean((target as TrackedPlaceTarget).city) : null
  if (!city) return '/housing-market'
  // dynamicParams is true on /housing-market/[...slug], so an unpublished city
  // would render a 404 rather than fail here. The hub is a real page.
  if (!CENTRAL_OREGON_CITY_SLUGS.has(slugify(city))) return '/housing-market'
  return reportsExploreYtdPath(city)
}

function searchTargetPath(target: TrackedDocLinkTarget): string {
  if (typeof target === 'string') return searchPath(clean(target), null)
  if (!isObj(target)) return publishRegionalSearchHref()
  const t = target as TrackedListingTarget & TrackedPlaceTarget
  return searchPath(clean(t.city), clean(t.subdivision) ?? clean(t.subdivisionName))
}

function sitePath(target: TrackedDocLinkTarget): string {
  const raw = typeof target === 'string' ? target.trim() : ''
  if (!raw) return '/'
  try {
    // Absolute input: keep it ONLY when it is already our own origin. A
    // document must not carry a link off ryan-realty.com under our stamp.
    const u = new URL(raw, CMA_DOC_ORIGIN)
    if (u.hostname.replace(/^www\./, '') !== 'ryan-realty.com') return '/'
    return u.pathname + u.search + u.hash
  } catch {
    return '/'
  }
}

function pathFor(kind: TrackedDocLinkKind, target: TrackedDocLinkTarget): string {
  switch (kind) {
    case 'listing':
      return listingPath(target)
    case 'place':
      return placePath(target)
    case 'market':
      return marketPath(target)
    case 'search':
      return searchTargetPath(target)
    case 'book':
      return '/book'
    case 'site':
      return sitePath(target)
    default:
      return '/'
  }
}

// ── the one exported builder ─────────────────────────────────────────────────

/**
 * Absolute, identity-carrying, campaign-tagged ryan-realty.com URL for one
 * link in one CMA document.
 *
 * @param kind   what the reader is being taken to
 * @param target the listing (key / MLS / comp object), place slug, city, or path
 * @param ctx    who the document is for and which document it is
 */
export function trackedDocLink(
  kind: TrackedDocLinkKind,
  target: TrackedDocLinkTarget,
  ctx: TrackedDocLinkCtx,
): string {
  // Helpers in cma-place-links return ABSOLUTE urls, built on
  // NEXT_PUBLIC_SITE_URL (the vercel.app preview host in every environment but
  // production) and already stamped with their own legacy
  // `utm_source=crm&utm_medium=doc&utm_campaign=cma-letter`. Reduce whatever
  // comes back to its path and rebuild it on the production origin, then
  // OVERWRITE the utm params rather than appending: one link, one host, one
  // campaign — and the campaign this document reads back is its own slug.
  const resolved = new URL(pathFor(kind, target), CMA_DOC_ORIGIN)
  const url = new URL(resolved.pathname + resolved.search + resolved.hash, CMA_DOC_ORIGIN)

  const broker = clean(ctx.brokerSlug)
  if (broker) url.searchParams.set('agent', broker)

  const pid = ctx.personId
  if (typeof pid === 'number' && Number.isInteger(pid) && pid > 0) {
    url.searchParams.set('_pid', String(pid))
  }

  url.searchParams.set('utm_source', CMA_DOC_UTM_SOURCE)
  url.searchParams.set('utm_medium', CMA_DOC_UTM_MEDIUM)
  const campaign = clean(ctx.cmaSlug)
  if (campaign) url.searchParams.set('utm_campaign', campaign.toLowerCase())
  else url.searchParams.delete('utm_campaign')

  return url.toString()
}

/**
 * The document slug out of an arrival URL — the read half of the stamp above.
 *
 * A CMA slug always starts `cma-` (lib/cma/address-slug.ts builds it), so the
 * prefix is what separates a document campaign from a newsletter or ad
 * campaign. Returns null for anything else, which is what keeps an unrelated
 * `utm_campaign` from being counted as a visit to somebody's report.
 */
export function cmaCampaignFromUrl(pageUrl: string | null | undefined): string | null {
  const raw = typeof pageUrl === 'string' ? pageUrl.trim() : ''
  if (!raw) return null
  let campaign: string | null = null
  try {
    campaign = new URL(raw, CMA_DOC_ORIGIN).searchParams.get('utm_campaign')
  } catch {
    return null
  }
  const slug = (campaign ?? '').trim().toLowerCase()
  if (!slug.startsWith('cma-')) return null
  return /^[a-z0-9-]{4,120}$/.test(slug) ? slug : null
}
