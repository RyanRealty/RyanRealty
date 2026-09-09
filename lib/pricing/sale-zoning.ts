/**
 * A rural sale's zoning class needs a zone string. The MLS field is the
 * sentinel "********" on three rural closes in four (measured 2026-09-09), so
 * the county GIS zoning layer answers by coordinates, once per listing key,
 * through public.cma_sale_zone_cache. Bounded per build: the nearest sales
 * first, at most MAX_LOOKUPS live queries; the rest stay unknown this build
 * (fail-open) and fill the cache on the next.
 */
import { getSaleZoneCache, upsertSaleZoneCache, type SaleZoneCacheRow } from '@/lib/data/cma/sale-zone-cache'
import { lookupCountyZone } from '@/lib/cma/county'
import { zoningClass } from '@/lib/pricing/rural'

export type SaleZoneInput = {
  listingKey: string
  latitude: number | null
  longitude: number | null
  /** The MLS zone string when the row has one; a sentinel is treated as none. */
  mlsZoning?: string | null
}

export const MAX_ZONE_LOOKUPS = 40
const CONCURRENCY = 6

export async function resolveSaleZones(
  sales: readonly SaleZoneInput[],
  opts: { maxLookups?: number; lookup?: typeof lookupCountyZone; cache?: { get: typeof getSaleZoneCache; put: typeof upsertSaleZoneCache } } = {},
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (sales.length === 0) return out
  const get = opts.cache?.get ?? getSaleZoneCache
  const put = opts.cache?.put ?? upsertSaleZoneCache
  const lookup = opts.lookup ?? lookupCountyZone

  const cached = await get(sales.map((s) => s.listingKey))
  const pending: SaleZoneInput[] = []
  const fromMls: SaleZoneCacheRow[] = []
  for (const s of sales) {
    const hit = cached.get(s.listingKey)
    if (hit) {
      out.set(s.listingKey, hit.zone)
      continue
    }
    if (zoningClass(s.mlsZoning) !== 'unknown') {
      out.set(s.listingKey, s.mlsZoning ?? null)
      fromMls.push({ listingKey: s.listingKey, lat: s.latitude, lng: s.longitude, zone: s.mlsZoning ?? null, zoneType: null, source: 'mls' })
      continue
    }
    if (s.latitude != null && s.longitude != null) pending.push(s)
  }
  if (fromMls.length) await put(fromMls)

  const todo = pending.slice(0, opts.maxLookups ?? MAX_ZONE_LOOKUPS)
  const found: SaleZoneCacheRow[] = []
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const part = todo.slice(i, i + CONCURRENCY)
    const results = await Promise.all(part.map((s) => lookup(s.latitude, s.longitude)))
    part.forEach((s, j) => {
      const r = results[j]
      if (!r) return // query failed: unknown this build, no cache row
      out.set(s.listingKey, r.zone)
      found.push({ listingKey: s.listingKey, lat: s.latitude, lng: s.longitude, zone: r.zone, zoneType: r.zoneType, source: 'deschutes-gis' })
    })
  }
  if (found.length) await put(found)
  return out
}
