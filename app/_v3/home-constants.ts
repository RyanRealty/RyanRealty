/**
 * Route-local constants for the homepage (app/page.tsx).
 *
 * Split out so the route file stays under the ci:file-size-budget floor.
 * Nothing here fetches, formats, or derives. TOWN_ORDER and TOWN_IMG stay in
 * app/page.tsx itself.
 */

/** The hero media. The Bend flyover the KB hero played, over the canonical
 *  Old Mill still (Matt 2026-06-14, 0af80821: the drone footage IS the hero;
 *  the 3D-tiles render was rejected). */
export const HERO_VIDEO = '/videos/hero-optimized.mp4'
export const HERO_POSTER = '/images/hero/hero-old-mill-master-4k.jpg'

/** Preview Field: map + a short set in one frame. Twelve full rows on 390
 *  dumped the map under a novel of cards. See all opens the rest. */
export const HOME_FIELD_LIMIT = 4

/** Tile fetch ceiling. The DAL's own note: 5000 covers the full active
 *  inventory (~2-3K rows); 3000 held on the KB page and holds here, so the
 *  curation's "two highest asks" claim is over the whole feed, not a sample. */
export const HOME_TILE_FETCH = 3000

/**
 * The count line's source: the count is the leftover Market Truth region row
 * (D19/D78 — never tiles, never a pulse all-count), so the trace names it.
 */
export const HOME_COUNT_TRACE =
  'Market Truth leftover region row: detached single-family homes for sale across Central Oregon'

/**
 * The trace over the communities ledger's active-count column. These rows print
 * the SAME figure the communities index prints (ci:publish-resort-index-figures
 * pins the wiring), so they carry the index's own population sentence.
 */
export const HOME_COMMUNITY_TRACE =
  'live MLS through Oregon Data Share, active single-family listings under each community and its registered subdivision aliases'

/**
 * The market Instrument's trace — the region spelling of cityMarketTrace, with
 * the same MoS clauses appended by the caller when a supply figure prints.
 */
export const HOME_MARKET_TRACE =
  'regional MLS through Oregon Data Share, read through the Market Truth metric layer: ' +
  'detached single-family houses across the Central Oregon region. ' +
  'Every figure names its own window. A figure the layer withheld is absent, not estimated.'

/**
 * The honest description of the Field's listed subset. The two claims it makes
 * (highest asks, nearest each town's median) are curateFeaturedTiles' own
 * documented mix, computed over the full active feed (HOME_TILE_FETCH covers
 * the whole inventory).
 */
export function homeFieldNote(shown: number): string {
  return `The map plots these ${shown}.`
}

/** Live place hero when present. Otherwise the page's existing fallback image. */
export { preferPlaceHero } from '@/lib/geo-images'
