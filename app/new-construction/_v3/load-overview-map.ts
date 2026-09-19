/**
 * Overview map for /new-construction.
 *
 * Regions: recorded Bend plats that match a named NC community.
 * Dots: live Active Bend new-construction tiles with coordinates.
 * No invented centroids. A name without a recorded polygon is omitted.
 */
import { getBoundaryGeoJSON, getCommunitySubdivisions, searchListingsAll } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import type { AtlasDot, AtlasRegion, AtlasType } from '@/components/site/v3'
import { atlasTypesPresent } from '@/lib/atlas/build-place-atlas'
import { classifyType } from '@/app/_v3/home-field-items'
import { formatDateTime } from '@/lib/format/date'
import { listingTileHref, slugify } from '@/lib/slug'
import { basemapForRegions, type Basemap } from '@/lib/geo/basemap-source'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  BEND_NEW_CON_MAP_SOURCE,
  BEND_NEW_CON_NAMED,
  bendNewConPlatMatchesName,
  bendNewConSearchHref,
} from '@/lib/site/bend-new-construction'

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
}

function dalReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url?.trim() && key?.trim())
}

function emptyMap(incomplete: boolean): NewConOverviewMap {
  return {
    regions: [],
    dots: [],
    types: [],
    source: BEND_NEW_CON_MAP_SOURCE,
    stamp: formatDateTime(new Date()),
    incomplete,
    outlinedNamed: 0,
    namedTotal: BEND_NEW_CON_NAMED.length,
    basemap: null,
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
        p: price != null && Number.isFinite(price) && price > 0 ? Math.round(price) : null,
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

export async function loadNewConOverviewMap(): Promise<NewConOverviewMap> {
  if (!dalReady()) return emptyMap(true)

  try {
    const [cityBound, plats, listings] = await Promise.all([
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
      withTimeoutFallback(
        searchListingsAll({
          city: 'Bend',
          newConstruction: true,
          status: 'active',
          limit: 400,
        }),
        { rows: [], totalCount: 0, capped: false, countIsExact: true },
        8000,
        'newcon:listings',
      ),
    ])

    const matchedBySlug = new Map<string, { name: string; region: AtlasRegion }>()
    for (const row of BEND_NEW_CON_NAMED) {
      const hit = plats.find((plat) => bendNewConPlatMatchesName(row.name, plat))
      if (!hit || matchedBySlug.has(hit.slug)) continue
      matchedBySlug.set(hit.slug, {
        name: row.name,
        region: {
          id: `subdivision:${hit.slug}`,
          kind: 'subdivision',
          name: row.name,
          href: bendNewConSearchHref(row.name),
          geometry: hit.geometry,
        },
      })
    }

    const unmatched = BEND_NEW_CON_NAMED.filter(
      (row) => !plats.some((plat) => bendNewConPlatMatchesName(row.name, plat)),
    )
    const extras = await Promise.all(
      unmatched.map(async (row) => {
        const slug = slugify(row.name)
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
            name: row.name,
            href: bendNewConSearchHref(row.name),
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

    const dots = dotsFromTiles(listings.rows)
    const types = atlasTypesPresent(dots)
    const listingsOk = listings.rows.length > 0 || listings.countIsExact
    const incomplete = !cityBound && regions.length === 0 && dots.length === 0

    return {
      regions,
      dots,
      types,
      source: BEND_NEW_CON_MAP_SOURCE,
      stamp: formatDateTime(new Date()),
      incomplete: incomplete || !listingsOk,
      outlinedNamed: matchedBySlug.size,
      namedTotal: BEND_NEW_CON_NAMED.length,
      basemap: regions.length > 0 ? basemapForRegions(regions, { dots, fit: 'regions' }) : null,
    }
  } catch (err) {
    console.error('[loadNewConOverviewMap]', err)
    return emptyMap(true)
  }
}
