/**
 * The listing-canonical hop (P14, visibility audit 2026-09-22, gsc-trend-6).
 *
 * THE DEFECT
 * ----------
 * A listing page resolves its home from the MLS number at the END of the path
 * and ignores every segment in front of it, so any city and any area segments
 * render the same listing with HTTP 200 and a rel=canonical. Every time the URL
 * builder or the boundary classifier changed, the canonical moved and the old
 * URL kept answering 200. Search Console, 2026-08-23..2026-09-19: 1,234 of
 * 7,329 listing ids (16.8%) were shown under more than one URL, holding 11,694
 * of 31,942 listing-detail impressions; 690 of them had an /outside-boundaries/
 * variant. In June the rate was 6.6%. A rel=canonical is a hint Google weighs
 * against everything else it sees; a 308 is an instruction.
 *
 * THE FIX, in two halves
 *   1. lib/slug.ts listingTileHref builds the path from MLS fields only, so a
 *      polygon reclassification can never move it again.
 *   2. This module: every request path whose trailing key resolves to a
 *      displayable listing, and which is not that listing's canonical path,
 *      gets a 308 to the canonical before anything renders.
 *
 * WHY MIDDLEWARE AND NOT THE PAGE: app/loading.tsx wraps every route, so a
 * redirect thrown from the page body ships a 200 shell (ci:streamed-redirect).
 * The by-key route handler can 308 because it renders nothing; the pretty URL
 * must render, so the decision has to be made above it.
 *
 * WHAT IS NEVER TOUCHED
 *   - A key that does not resolve, or resolves to a row we may not display
 *     (IDX opt-out, Coming Soon): no hop. The page renders its refusal exactly
 *     as before. A real listing is never 404'd by this module.
 *   - A lookup that errors or times out: no hop.
 *   - The key-form path /homes-for-sale/listing/<id>: that URL is itself a hop
 *     (app/listing/by-key), and a listing whose canonical degrades to it (no
 *     MLS City) is left alone rather than bounced between two hops.
 *   - A canonical this module would not read back as the same listing (a row
 *     with no street builds /homes-for-sale/<city>/<mls>, which the rewrites
 *     route to search): no hop, the listing keeps rendering where it is.
 */

import { listingKeyFromSlug } from '@/lib/slug'
import {
  listingCanonicalPathFromFields,
  type ListingCanonicalPathFields,
} from '@/lib/data/listings/listingCanonicalPathCore'

/** Returns the row for a key, or null for a miss / refusal / error. */
export type ListingCanonicalRowLookup = (id: string) => Promise<ListingCanonicalPathFields | null>

/*
 * The shapes next.config.ts rewrites to /listing/by-address/*, one to one.
 * A path the rewrites do not send to the listing page is not a listing path,
 * and a place page that merely ends in digits must not trigger a lookup.
 *   /homes-for-sale/:city/:listingSlug([^/]*-[0-9]{5,})
 *   /homes-for-sale/:city/:community/:listingSlug([^/]*-[0-9]{5,})
 *   /homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*-[0-9]{5,})
 *   /homes-for-sale/:city/:community/:listingSlug([^/]*~[^/]*)
 *   /homes-for-sale/:city/:neighborhood/:community/:listingSlug([^/]*~[^/]*)
 * `/homes-for-sale/listing/<id>` rewrites to /listing/by-key FIRST (it is
 * listed before these in afterFiles), so a `listing` first segment is excluded.
 */
const HFS_TAIL_DIGITS = /^\/homes-for-sale\/((?:[^/]+\/){1,3})([^/]*-[0-9]{5,})$/
const HFS_TAIL_TILDE = /^\/homes-for-sale\/((?:[^/]+\/){2,3})([^/]*~[^/]*)$/
/** The internal render route, reachable directly: /listing/<key>. */
const LISTING_DIRECT = /^\/listing\/([^/]+)$/
/** The rewrite target itself, if requested directly. */
const LISTING_BY_ADDRESS = /^\/listing\/by-address\/((?:[^/]+\/){1,3})([^/]*-[0-9]{5,}|[^/]*~[^/]*)$/
const LISTING_RESERVED = new Set(['by-key', 'by-address', 'odsmls'])

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function stripTrailingSlash(p: string): string {
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

/**
 * The listing id a request path carries, or null when the path is not a
 * listing-detail shape. Uses listingKeyFromSlug, the same parser the
 * by-address page resolves with, so the hop and the page agree on which
 * listing a URL names.
 */
export function listingIdFromRequestPath(pathname: string): string | null {
  const p = stripTrailingSlash(decodePath(String(pathname ?? '')))
  let segment: string | null = null
  const hfs = p.match(HFS_TAIL_DIGITS) ?? p.match(HFS_TAIL_TILDE)
  if (hfs) {
    if (hfs[1].split('/')[0] === 'listing') return null
    segment = hfs[2]
  } else {
    const byAddress = p.match(LISTING_BY_ADDRESS)
    if (byAddress) {
      segment = byAddress[2]
    } else {
      const direct = p.match(LISTING_DIRECT)
      if (!direct || LISTING_RESERVED.has(direct[1])) return null
      segment = direct[1]
    }
  }
  const id = listingKeyFromSlug(segment.split('~')[0] ?? '')
  return /^[0-9]{5,40}$/.test(id) ? id : null
}

/**
 * True for the App Router's own Flight requests (client navigations and
 * <Link> prefetches). Those follow hrefs this site built with listingTileHref,
 * which ARE canonical, so a lookup would only cost a PostgREST read per card on
 * every search page that prefetches its results. Crawlers and first loads send
 * a document request and still get the hop.
 */
export function isRouterFlightRequest(headers: Headers, searchParams: URLSearchParams): boolean {
  return headers.get('rsc') === '1' || headers.has('next-router-prefetch') || searchParams.has('_rsc')
}

/**
 * The canonical path to 308 to, or null to let the request through untouched.
 * Pure given `lookup`: middleware passes the Edge reader, tests pass a table.
 */
export async function resolveListingCanonicalHop(
  pathname: string,
  lookup: ListingCanonicalRowLookup,
): Promise<string | null> {
  const id = listingIdFromRequestPath(pathname)
  if (!id) return null
  let row: ListingCanonicalPathFields | null
  try {
    row = await lookup(id)
  } catch {
    return null
  }
  if (!row) return null
  const canonical = listingCanonicalPathFromFields(row)
  if (!canonical.startsWith('/homes-for-sale/') || canonical.startsWith('/homes-for-sale/listing/')) return null
  // Fixed-point guard: only hop to a path this module itself reads back as the
  // same listing. A row with no street at all builds /homes-for-sale/<city>/<mls>,
  // which the rewrites do not send to the listing page; a 308 there would trade
  // a rendering listing for a search page. Such a row is left alone.
  const back = listingIdFromRequestPath(canonical)
  if (!back || (back !== row.ListNumber && back !== row.ListingKey)) return null
  const requested = stripTrailingSlash(decodePath(pathname))
  if (requested === decodePath(canonical)) return null
  return canonical
}
