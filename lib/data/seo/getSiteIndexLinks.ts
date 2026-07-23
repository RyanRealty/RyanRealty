/**
 * getSiteIndexLinks — DAL for the auto-derived internal-link layer (W3.4).
 *
 * ONE cached payload feeds both surfaces:
 *   - /site-index (the crawlable HTML site index page)
 *   - the header mega-menu popular searches (getDerivedPopularSearches, which
 *     replaces the hand-curated lib/popular-searches.ts snapshot as the live
 *     source; the static list remains only as a resilience fallback)
 *
 * Sources (all §0-clean, no raw `listings` aggregation):
 *   - geo_snapshot_mv via getAllCitySnapshots / getAllCommunitySnapshots
 *     (already-cached DAL, pulse-overridden city counts)
 *   - listing_tile_mv active slice (paged, minimal columns) for per-preset
 *     match counts — counts RANK links, they are never rendered as stats
 *   - data/resort-communities.json registry (curated community pages)
 *
 * Refresh model: unstable_cache TTL (CACHE_WINDOWS.marketStats, 6h) via
 * makeResilientCached — same schedule the mega-menu payload already uses. No
 * cron needed; a transient DB error is never cached (poison-null rule).
 */

import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { getAllCitySnapshots, getAllCommunitySnapshots } from '@/lib/data/geo/getGeoSnapshot'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { slugify } from '@/lib/slug'
import {
  deriveCityLinks,
  deriveCityPresetLinks,
  deriveCommunityLinks,
  deriveSubdivisionLinks,
  type ActiveTileLite,
  type CityIndexLink,
  type DerivedLink,
  type DerivedPresetLink,
  type GeoCountLite,
} from '@/lib/data/seo/derive-search-links'

// ───────────────────────── Types ─────────────────────────

export type SiteIndexCitySearches = {
  citySlug: string
  cityName: string
  /** The city's canonical browse hub, e.g. /homes-for-sale/bend. */
  cityHref: string
  /** Ranked preset search links for this city. */
  links: DerivedPresetLink[]
}

export type SiteIndexLinks = {
  /** Cities with a real page, ranked by live active count. */
  cities: CityIndexLink[]
  /** Per-city derived preset searches (cities with at least one link). */
  citySearches: SiteIndexCitySearches[]
  /** Curated resort communities ranked by live active count. */
  communities: DerivedLink[]
  /** Top subdivision browse URLs ranked by live active count. */
  subdivisions: DerivedLink[]
  /** ISO timestamp of derivation. Null only on the resilience fallback. */
  generatedAt: string | null
}

// Exported so the freshness contract test can assert generatedAt === null on the
// real value (not text-match it) — the sentinel the /site-index page's
// noStore()-on-empty guard depends on.
export const EMPTY_SITE_INDEX: SiteIndexLinks = {
  cities: [],
  citySearches: [],
  communities: [],
  subdivisions: [],
  generatedAt: null,
}

// ─────────────────── Active-tile fetch ───────────────────

type TileRow = {
  city: string | null
  list_price: number | null
  property_type: string | null
  property_sub_type: string | null
  lot_size_acres: number | null
  year_built: number | null
  pool_yn: boolean | null
  on_market_date: string | null
}

/** Hard ceiling on the active-tile read (well above the live active count). */
const MAX_ACTIVE_TILES = 20_000

/**
 * Fetch the public-active tile slice, minimal columns, paged with a stable
 * order. THROWS on a DB error (resilient-cache contract — never cache a blip).
 */
async function fetchActiveTiles(): Promise<ActiveTileLite[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  const { rows, error } = await fetchPagedRows<TileRow>(
    (from, to) =>
      supabase
        .from('listing_tile_mv')
        .select(
          'city, list_price, property_type, property_sub_type, lot_size_acres, year_built, pool_yn, on_market_date',
        )
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        .order('listing_key', { ascending: true })
        .range(from, to),
    MAX_ACTIVE_TILES,
  )
  if (error) {
    throw new Error(`[getSiteIndexLinks] active tile read failed: ${error.message}`)
  }
  return rows.map(
    (r): ActiveTileLite => ({
      city: r.city,
      listPrice: r.list_price != null ? Number(r.list_price) : null,
      propertyType: r.property_type,
      propertySubType: r.property_sub_type,
      lotAcres: r.lot_size_acres != null ? Number(r.lot_size_acres) : null,
      yearBuilt: r.year_built != null ? Number(r.year_built) : null,
      hasPool: r.pool_yn,
      onMarketDate: r.on_market_date,
    }),
  )
}

