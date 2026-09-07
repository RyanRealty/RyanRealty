/**
 * Every link out of the seller document, carrying who it was sent to.
 *
 * Matt 2026-09-07: "everything should be linking back to my website, so if
 * they want to learn more about a comp etc, this must be tracked."
 * Contract: docs/plans/CMA_REIMAGINED_2026-09-07.md § Links and tracking.
 *
 * One function on purpose. Stream R4 owns the full version; this one is
 * deliberately minimal so replacing it is a one-file merge.
 *
 * The listing URL comes from `listingTileHref`, the site's canonical listing
 * href builder, never hand-built — a hand-built /listing/<key> is a redirect
 * at best and a 404 at worst, and it is the one link a seller is most likely
 * to tap.
 */

import { homesForSalePath, listingTileHref, listingsBrowsePath, slugify } from '@/lib/slug'

/**
 * PINNED, not read from the environment.
 *
 * This URL goes into a document that is emailed to a homeowner and lives in
 * their inbox for months. `NEXT_PUBLIC_SITE_URL` is the preview host on every
 * non-production build — a look-pass on this machine renders
 * `ryanrealty.vercel.app`, which strips the auth cookie and is not a link we
 * ever want a seller to tap. A delivered document links to the production
 * domain or it does not link.
 */
const SITE_URL = 'https://ryan-realty.com'

export type TrackedDocLinkKind = 'listing' | 'place' | 'market' | 'search' | 'book' | 'site'

/**
 * Who this document went to. Every field is optional: a link still works
 * without identity, it just cannot be stitched to a person.
 */
export type TrackedDocLinkCtx = {
  brokerSlug?: string | null
  personId?: number | string | null
  cmaSlug?: string | null
}

/**
 * What to link to.
 *
 * - `listing` takes the tile-shaped fields the canonical builder needs. A bare
 *   string is accepted and degrades to the still-valid
 *   /homes-for-sale/listing/<id> form rather than a 404.
 * - `place` takes a path already resolved by the place resolver, or a city name.
 * - `market`, `search` take a city name.
 * - `book` takes nothing. `site` takes a path.
 */
export type TrackedDocLinkTarget =
  | string
  | {
      listingKey?: string | null
      listNumber?: string | null
      streetNumber?: string | null
      streetName?: string | null
      city?: string | null
      boundaryCity?: string | null
      boundaryNeighborhood?: string | null
      subdivisionName?: string | null
    }

function pathFor(kind: TrackedDocLinkKind, target: TrackedDocLinkTarget): string {
  if (kind === 'book') return '/book'
  if (kind === 'listing') {
    if (typeof target === 'string') {
      const id = target.trim()
      return id ? `/homes-for-sale/listing/${encodeURIComponent(id)}` : listingsBrowsePath()
    }
    return listingTileHref(target)
  }
  const name = typeof target === 'string' ? target.trim() : ''
  if (kind === 'site' || (kind === 'place' && name.startsWith('/'))) {
    return name.startsWith('/') ? name : `/${name}`
  }
  if (!name) return kind === 'market' ? '/housing-market' : listingsBrowsePath()
  if (kind === 'market') return `/housing-market/${slugify(name)}`
  if (kind === 'place') return `/cities/${slugify(name)}`
  return homesForSalePath(name)
}

/**
 * An absolute ryan-realty.com URL carrying the identity the site's visitor
 * tracker stitches to the session, so a tap on a sale shows on the person's
 * timeline and in this document's outcomes.
 *
 * Nothing personal rides in the query beyond the internal person id the
 * tracker already uses — no name, no email, no address.
 */
export function trackedDocLink(
  kind: TrackedDocLinkKind,
  target: TrackedDocLinkTarget,
  ctx: TrackedDocLinkCtx = {},
): string {
  const url = new URL(pathFor(kind, target), `${SITE_URL}/`)
  const broker = String(ctx.brokerSlug ?? '').trim()
  const person = String(ctx.personId ?? '').trim()
  const campaign = String(ctx.cmaSlug ?? '').trim()
  if (broker) url.searchParams.set('agent', broker)
  if (person) url.searchParams.set('_pid', person)
  url.searchParams.set('utm_source', 'cma')
  url.searchParams.set('utm_medium', 'document')
  if (campaign) url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}
