/**
 * Public plat "homes for sale" inventory — ONE population.
 *
 * Fleet finding (2026-08-16, Ridge At Eagle Crest): the subdivisions index
 * tile printed 12, the place-page hero printed 14, and the #homes list
 * showed 26 cards. Those were three queries, not one market:
 *
 *   A  geo_snapshot_mv.active_sfr_count     SFR + Active only          (index)
 *   B  getCommunityListings(..., 14).length featured cap, all types    (hero)
 *   C  getListingTiles propertyType A       SFR + townhouse + null     (list)
 *
 * This module is the public inventory SoR for recorded registry plats.
 * Geography is MLS SubdivisionName (the plat's identity). The registry
 * parent city is an alias set (city slug + parent community slug), not a
 * required `listings.City` spelling. South Meadow files as City="Black
 * Butte Ranch" while the registry city is Sisters.
 * Property is SFR (`property_type='A'` AND
 * `property_sub_type='Single Family Residence'`). Status is
 * PUBLIC_ACTIVE_STATUSES (Active + Active Under Contract). Coming Soon is
 * excluded (R-025).
 *
 * `geo_snapshot_mv` is Active-only and has no listing keys, so it cannot
 * drive the list. `listings_in_boundary` is all property types and Ridge
 * has no plat polygon. Do not fall back to either when this read is silent
 * — absent is not a different population (R-020).
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0 (active listings in a community).
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { looksLikeMlsAbbreviation } from '@/lib/market/publish-plat-display-name'
import { slugify } from '@/lib/slug'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { medianListPrice } from '@/lib/data/geo/neighborhood-public-inventory'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases: string[]
}

export type RegistryPlat = {
  slug: string
  name: string
  parent: string
  parentSlug: string
  city: string
  citySlug: string
}

export type PlatPublicInventory = {
  key: string
  label: string
  slug: string
  city: string
  citySlug: string
  /** SFR + PUBLIC_ACTIVE with this MLS SubdivisionName in this city. */
  activeCount: number
  medianListPrice: number | null
  listingKeys: string[]
  href: string
}

export type PlatInventoryRow = {
  listing_key: string
  list_price: number | null
  subdivision_lower: string | null
  city_lower: string | null
}

export function platInventoryKey(citySlug: string, platSlug: string): string {
  return `${citySlug}:${platSlug}`
}

/** City spellings that may own a registry plat's MLS rows. */
export function platCityAliases(plat: RegistryPlat): Set<string> {
  return new Set(
    [plat.citySlug, slugify(plat.city), plat.parentSlug, slugify(plat.parent)].filter(Boolean),
  )
}

/** SubdivisionName match plus a city alias. Same slug in two cities stays split. */
export function rowMatchesPlat(row: PlatInventoryRow, plat: RegistryPlat): boolean {
  if (!row.subdivision_lower || !row.city_lower) return false
  if (slugify(row.subdivision_lower) !== plat.slug) return false
  return platCityAliases(plat).has(slugify(row.city_lower))
}

export function isDisplayablePlatName(alias: string): boolean {
  const t = alias.trim()
  if (t.length < 6) return false
  if (/^[A-Za-z]{2,5}$/.test(t)) return false
  if (/^(drrh|oww|bbr|stoneth)/i.test(t)) return false
  if (looksLikeMlsAbbreviation(t)) return false
  return true
}

/** Recorded child plats from the community registry. Same catalog the index lists. */
export function registryChildPlats(
  registry: ReadonlyArray<RegistryCommunity> = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>,
): RegistryPlat[] {
  const out: RegistryPlat[] = []
  const seen = new Set<string>()
  for (const r of registry) {
    for (const alias of r.subdivision_aliases) {
      if (!isDisplayablePlatName(alias)) continue
      const slug = slugify(alias)
      if (resolveSubdivisionAreaRedirect(slug)) continue
      const key = platInventoryKey(r.city_slug, slug)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        slug,
        name: alias,
        parent: r.label,
        parentSlug: r.slug,
        city: r.city,
        citySlug: r.city_slug,
      })
    }
  }
  return out
}

