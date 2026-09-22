/**
 * Overview map for /new-construction.
 *
 * Regions: recorded Bend plats that match a LIVE named NC community.
 * Dots: live Active Bend-proper new-construction tiles with coordinates.
 * No invented centroids. A name without a recorded polygon is omitted.
 * One V3Atlas. Do not edit V3Atlas.client.tsx (SITE-159).
 */
import { getBoundaryGeoJSON, getCommunitySubdivisions } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import type { AtlasDot, AtlasRegion, AtlasType } from '@/components/site/v3'
import { atlasTypesPresent } from '@/lib/atlas/build-place-atlas'
import { ATLAS_PIN_MIN_USD } from '@/lib/atlas/pin-price'
import { classifyType } from '@/app/_v3/home-field-items'
import { formatDateTime } from '@/lib/format/date'
import { listingTileHref, slugify } from '@/lib/slug'
import { basemapForRegions, type Basemap } from '@/lib/geo/basemap-source'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  BEND_NEW_CON_MAP_SOURCE,
  bendNewConPlatMatchesName,
  bendNewConSearchHref,
} from '@/lib/site/bend-new-construction'
import type { BendNewConLiveMarket } from './load-live-market'

export type NewConOverviewMap = {
  regions: AtlasRegion[]
  dots: AtlasDot[]
  types: AtlasType[]
  source: string
  stamp: string
  incomplete: boolean
  outlinedNamed: number
  namedTotal: number
  basemap: Basemap | null
  /** Bend-proper live Active count from the same pull that draws the dots. */
  liveTotal: number | null
}

function dalReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url?.trim() && key?.trim())
}

function emptyMap(incomplete: boolean, namedTotal = 0): NewConOverviewMap {
  return {
    regions: [],
    dots: [],
    types: [],
    source: BEND_NEW_CON_MAP_SOURCE,
    stamp: formatDateTime(new Date()),
    incomplete,
    outlinedNamed: 0,
    namedTotal,
    basemap: null,
    liveTotal: null,
  }
}

function dotsFromTiles(tiles: readonly ListingTile[]): AtlasDot[] {
  return tiles.flatMap((tile): AtlasDot[] => {
    if (tile.lat == null || tile.lng == null) return []
    if (!Number.isFinite(tile.lat) || !Number.isFinite(tile.lng)) return []
    const status = tile.status
    const s =
      status === 'Pending' || status === 'Active Under Contract'
        ? 'pending'
        : status === 'Active'
          ? 'active'
          : null
    if (!s) return []
    const { typeKey } = classifyType({
      propertyType: tile.propertyType,
      propertySubType: tile.propertySubType,
    })
    const price = tile.listPrice != null ? Number(tile.listPrice) : null
    return [
      {
        k: tile.listingKey,
        href: listingTileHref(tile),
        lat: Number(tile.lat.toFixed(4)),
        lng: Number(tile.lng.toFixed(4)),
        p:
          price != null && Number.isFinite(price) && price >= ATLAS_PIN_MIN_USD
            ? Math.round(price)
            : null,
        t: typeKey,
        s,
        age: tile.dom ?? null,
        photo: tile.photoUrl,
        street: [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ') || null,
        beds: tile.beds,
        baths: tile.baths,
        sqft: tile.sqft,
      },
    ]
  })
}

export async function loadNewConOverviewMap(
  market: BendNewConLiveMarket,
): Promise<NewConOverviewMap> {
  if (!dalReady()) return emptyMap(true, market.namedCount)

  try {
    const namedNames = market.named.map((row) => row.name)
    const [cityBound, plats] = await Promise.all([
      withTimeoutFallback(
        getBoundaryGeoJSON({ geoType: 'city', geoSlug: 'bend' }),
        null,
        6000,
        'newcon:city-bound',
      ),
      withTimeoutFallback(
        getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' }),
        [],
        8000,
        'newcon:plats',
      ),
    ])

    const matchedBySlug = new Map<string, { name: string; region: AtlasRegion }>()
    for (const name of namedNames) {
      const hit = plats.find((plat) => bendNewConPlatMatchesName(name, plat))
      if (!hit || matchedBySlug.has(hit.slug)) continue
      matchedBySlug.set(hit.slug, {
        name,
        region: {
          id: `subdivision:${hit.slug}`,
          kind: 'subdivision',
          name,
          href: bendNewConSearchHref(name),
          geometry: hit.geometry,
        },
      })
    }

    const unmatched = namedNames.filter(
      (name) => !plats.some((plat) => bendNewConPlatMatchesName(name, plat)),
    )
    const extras = await Promise.all(
      unmatched.map(async (name) => {
        const slug = slugify(name)
        const geometry = await withTimeoutFallback(
          getBoundaryGeoJSON({ geoType: 'subdivision', geoSlug: slug }),
          null,
          4000,
          `newcon:bound:${slug}`,
        )
        if (!geometry) return null
        return {
          slug,
          region: {
            id: `subdivision:${slug}`,
            kind: 'subdivision' as const,
            name,
            href: bendNewConSearchHref(name),
            geometry,
          },
        }
      }),
    )
    for (const extra of extras) {
      if (!extra || matchedBySlug.has(extra.slug)) continue
      matchedBySlug.set(extra.slug, { name: extra.region.name, region: extra.region })
    }

    const regions: AtlasRegion[] = []
    if (cityBound) {
      regions.push({
        id: 'city:bend',
        kind: 'town',
        kindLabel: 'City',
        name: 'Bend',
        href: '/cities/bend',
        geometry: cityBound,
      })
    }
    regions.push(...[...matchedBySlug.values()].map((entry) => entry.region))

    const dots = dotsFromTiles(market.bendTiles)
    const types = atlasTypesPresent(dots)
    const incomplete =
      market.incomplete || (!cityBound && regions.length === 0 && dots.length === 0)

    return {
      regions,
      dots,
      types,
      source: BEND_NEW_CON_MAP_SOURCE,
      stamp: formatDateTime(new Date()),
      incomplete,
      outlinedNamed: matchedBySlug.size,
      namedTotal: namedNames.length,
      basemap: regions.length > 0 ? basemapForRegions(regions, { dots, fit: 'regions' }) : null,
      liveTotal: market.listingsOk ? market.homeCount : null,
    }
  } catch (err) {
    console.error('[loadNewConOverviewMap]', err)
    return emptyMap(true, market.namedCount)
  }
}
