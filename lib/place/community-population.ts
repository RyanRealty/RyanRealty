/**
 * A community's for-sale population: THE one set of listings a
 * /communities/[slug] page lists. The homes list shows it, the map draws it as
 * its "for sale" dots, and the Atlas dots route rebuilds it from the page's own
 * reference, so the two counts on the page cannot come from different
 * populations (2026-09-25; before it the map counted listings inside one
 * outline and the homes list counted a second outline plus MLS name matches:
 * Broken Top map 55, homes 20).
 *
 * RECORDED PLATS ONLY (Matt 2026-09-25). A community with a trusted outline
 * counts exactly the listings inside it: every publicly active listing inside
 * the community's stored outline (listing_boundary_xref_mv and the
 * listings_in_boundary pins), read only when the outline is trusted
 * (lib/communities/community-outline.ts). No MLS name match counts there: a
 * listing the MLS files under the community's name just outside its recorded
 * plats is not in it. A condo tract that genuinely belongs is added to the
 * OUTLINE, never matched by name (Black Butte Ranch's Country House condominium,
 * migration 20260925033420_black_butte_ranch_country_house_condo). Asked and answered
 * on these figures (outline vs name-inclusive, 2026-09-25): Eagle Crest 87 vs
 * 104, NorthWest Crossing 14 vs 18, Awbrey Glen 4 vs 8, Black Butte Ranch 32 vs
 * 36, Broken Top 19 vs 20, Juniper Preserve 40 vs 42, Brasada 83 vs 91.
 *
 * NO OUTLINE, NAMES. A community with no outline row (or an untrusted one) is
 * counted by the listings the MLS files under its names: the registry label,
 * aliases and former labels in the community's city, plus a resort's
 * alias-aware Field (the city's active residential tiles matched to the resort
 * by lib/kb/resort-active-counts). The page then draws its map from exactly
 * those keys (buildPlaceAtlas `listingKeys` plus `onMarket`), so the map and
 * the homes list still count one set.
 *
 * THE SWITCH is COMMUNITY_FOR_SALE_SCOPE below: 'outline' is Matt's rule.
 * 'outline-and-mls-names' is the pre-2026-09-25 homes list, kept so the
 * decision stays one constant and both surfaces move together.
 *
 * "For sale" is MLS status Active. Active Under Contract stays in the list
 * (the homes block shows it as under contract) and is drawn as a pending dot.
 *
 * Server only: it reads the DAL.
 */
