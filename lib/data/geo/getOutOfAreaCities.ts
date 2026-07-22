/**
 * getOutOfAreaCities — statewide feed cities OUTSIDE the Central Oregon
 * service area, from geo_snapshot_mv (W12 referral-capture tier).
 *
 * geo_snapshot_mv's city level is built GROUP BY lower(trim("City")) over the
 * whole statewide feed (migration 20260522144510), so it already carries one
 * pre-aggregated row per out-of-area city (Medford, Grants Pass, Klamath
 * Falls, ...). This DAL reads those rows once, filters them through the PURE
 * policy helpers in lib/out-of-area-cities.ts, and feeds:
 *
 *   - /oregon/[city] page render + metadata (index vs noindex)
 *   - generateStaticParams (the indexable top set)
 *   - the sitemap emitter (app/sitemap.ts wiring — lane D1)
 *   - the W12 prod-verifiable count (cities with >= 5 active listings)
 *
 * Query shape (spot-check against live):
 *   SELECT geo_key, geo_label, active_all_count, active_sfr_count,
 *          median_list_price, refreshed_at
 *   FROM public.geo_snapshot_mv
 *   WHERE geo_type = 'city' AND active_all_count >= 1
 *   -- client-side: minus CENTRAL_OREGON_CITY_SLUGS + feed-noise keys
 *
 * §0: counts and medians come from the MV cache (the same source the city
 * pages use), never from a request-time aggregate over raw listings.
 */

import type { MetadataRoute } from 'next'
import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import {
  isPlausibleCityKey,
  isOutOfAreaCityKey,
  outOfAreaCitySlug,
  pickIndexableOutOfAreaCities,
  countOutOfAreaCitiesWithActiveAtLeast,
  OUT_OF_AREA_INDEXABLE_MIN_ACTIVE,
  type OutOfAreaCity,
} from '@/lib/out-of-area-cities'

export type { OutOfAreaCity }

type GeoSnapshotCityRow = {
  geo_key: string
  geo_label: string
  active_all_count: number
  active_sfr_count: number
  median_list_price: number | null
  refreshed_at: string
}

async function _fetchOutOfAreaCityIndex(): Promise<OutOfAreaCity[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  // ~362 distinct cities in the statewide feed — well under one PostgREST page,
  // but paged anyway so feed growth can never silently truncate the index.
  const { rows, error } = await fetchPagedRows<GeoSnapshotCityRow>(
    (from, to) =>
      supabase
        .from('geo_snapshot_mv')
        .select('geo_key, geo_label, active_all_count, active_sfr_count, median_list_price, refreshed_at')
        .eq('geo_type', 'city')
        .gte('active_all_count', 1)
        .order('geo_key', { ascending: true })
        .range(from, to),
    2000,
  )
  if (error) throw new Error(`[getOutOfAreaCityIndex] ${error.message ?? JSON.stringify(error)}`)
  return rows
    .filter((r) => isPlausibleCityKey(r.geo_key) && isOutOfAreaCityKey(r.geo_key))
    .map((r) => ({
      slug: outOfAreaCitySlug(r.geo_key),
      name: r.geo_label?.trim() || r.geo_key,
      activeAllCount: Number(r.active_all_count) || 0,
      activeSfrCount: Number(r.active_sfr_count) || 0,
      medianListPrice: r.median_list_price != null ? Math.round(Number(r.median_list_price)) : null,
      refreshedAt: r.refreshed_at,
    }))
    .sort((a, b) => b.activeAllCount - a.activeAllCount || a.name.localeCompare(b.name))
}

/**
 * Every out-of-area city in the feed with at least one active listing, sorted
 * by active count desc. Resilient-cached (a DB blip serves [] rather than
 * failing the page; the fetch THROWS on error so an empty list is never
 * poison-cached).
 */
export const getOutOfAreaCityIndex = makeResilientCached(
  _fetchOutOfAreaCityIndex,
  ['out-of-area-cities-v1'],
  { revalidate: 3600, tags: ['out-of-area-cities'] },
  [],
)

/** Single out-of-area city lookup by route slug. Null = no such city / no inventory. */
export async function getOutOfAreaCity(slug: string): Promise<OutOfAreaCity | null> {
  const s = slug.toLowerCase().trim()
  if (!s) return null
  const index = await getOutOfAreaCityIndex()
  return index.find((c) => c.slug === s) ?? null
}

/** The indexable top set (>= 5 active, top 25 by count) — sitemap + robots policy. */
export async function getIndexableOutOfAreaCities(): Promise<OutOfAreaCity[]> {
  return pickIndexableOutOfAreaCities(await getOutOfAreaCityIndex())
}

/** True when /oregon/[slug] may index (in the top set). Everything else renders noindex. */
export async function isIndexableOutOfAreaCity(slug: string): Promise<boolean> {
  const s = slug.toLowerCase().trim()
  const indexable = await getIndexableOutOfAreaCities()
  return indexable.some((c) => c.slug === s)
}

/**
 * Sitemap entries for the TOP out-of-area cities only (lane D1 wires this into
 * app/sitemap.ts). Non-top cities are never emitted — they render noindex.
 */
export async function getOutOfAreaCitySitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const indexable = await getIndexableOutOfAreaCities()
  return indexable.map((c) => ({
    url: `${baseUrl}/oregon/${c.slug}`,
    lastModified: c.refreshedAt ? new Date(c.refreshedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.4,
  }))
}

/**
 * W12 prod-verifiable count: out-of-area cities with >= minActive active
 * listings. Spot-check: SELECT count(*) FROM geo_snapshot_mv WHERE
 * geo_type='city' AND active_all_count >= 5, minus the service-area +
 * feed-noise keys (see lib/out-of-area-cities.ts).
 */
export async function countOutOfAreaCities(
  minActive: number = OUT_OF_AREA_INDEXABLE_MIN_ACTIVE,
): Promise<number> {
  return countOutOfAreaCitiesWithActiveAtLeast(await getOutOfAreaCityIndex(), minActive)
}
