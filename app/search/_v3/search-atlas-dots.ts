import { classifyType } from '@/app/_v3/home-field-items'
import type { AtlasDot, AtlasRegion, AtlasType } from '@/components/site/v3'
import { formatPriceCompact } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'

export const SEARCH_ATLAS_TYPES: readonly AtlasType[] = [
  { key: 'house', label: 'House' },
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'manufactured', label: 'Manufactured' },
  { key: 'land', label: 'Land' },
  { key: 'multi', label: 'Multi-family' },
  { key: 'commercial', label: 'Commercial' },
]

export type SearchAtlasListing = {
  ListingKey?: string | null
  ListNumber?: string | null
  ListPrice?: number | string | null
  Latitude?: number | string | null
  Longitude?: number | string | null
  StandardStatus?: string | null
  OnMarketDate?: string | null
  PropertyType?: string | null
  PropertySubType?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  SubdivisionName?: string | null
  BoundaryCity?: string | null
  BoundaryNeighborhood?: string | null
}

function dotStatus(status: string | null | undefined): AtlasDot['s'] | null {
  if (status === 'Active') return 'active'
  if (status === 'Active Under Contract' || status === 'Pending') return 'pending'
  if (status === 'Closed') return 'sold'
  return null
}

function daysAgo(nowMs: number, iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 86_400_000)) : null
}

export function searchListingsToAtlasDots(
  listings: readonly SearchAtlasListing[],
  nowMs = Date.now(),
): AtlasDot[] {
  return listings.flatMap((row): AtlasDot[] => {
    const key = row.ListingKey ?? row.ListNumber
    const lat = row.Latitude != null ? Number(row.Latitude) : NaN
    const lng = row.Longitude != null ? Number(row.Longitude) : NaN
    if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    const s = dotStatus(row.StandardStatus)
    if (!s) return []
    const raw = row.ListPrice != null ? Number(row.ListPrice) : null
    const { typeKey } = classifyType({
      propertyType: row.PropertyType,
      propertySubType: row.PropertySubType,
    })
    return [
      {
        k: String(key),
        href: listingTileHref({
          listingKey: String(key),
          listNumber: row.ListNumber ?? null,
          streetNumber: row.StreetNumber ?? null,
          streetName: row.StreetName ?? null,
          city: row.City ?? null,
          boundaryCity: row.BoundaryCity ?? null,
          boundaryNeighborhood: row.BoundaryNeighborhood ?? null,
          subdivisionName: row.SubdivisionName ?? null,
        }),
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        p: raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
        t: typeKey,
        s,
        age: daysAgo(nowMs, row.OnMarketDate),
      },
    ]
  })
}

export function searchAtlasTypes(dots: readonly AtlasDot[]): AtlasType[] {
  const present = new Set(dots.filter((d) => d.s !== 'sold').map((d) => d.t))
  return SEARCH_ATLAS_TYPES.filter((t) => present.has(t.key))
}

export function searchAtlasClaim(dots: readonly AtlasDot[], place: string): string {
  const live = dots.filter((d) => d.s === 'active' || d.s === 'pending')
  const prices = live.map((d) => d.p).filter((p): p is number => typeof p === 'number' && p > 0)
  const where = place.trim()
  if (live.length === 0) {
    return where ? `No homes plotted in ${where} yet.` : 'No homes plotted in this view yet.'
  }
  const noun = live.length === 1 ? 'home' : 'homes'
  const count = `${live.length} ${noun}`
  const inPlace = where ? ` in ${where}` : ''
  if (prices.length === 0) return `${count}${inPlace}.`
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  if (lo === hi) return `${count}${inPlace}, asking ${formatPriceCompact(lo)}.`
  return `${count}${inPlace}, ${formatPriceCompact(lo)} to ${formatPriceCompact(hi)}.`
}

export function searchAtlasRegions(
  name: string,
  href: string,
  geometry: GeoJSON.Geometry | null | undefined,
): AtlasRegion[] {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return []
  return [
    {
      id: href.replace(/^\//, '').replace(/\//g, ':') || 'place',
      kind: 'town',
      name,
      href,
      geometry,
    },
  ]
}
