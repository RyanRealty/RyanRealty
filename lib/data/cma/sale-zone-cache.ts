import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * `public.cma_sale_zone_cache` (migration 20260909150000): a sale's county
 * base zone by listing key, read once from the GIS zoning layer. A row with a
 * null zone is a recorded miss (outside the layer), not an unread key.
 */
export type SaleZoneCacheRow = {
  listingKey: string
  lat: number | null
  lng: number | null
  zone: string | null
  zoneType: string | null
  source: string
}

export async function getSaleZoneCache(keys: readonly string[]): Promise<Map<string, SaleZoneCacheRow>> {
  const out = new Map<string, SaleZoneCacheRow>()
  const clean = [...new Set(keys.map((k) => String(k ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return out
  const sb = createServiceClient()
  for (let i = 0; i < clean.length; i += 200) {
    const part = clean.slice(i, i + 200)
    const { data, error } = await sb
      .from('cma_sale_zone_cache')
      .select('listing_key, lat, lng, zone, zone_type, source')
      // @canonical-key — the selector's own ListingKeys, read from listings or sale_pricing_facts
      .in('listing_key', part)
    if (error) {
      console.error('[getSaleZoneCache]', error.message)
      continue
    }
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      out.set(String(r.listing_key), {
        listingKey: String(r.listing_key),
        lat: r.lat == null ? null : Number(r.lat),
        lng: r.lng == null ? null : Number(r.lng),
        zone: (r.zone as string | null) ?? null,
        zoneType: (r.zone_type as string | null) ?? null,
        source: String(r.source ?? ''),
      })
    }
  }
  return out
}

export async function upsertSaleZoneCache(rows: readonly SaleZoneCacheRow[]): Promise<void> {
  if (rows.length === 0) return
  const sb = createServiceClient()
  const { error } = await sb.from('cma_sale_zone_cache').upsert(
    rows.map((r) => ({
      listing_key: r.listingKey,
      lat: r.lat,
      lng: r.lng,
      zone: r.zone,
      zone_type: r.zoneType,
      source: r.source,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: 'listing_key' },
  )
  if (error) console.error('[upsertSaleZoneCache]', error.message)
}
