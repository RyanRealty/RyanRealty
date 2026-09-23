/**
 * getBrowsePairDecision — the Supabase-facing assembly for
 * lib/seo/browse-pair-decision.ts. Every input comes from a read the site
 * already caches; nothing here issues a new query shape:
 *
 *   - subdivision_city_inventory_mv via getSubdivisionCityInventory() — the
 *     lifetime (MLS city, MLS SubdivisionName) status counts the sitemap's
 *     browse leg has always read (6h cache, one filtered read, 2,218 rows for
 *     the service area on 2026-09-23)
 *   - getIndexableSubdivisions() — the plat set /subdivisions/[slug] and the
 *     sitemap's plat leg already read (GIS polygon + >= 10 closed sales)
 *   - getPlatClosedCounts() — subdivision_plat_closed_mv, for the recorded
 *     plat label behind a plat link and the plat's city (top_city_lower), so a
 *     plat in another city is never treated as this pair's place
 *   - the resort registry (data/resort-communities.json)
 *
 * §0 trace for the two counts a decision reads, per (city slug, area slug):
 *   closedLifetime = sum of status_counts[s] over statuses s that
 *     classifyLifetimeBuckets() puts in 'closed' (lower(status) LIKE
 *     '%closed%'), over every MV row with city_lower = the city and
 *     slugify(subdivision_name) = the area slug. listing_tile_mv population:
 *     internet-display-permitted listings, every year on file.
 *   activeNow = the same sum over PUBLIC_ACTIVE_STATUSES ('Active',
 *     'Active Under Contract'), the statuses the page's default grid shows, as
 *     of the MV's last refresh.
 */

import { cache } from 'react'
import { getSubdivisionCityInventory } from '@/lib/data/subdivisions/getSubdivisionCityInventory'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getPlatClosedCounts } from '@/lib/data/subdivisions/getPlatClosedCounts'
import { classifyLifetimeBuckets } from '@/lib/data/subdivisions/subdivision-sitemap-inventory'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { slugify } from '@/lib/slug'
import {
  browsePairPath,
  decideBrowsePair,
  type BrowsePairDecision,
  type BrowsePairFacts,
  type BrowsePairInventory,
} from './browse-pair-decision'

const ACTIVE_STATUS_KEYS: ReadonlySet<string> = new Set(PUBLIC_ACTIVE_STATUSES.map((s) => s.toLowerCase()))

/** 'la pine' (MV city_lower) -> 'la-pine' (URL city slug). */
function cityLowerToSlug(cityLower: string): string {
  return cityLower.trim().toLowerCase().replace(/\s+/g, '-')
}

type PairAccumulator = BrowsePairInventory & { nameWeight: number }

export type BrowsePairIndex = {
  /** `${citySlug}/${areaSlug}` -> lifetime counts. Empty when the MV read failed. */
  pairs: ReadonlyMap<string, BrowsePairInventory>
  inventoryKnown: boolean
  /** Indexable plat slugs; null when the set could not be read. */
  indexablePlats: ReadonlySet<string> | null
  /** Recorded plat label by slug, every plat with a closed sale inside it. */
  platLabels: ReadonlyMap<string, string>
  /**
   * Plats that carry a top MLS city, by `${citySlug}/${hyphenless slug}`
   * (platMatchKey). A key holding two plats is ambiguous and matches neither.
   */
  cityPlats: ReadonlyMap<string, ReadonlyArray<{ slug: string; label: string }>>
}

/** Word breaks aside: 'deschutes-riverwoods' and 'deschutes-river-woods' share a key. */
export function platMatchKey(citySlug: string, slug: string): string {
  return `${citySlug.trim().toLowerCase()}/${slug.trim().toLowerCase().replace(/-/g, '')}`
}

/** Group plats by (top city, hyphenless slug). Exported for the unit test. */
export function buildCityPlatIndex(
  platCounts: ReadonlyArray<{ slug: string; label: string; topCityLower?: string | null }>,
): Map<string, Array<{ slug: string; label: string }>> {
  const out = new Map<string, Array<{ slug: string; label: string }>>()
  for (const p of platCounts) {
    const city = (p.topCityLower ?? '').trim()
    const slug = (p.slug ?? '').trim()
    if (!city || !slug) continue
    const key = platMatchKey(cityLowerToSlug(city), slug)
    const list = out.get(key)
    if (list) list.push({ slug, label: p.label })
    else out.set(key, [{ slug, label: p.label }])
  }
  return out
}

/**
 * The recorded plat that is this pair's place: same city, and the exact slug
 * when that plat is in this city, else the single plat matching across a word
 * break. null when none or ambiguous.
 */
export function cityPlatFor(
  cityPlats: BrowsePairIndex['cityPlats'],
  citySlug: string,
  areaSlug: string,
): BrowsePairFacts['cityPlat'] {
  const candidates = cityPlats.get(platMatchKey(citySlug, areaSlug)) ?? []
  const exact = candidates.find((c) => c.slug === areaSlug.trim().toLowerCase())
  if (exact) return exact
  return candidates.length === 1 ? candidates[0]! : null
}

/**
 * Fold MV entries into per-(city slug, area slug) counts. Two MLS spellings
 * that slugify alike ("Awbrey Butte" / "AWBREY BUTTE") are ONE URL, so their
 * counts add, exactly as buildSubdivisionSlugsForCity does for the sitemap
 * floor; the name the page filters and prints is the spelling with the most
 * listings behind it. Exported for the unit test.
 */
