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

/** Preview Field: map + list in one frame. Cap is high enough to read as
 *  inventory, not a four-card platter. See all opens the rest. Do not dump
 *  a novel of cards above the map — the map stays first. */
export const HOME_FIELD_LIMIT = 12

/** Mixed-type pool the type toggle filters. Larger than the visible cap so
 *  a House / Land pick still has rows, without dumping 13 cards on 390. */
export const HOME_FIELD_POOL = 24

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
  'regional MLS through Oregon Data Share: detached single-family houses across Central Oregon. ' +
  'Pending pace covers the last 90 days and sale-to-asking the last 12 months. ' +
  'A figure we cannot verify is left out, never estimated.'

/** Live place hero when present. Otherwise the page's existing fallback image. */
export { preferPlaceHero } from '@/lib/geo-images'