import 'server-only'
import { getCommunityBySlug, getCommunityListings } from '@/app/actions/communities'
import { getGeoBoundaryMapData, getListingTiles, type AtlasTile, type ListingTile } from '@/lib/data'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { communityOutlineRef } from '@/lib/communities/community-outline'
import { communityRegistryContext } from '@/lib/communities/community-registry-context'
import { childAliasesOf } from '@/lib/communities/community-own-names'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { resortActiveSfrCounts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { loadPlaceStockTiles, placeStockIsForSale, unionListingTiles } from '@/lib/place/place-inventory-stock'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'

/** Which listings a community counts as its own. */
export type CommunityForSaleScope =
  /** Inside the trusted outline, plus the MLS name matches (the homes list before 2026-09-25). */
  | 'outline-and-mls-names'
  /** Inside the trusted outline only; a community with no trusted outline falls back to its names. */
  | 'outline'

/**
 * THE SWITCH. Matt 2026-09-25: recorded plats only. The map and the homes list
 * both follow it, and so do the page head's count and the Atlas dots route.
 */
export const COMMUNITY_FOR_SALE_SCOPE: CommunityForSaleScope = 'outline'

/** Row cap on the in-outline pin read and the name-narrowed city pull (unchanged from the page). */
const BOUNDARY_ROW_CAP = 200

/**
 * What the population is built from, as the switch decides it. Pure, so the
 * decision is tested without a database.
 *
 * `fieldFromOutline`: the page's Field came from the outline's own pins (a
 * non-resort community with a trusted outline), so it is outline, not name.
 */
export function communityPopulationPlan(input: {
  scope: CommunityForSaleScope
  outlineTrusted: boolean
  fieldFromOutline: boolean
}): { readOutline: boolean; includeNames: boolean; includeField: boolean } {
  const includeNames = input.scope === 'outline-and-mls-names' || !input.outlineTrusted
  return {
    readOutline: input.outlineTrusted,
    includeNames,
    includeField: includeNames || input.fieldFromOutline,
  }
}

/**
 * The population as the Atlas draws it: the listed tiles that are publicly on
 * the market and have a coordinate. Leases ride along (the Atlas keeps them
 * off the map and in its lease keys).
 */
export function communityAtlasTiles(tiles: readonly ListingTile[]): AtlasTile[] {
  const onMarket = new Set<string>(PUBLIC_ACTIVE_STATUSES)
  return tiles.flatMap((t): AtlasTile[] => {
    if (t.lat == null || t.lng == null || !onMarket.has(String(t.status))) return []
    const lat = Number(t.lat)
    const lng = Number(t.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [
      {
        listingKey: t.listingKey,
        listNumber: t.listNumber ?? null,
        status: t.status,
        listPrice: t.listPrice ?? null,
        closePrice: t.closePrice ?? null,
        closeDate: t.closeDate ?? null,
        onMarketDate: t.onMarketDate ?? null,
        modifiedAt: t.modifiedAt ?? null,
        lat,
        lng,
        city: t.city ?? null,
        subdivisionName: t.subdivisionName ?? null,
        propertyType: t.propertyType ?? null,
        propertySubType: t.propertySubType ?? null,
        streetNumber: t.streetNumber ?? null,
        streetName: t.streetName ?? null,
        streetSuffix: t.streetSuffix ?? null,
        photoUrl: t.photoUrl ?? null,
        beds: t.beds ?? null,
        baths: t.baths ?? null,
        sqft: t.sqft ?? null,
        boundaryCity: t.boundaryCity ?? null,
        boundaryNeighborhood: t.boundaryNeighborhood ?? null,
      },
    ]
  })
}

/**
 * The keys a page may call "for sale": status Active and a sale, not a
 * commercial lease. The map's "for sale" dots and the homes list's for-sale
 * rows are both this set of the one population.
 */
export function communityForSaleKeys(tiles: readonly Pick<ListingTile, 'listingKey' | 'status' | 'propertyType'>[]): string[] {
  const out = new Set<string>()
  for (const t of tiles) {
    if (t.status === 'Active' && placeStockIsForSale(t.propertyType) && t.listingKey) out.add(t.listingKey)
  }
  return [...out]
}

export type CommunityPopulation = {
  /** The URL slug the page was asked for (and the dots route's reference). */
  slug: string
  /** boundaries.geo_slug of the stored outline (the registry's durable slug), or null. */
  outlineSlug: string | null
  /** True when the outline exists and the trust rule allows it. Gates every outline read. */
  outlineTrusted: boolean
  /** The trusted outline, or null. The map draws this and nothing else. */
  outline: BoundaryGeometry | null
  scope: CommunityForSaleScope
  /** Every publicly active listing the page lists (homes and leases). */
  tiles: ListingTile[]
  /** The same listings on the market with a coordinate: the map's on-market dots. */
  atlasTiles: AtlasTile[]
  /** Status Active, a sale: the one "for sale" set. */
  forSaleKeys: string[]
  /**
   * True when the population came from MLS names (no trusted outline, or the
   * name-inclusive switch): the map is then drawn from these keys, and copy may
   * say the MLS names count toward the figures.
   */
  countsMlsNames: boolean
  /** The page's alias-aware Field (resort alias match, else outline pins, else the name-narrowed city pull). */
  fieldTiles: ListingTile[]
  /** The alias-aware single-family count (null when the community is not a resort in its city, or the city read failed). */
  aliasAwareCount: number | null
  /** The MLS City values the community lists under (registry city plus mls_cities). */
  cities: string[]
  /** False when any read timed out: the population is short, and the page must say so. */
  complete: boolean
}

/** The degraded population: nothing listed and `complete: false`, never "0 for sale". */
export function emptyCommunityPopulation(slug: string): CommunityPopulation {
  return {
    slug,
    outlineSlug: null,
    outlineTrusted: false,
    outline: null,
    scope: COMMUNITY_FOR_SALE_SCOPE,
    tiles: [],
    atlasTiles: [],
    forSaleKeys: [],
    countsMlsNames: false,
    fieldTiles: [],
    aliasAwareCount: null,
    cities: [],
    complete: false,
  }
}

/**
 * A community's for-sale population, from its URL slug alone, so the page and
 * the Atlas dots route build it the same way. Every read is one the page made
 * before 2026-09-25, with the same budget; a read that times out marks the
 * population incomplete rather than empty.
 */
export async function getCommunityPopulation(
  slug: string,
  scope: CommunityForSaleScope = COMMUNITY_FOR_SALE_SCOPE,
): Promise<CommunityPopulation | null> {
  const community = await getCommunityBySlug(slug)
  if (!community) return null
  const { resortMatch, resortSlug, registryEntry, rawName } = communityRegistryContext(community, slug)
  const cityName = community.city
  const citySlug = community.citySlug
  const isResortInCity = Boolean(resortMatch)
  const childAliases = registryEntry ? childAliasesOf(registryEntry, registryEntry.subdivision_aliases) : []
  const cities = [...new Set([cityName, ...(registryEntry?.mls_cities ?? [])])]
  // Keyed by the registry entry, never the URL (juniper-preserve reads 'pronghorn').
  const outlineRef = registryEntry ? communityOutlineRef(registryEntry.slug) : null

  const [boundaryRead, citySfrRead] = await Promise.all([
    outlineRef?.trusted
      ? withTimeoutFallbackResult(
          getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: outlineRef.outlineSlug }),
          { polygon: null, pins: [] },
          4500,
          'comm-pop:outline',
        )
      : Promise.resolve({ value: { polygon: null, pins: [] }, ok: true }),
    isResortInCity
      ? withTimeoutFallbackResult(
          Promise.all(cities.map((c) => fetchAllCityActiveSfr(c))).then((sets) => sets.flat()),
          [] as ListingTile[],
          9000,
          'comm-pop:citySfr',
        )
      : Promise.resolve({ value: [] as ListingTile[], ok: true }),
  ])

  const outline = outlineRef?.trusted ? (boundaryRead.value.polygon ?? null) : null
  const outlineTrusted = outline != null
  const outlinePinKeys = outlineTrusted ? boundaryRead.value.pins.map((p) => p.listingKey) : []
  const citySfrTiles = citySfrRead.ok ? citySfrRead.value : []
  let complete = boundaryRead.ok && citySfrRead.ok

  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0
  const usedSubdivisionNarrowing = !useResortTiles && outlinePinKeys.length === 0
  let communityTiles: ListingTile[] = resortTiles
  if (!useResortTiles) {
    const read = await withTimeoutFallbackResult(
      outlinePinKeys.length > 0
        ? getListingTiles({ listingKeys: outlinePinKeys, status: 'active', propertyType: 'A', limit: BOUNDARY_ROW_CAP })
        : getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: 1500 }),
      [],
      4500,
      outlinePinKeys.length > 0 ? 'comm-pop:tiles' : 'comm-pop:tiles-fallback',
    )
    complete &&= read.ok
    communityTiles = read.value
  }
  if (usedSubdivisionNarrowing) {
    const subRead = await withTimeoutFallbackResult(
      getCommunityListings(cityName, community.subdivision, BOUNDARY_ROW_CAP),
      [],
      4500,
      'comm-pop:sub-listings',
    )
    complete &&= subRead.ok
    const subKeys = new Set(subRead.value.map((r) => r.ListingKey).filter(Boolean) as string[])
    communityTiles = communityTiles.filter((t) => subKeys.has(t.listingKey))
  }

  const haveCityTiles = citySfrRead.ok && isResortInCity && citySfrTiles.length > 0
  const aliasAwareCount = haveCityTiles
    ? (resortActiveSfrCounts(citySlug, citySfrTiles).get(resortSlug) ?? null)
    : null
  const fieldTiles = aliasAwareCount != null ? resortTiles : communityTiles
  const fieldFromOutline = aliasAwareCount == null && !useResortTiles && outlinePinKeys.length > 0

  const plan = communityPopulationPlan({ scope, outlineTrusted, fieldFromOutline })
  const field = plan.includeField ? fieldTiles : []
  const stockRead = await withTimeoutFallbackResult(
    loadPlaceStockTiles({
      listingKeys: [...(plan.readOutline ? outlinePinKeys : []), ...field.map((tile) => tile.listingKey)],
      subdivisionNames: plan.includeNames
        ? [...getSubdivisionMatchNames(community.subdivision || rawName), ...childAliases]
        : [],
      city: cityName,
      boundary: plan.readOutline && outlineRef ? { geoType: 'neighborhood', geoSlug: outlineRef.outlineSlug } : null,
    }),
    [],
    12000,
    'comm-pop:stock',
  )
  complete &&= stockRead.ok
  const tiles = unionListingTiles(stockRead.value, field)

  return {
    slug,
    outlineSlug: outlineRef?.outlineSlug ?? null,
    outlineTrusted,
    outline,
    scope,
    tiles,
    atlasTiles: communityAtlasTiles(tiles),
    forSaleKeys: communityForSaleKeys(tiles),
    countsMlsNames: plan.includeNames,
    fieldTiles,
    aliasAwareCount,
    cities,
    complete,
  }
}