export function buildBrowsePairIndex(
  entries: ReadonlyArray<{ cityLower: string; subdivisionName: string; rows: ReadonlyArray<{ standard_status?: string | null; n?: number }> }>,
): Map<string, BrowsePairInventory> {
  const acc = new Map<string, PairAccumulator>()
  for (const entry of entries) {
    const name = (entry.subdivisionName ?? '').trim()
    if (!name || name === 'N/A') continue
    const areaSlug = slugify(name)
    if (areaSlug === 'unknown') continue
    const key = `${cityLowerToSlug(entry.cityLower)}/${areaSlug}`
    let closed = 0
    let active = 0
    let weight = 0
    for (const row of entry.rows) {
      const n = Number.isFinite(Number(row.n)) && Number(row.n) > 0 ? Math.trunc(Number(row.n)) : 1
      weight += n
      const status = (row.standard_status ?? '').trim()
      if (classifyLifetimeBuckets(status).includes('closed')) closed += n
      if (ACTIVE_STATUS_KEYS.has(status.toLowerCase())) active += n
    }
    const prev = acc.get(key)
    if (!prev) {
      acc.set(key, { mlsName: name, closedLifetime: closed, activeNow: active, nameWeight: weight })
      continue
    }
    prev.closedLifetime += closed
    prev.activeNow += active
    if (weight > prev.nameWeight) {
      prev.mlsName = name
      prev.nameWeight = weight
    }
  }
  const out = new Map<string, BrowsePairInventory>()
  for (const [key, { mlsName, closedLifetime, activeNow }] of acc) out.set(key, { mlsName, closedLifetime, activeNow })
  return out
}

/** One cached read of each input, memoized per request. */
export const getBrowsePairIndex = cache(async (): Promise<BrowsePairIndex> => {
  const [entries, indexable, platCounts] = await Promise.all([
    getSubdivisionCityInventory(),
    getIndexableSubdivisions(),
    getPlatClosedCounts(),
  ])
  // Every one of these reads THROWS on a failed or empty result inside its
  // resilient wrapper and falls back to []. Production holds thousands of rows
  // in each, so [] is a failed read, never "no subdivisions".
  return {
    pairs: buildBrowsePairIndex(entries),
    inventoryKnown: entries.length > 0,
    indexablePlats: indexable.length > 0 ? new Set(indexable.map((s) => s.slug)) : null,
    platLabels: new Map(platCounts.map((p) => [p.slug, p.label])),
    cityPlats: buildCityPlatIndex(platCounts),
  }
})

/** The registry resort community serving (city, area), if any. */
export function communityForPair(citySlug: string, areaSlug: string): BrowsePairFacts['community'] {
  const resort = getResortCommunityBySlug(areaSlug)
  if (!resort) return null
  const city = citySlug.trim().toLowerCase()
  const servesCity =
    resort.city_slug === city || (resort.mls_cities ?? []).some((c) => slugify(c) === city)
  return servesCity ? { publicSlug: publicCommunitySlug(resort), label: resort.label } : null
}

/** Assemble the facts for one pair from the index (pure given the index). */
export function browsePairFacts(
  index: BrowsePairIndex,
  citySlug: string,
  areaSlug: string,
  activeName: string | null,
): BrowsePairFacts {
  const city = citySlug.trim().toLowerCase()
  const area = areaSlug.trim().toLowerCase()
  const cityPlat = cityPlatFor(index.cityPlats, city, area)
  return {
    citySlug: city,
    areaSlug: area,
    inventory: index.pairs.get(`${city}/${area}`) ?? null,
    inventoryKnown: index.inventoryKnown,
    activeName,
    community: communityForPair(city, area),
    cityPlat,
    platIndexable: index.indexablePlats ? (cityPlat ? index.indexablePlats.has(cityPlat.slug) : false) : null,
    platLabel: index.platLabels.get(area) ?? null,
  }
}

/**
 * The decision for one pair at render. `lookupActiveName` is the route's
 * active-listing name lookup; it runs only when the MV does not know the pair
 * (a subdivision that listed after the nightly refresh), so the common case is
 * one cached read.
 */
export async function getBrowsePairDecision(
  citySlug: string,
  areaSlug: string,
  lookupActiveName: () => Promise<string | null>,
): Promise<{ facts: BrowsePairFacts; decision: BrowsePairDecision }> {
  const index = await getBrowsePairIndex()
  const known = index.pairs.has(`${citySlug.trim().toLowerCase()}/${areaSlug.trim().toLowerCase()}`)
  const activeName = known ? null : await lookupActiveName().catch(() => null)
  const facts = browsePairFacts(index, citySlug, areaSlug, activeName)
  return { facts, decision: decideBrowsePair(facts) }
}

/**
 * The sitemap's browse leg: every pair of the given cities whose decision is
 * `emit`, as root-relative paths, sorted. Same decision function as the page,
 * so a submitted URL is always indexable and self-canonical.
 */
export async function getBrowsePairSitemapPaths(citySlugs: readonly string[]): Promise<string[]> {
  const index = await getBrowsePairIndex()
  const cities = new Set(citySlugs.map((c) => c.trim().toLowerCase()))
  const out: string[] = []
  for (const key of index.pairs.keys()) {
    const [citySlug, areaSlug] = key.split('/') as [string, string]
    if (!cities.has(citySlug)) continue
    if (decideBrowsePair(browsePairFacts(index, citySlug, areaSlug, null)).emit) {
      out.push(browsePairPath(citySlug, areaSlug))
    }
  }
  return out.sort()
}
