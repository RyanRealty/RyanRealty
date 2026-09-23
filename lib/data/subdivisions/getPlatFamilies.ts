/**
 * getPlatFamilies — the live plat families (Matt 2026-09-23: "we just want to
 * make sure that that grouping is always happening").
 *
 * Every input is a recorded source, and the grouping rule itself is the pure
 * derivePlatFamilies in lib/market/plat-family.ts:
 *   - the county's plats, labels and boundary-tree cities (getRecordedPlatTree,
 *     public.boundaries),
 *   - each plat's lifetime closed count and filed-sales city
 *     (getPlatClosedCounts, public.subdivision_plat_closed_mv),
 *   - the MLS SubdivisionName set per Central Oregon city
 *     (getSubdivisionCityInventory, public.subdivision_city_inventory_mv),
 *   - the registry communities and their aliases (data/resort-communities.json),
 *   - the middleware area redirects (lib/subdivision-area-redirects.ts).
 *
 * Cached 6h, keyed v1. The fetch throws when any input came back empty or
 * the derivation found no family at all: a read failure must never be cached
 * as "no families", which would noindex every family page (and drop it from
 * the sitemap) for the whole window.
 */

import resortCommunitiesRegistry from '@/data/resort-communities.json'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getPlatClosedCounts } from '@/lib/data/subdivisions/getPlatClosedCounts'
import { getRecordedPlatTree, type RecordedPlatTree } from '@/lib/data/subdivisions/getRecordedPlatTree'
import {
  getSubdivisionCityInventory,
  type SubdivisionCityInventoryEntry,
} from '@/lib/data/subdivisions/getSubdivisionCityInventory'
import type { PlatClosedCount } from '@/lib/data/subdivisions/subdivision-index'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  derivePlatFamilies,
  type FamilyCommunityInput,
  type PlatFamily,
} from '@/lib/market/plat-family'
import { slugify } from '@/lib/slug'
import {
  resolveSubdivisionAreaRedirect,
  subdivisionAreaRedirectEntries,
} from '@/lib/subdivision-area-redirects'

type RegistryRow = {
  slug: string
  label: string
  city_slug: string
  subdivision_aliases?: string[]
  mls_cities?: string[]
}

/** The registry communities, in the shape derivePlatFamilies reads. */
export function registryFamilyCommunities(
  rows: readonly RegistryRow[] = resortCommunitiesRegistry.communities as RegistryRow[],
): FamilyCommunityInput[] {
  return rows.map((c) => ({
    slug: c.slug,
    label: c.label,
    citySlug: c.city_slug,
    aliases: c.subdivision_aliases ?? [],
    mlsCities: c.mls_cities ?? [],
  }))
}

/**
 * Slugs that already name another kind of place: a city, a neighborhood or
 * resort polygon, a registry community, or any slug middleware 308s away from
 * /subdivisions/. A plat whose own slug is one of these (/subdivisions/bend,
 * /subdivisions/sisters, /subdivisions/la-pine) is not that place, and its page
 * must not bid for the place's name (SEO-7).
 */
export function reservedPlaceSlugs(
  tree: Pick<RecordedPlatTree, 'citySlugs' | 'neighborhoodSlugs'>,
  communities: readonly Pick<FamilyCommunityInput, 'slug'>[] = registryFamilyCommunities(),
): Set<string> {
  const out = new Set<string>([
    ...CENTRAL_OREGON_CITY_SLUGS,
    ...tree.citySlugs,
    ...tree.neighborhoodSlugs,
    ...communities.map((c) => c.slug),
  ])
  for (const [slug] of subdivisionAreaRedirectEntries()) out.add(slug)
  return out
}

/** Pure assembly, so the test can drive it with fixture rows. */
export function assemblePlatFamilies(input: {
  tree: RecordedPlatTree
  counts: readonly Pick<PlatClosedCount, 'slug' | 'closedCount' | 'topCityLower'>[]
  mlsInventory: readonly Pick<SubdivisionCityInventoryEntry, 'cityLower' | 'subdivisionName'>[]
  communities?: readonly FamilyCommunityInput[]
  areaRedirect?: (slug: string) => string | null
}): PlatFamily[] {
  const communities = input.communities ?? registryFamilyCommunities()
  const countBySlug = new Map(input.counts.map((c) => [c.slug, c]))
  const plats = input.tree.plats.map((plat) => {
    const count = countBySlug.get(plat.slug)
    const filedCity = count?.topCityLower ? slugify(count.topCityLower) : ''
    return {
      slug: plat.slug,
      label: plat.label,
      citySlug: plat.treeCitySlug || (filedCity === 'unknown' ? '' : filedCity),
      closedCount: count?.closedCount ?? 0,
    }
  })
  return derivePlatFamilies({
    plats,
    communities,
    mlsNames: input.mlsInventory.map((row) => ({
      name: row.subdivisionName,
      citySlug: slugify(row.cityLower),
    })),
    reservedSlugs: reservedPlaceSlugs(input.tree, communities),
    areaRedirect: input.areaRedirect ?? resolveSubdivisionAreaRedirect,
  })
}

async function fetchPlatFamilies(): Promise<PlatFamily[]> {
  const [tree, counts, mlsInventory] = await Promise.all([
    getRecordedPlatTree(),
    getPlatClosedCounts(),
    getSubdivisionCityInventory(),
  ])
  if (tree.plats.length === 0) throw new Error('getPlatFamilies: recorded plat tree came back empty')
  if (counts.length === 0) throw new Error('getPlatFamilies: plat closed counts came back empty')
  if (mlsInventory.length === 0) throw new Error('getPlatFamilies: MLS subdivision names came back empty')
  const families = assemblePlatFamilies({ tree, counts, mlsInventory })
  if (families.length === 0) throw new Error('getPlatFamilies: derived no family from a non-empty plat set')
  return families
}

/** The cached family set. 6h: county plats, closings and MLS names all move slowly. */
export const getPlatFamilies = makeResilientCached(
  fetchPlatFamilies,
  ['plat-families-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'boundaries'] },
  [] as PlatFamily[],
)