// ─────────────────── Assembly ───────────────────

/** Resort labels + aliases as sub-slugs, so the subdivision group does not
 *  duplicate a community the communities group already links. */
function resortSubSlugSet(): Set<string> {
  const out = new Set<string>()
  for (const entry of getAllResortCommunities()) {
    out.add(slugify(entry.label))
    out.add(entry.slug)
    for (const alias of entry.subdivision_aliases ?? []) out.add(slugify(alias))
  }
  return out
}

async function buildSiteIndexLinks(): Promise<SiteIndexLinks> {
  const [tiles, citySnaps, communitySnaps] = await Promise.all([
    fetchActiveTiles(),
    getAllCitySnapshots(),
    getAllCommunitySnapshots(),
  ])

  const cityCounts: GeoCountLite[] = citySnaps.map((s) => ({
    geoKey: s.geoKey,
    geoLabel: s.geoLabel,
    activeSfrCount: s.activeSfrCount,
  }))
  const communityCounts: GeoCountLite[] = communitySnaps.map((s) => ({
    geoKey: s.geoKey,
    geoLabel: s.geoLabel,
    activeSfrCount: s.activeSfrCount,
  }))

  const cities = deriveCityLinks(cityCounts, SITE_CITY_SLUGS)

  const byCity = deriveCityPresetLinks(
    tiles,
    cities.map((c) => ({ slug: c.slug, name: c.name })),
  )
  const citySearches: SiteIndexCitySearches[] = cities
    .map((c) => ({
      citySlug: c.slug,
      cityName: c.name,
      cityHref: c.browseHref,
      links: byCity.get(c.slug) ?? [],
    }))
    .filter((group) => group.links.length > 0)

  const countByGeoKey = new Map<string, number>(
    communityCounts.map((s) => [s.geoKey, s.activeSfrCount]),
  )
  const communities = deriveCommunityLinks(
    getAllResortCommunities().map((e) => ({ slug: e.slug, label: e.label, city: e.city })),
    countByGeoKey,
  )

  const subdivisions = deriveSubdivisionLinks(communityCounts, {
    cap: 50,
    minCount: 3,
    excludeSubSlugs: resortSubSlugSet(),
  })

  return {
    cities,
    citySearches,
    communities,
    subdivisions,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Cached, resilient site-index payload. 6h TTL on the market-stats window —
 * the same cadence the mega-menu snapshot refreshes on — tagged so the city /
 * community index revalidations flush it alongside the pages it links.
 */
export const getSiteIndexLinks = makeResilientCached(
  buildSiteIndexLinks,
  ['site-index-links-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: ['cities-index', 'communities-index', cacheTag.listings],
  },
  EMPTY_SITE_INDEX,
)

// ─────────────────── Mega-menu consumer ───────────────────

export type DerivedPopularSearch = { href: string; label: string }

/**
 * Top derived searches for one city — the live replacement for
 * getPopularSearchesForCity (lib/popular-searches.ts). Returns [] when the
 * derivation has no rows for the city (callers keep the static fallback).
 */
export async function getDerivedPopularSearches(
  citySlug: string,
  limit?: number,
): Promise<DerivedPopularSearch[]> {
  const key = citySlug.toLowerCase().trim()
  const data = await getSiteIndexLinks()
  const group = data.citySearches.find((g) => g.citySlug === key)
  if (!group) return []
  const links = limit != null ? group.links.slice(0, Math.max(0, limit)) : group.links
  return links.map((l) => ({ href: l.href, label: l.label }))
}