/** Pure rollup — unit-tested so the index and the place page cannot invent a second group-by. */
export function rollupPlatPublicInventory(
  rows: readonly PlatInventoryRow[],
  plats: readonly RegistryPlat[] = registryChildPlats(),
): PlatPublicInventory[] {
  const byKey = new Map<string, { keys: string[]; prices: number[] }>()
  for (const plat of plats) {
    byKey.set(platInventoryKey(plat.citySlug, plat.slug), { keys: [], prices: [] })
  }
  for (const row of rows) {
    const cityLower = row.city_lower
    if (!row.listing_key || !row.subdivision_lower || !cityLower) continue
    const matches = plats.filter((plat) => rowMatchesPlat(row, plat))
    const plat =
      matches.find((p) => p.citySlug === slugify(cityLower)) ?? matches[0] ?? null
    if (!plat) continue
    const key = platInventoryKey(plat.citySlug, plat.slug)
    const bucket = byKey.get(key) ?? { keys: [], prices: [] }
    bucket.keys.push(row.listing_key)
    if (row.list_price != null && Number.isFinite(Number(row.list_price)) && Number(row.list_price) > 0) {
      bucket.prices.push(Number(row.list_price))
    }
    byKey.set(key, bucket)
  }

  return plats.map((p) => {
    const key = platInventoryKey(p.citySlug, p.slug)
    const bucket = byKey.get(key) ?? { keys: [], prices: [] }
    const priced = [...bucket.prices].sort((a, b) => a - b)
    return {
      key,
      label: p.name,
      slug: p.slug,
      city: p.city,
      citySlug: p.citySlug,
      activeCount: bucket.keys.length,
      medianListPrice: medianListPrice(priced),
      listingKeys: bucket.keys,
      href: `/subdivisions/${p.slug}`,
    }
  })
}

const NAME_CHUNK = 40

async function fetchRegistryPlatPublicInventory(): Promise<PlatPublicInventory[]> {
  const plats = registryChildPlats()
  const names = [...new Set(plats.map((p) => p.name.toLowerCase().trim()))]
  const sb = supabaseAnon()
  if (!sb) {
    throw new Error('[fetchRegistryPlatPublicInventory] supabase anon client missing')
  }

  const rows: PlatInventoryRow[] = []
  for (let i = 0; i < names.length; i += NAME_CHUNK) {
    const chunk = names.slice(i, i + NAME_CHUNK)
    const { rows: page, error } = await fetchPagedRows<PlatInventoryRow>(
      (from, to) =>
        sb
          .from('listing_tile_mv')
          .select('listing_key, list_price, subdivision_lower, city_lower')
          .in('subdivision_lower', chunk)
          .in('standard_status', PUBLIC_ACTIVE_STATUSES)
          .eq('property_type', 'A')
          .eq('property_sub_type', 'Single Family Residence')
          .order('listing_key', { ascending: true })
          .range(from, to),
      5000,
    )
    if (error) {
      throw new Error(
        `[fetchRegistryPlatPublicInventory] listing_tile_mv query failed: ${error.message}`,
      )
    }
    rows.push(...page)
  }

  return rollupPlatPublicInventory(rows, plats)
}

/**
 * Cached batch for every registry plat. Index tiles and the place page
 * read this same payload so they cannot drift inside the TTL.
 */
export const getRegistryPlatPublicInventory = makeResilientCached(
  fetchRegistryPlatPublicInventory,
  ['registry-plat-public-inventory-v3'],
  {
    revalidate: 900,
    tags: [cacheTag.market, cacheTag.listings],
  },
  [],
)

export async function getPlatPublicInventory(
  slug: string,
): Promise<PlatPublicInventory | null> {
  const rows = await getRegistryPlatPublicInventory()
  if (rows.length === 0) return null
  const matches = rows.filter((r) => r.slug === slug)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => b.activeCount - a.activeCount)[0] ?? null
}
