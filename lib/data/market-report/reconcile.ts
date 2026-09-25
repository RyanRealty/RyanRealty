/**
 * Monthly market report: the Supabase side of the Spark reconciliation gate.
 *
 * CLAUDE.md §0 makes a Spark × Supabase cross-check a hard pre-render gate for
 * market reports. The gate must test the sales an edition publishes, so it
 * reads the edition's own population: `market_report_sale` rows (publishable
 * sales carrying their report geographies, built from place membership), not a
 * second copy keyed a different way. A closing Spark knows that is missing
 * here is then looked up in `market_fact_sale`, to tell a sale left out by
 * method (a duplicate parcel entry, a price typo) from one that never reached
 * us.
 */
import { createServiceClient } from '@/lib/data/client'

export type ReportSaleRow = {
  listing_key: string
  close_date: string
  close_price: number | null
  base_segment: string
  lot_acres: number | null
  geos: string[]
}

/** Every sale the report counts with a close date in [from, to] (inclusive dates), all geographies and segments. */
export async function getReportSalesInWindow(from: string, to: string): Promise<ReportSaleRow[]> {
  const sb = createServiceClient()
  const out: ReportSaleRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from('market_report_sale')
      .select('listing_key, close_date, close_price, base_segment, lot_acres, geos')
      .gte('close_date', from)
      .lte('close_date', to)
      .order('listing_key')
      .range(offset, offset + 999)
    if (error) throw new Error(`[getReportSalesInWindow ${from}..${to}] ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const r of rows) {
      out.push({
        listing_key: String(r.listing_key),
        close_date: String(r.close_date).slice(0, 10),
        close_price: r.close_price == null ? null : Number(r.close_price),
        base_segment: String(r.base_segment),
        lot_acres: r.lot_acres == null ? null : Number(r.lot_acres),
        geos: Array.isArray(r.geos) ? (r.geos as string[]) : [],
      })
    }
    if (rows.length < 1000) break
  }
  return out
}

export type FactSaleStatus = { listing_key: string; is_publishable: boolean; exclusion_reasons: string[] }

/** Whether each of these listings has a sale fact, and whether it is publishable. */
export async function getFactSaleStatus(keys: string[]): Promise<Map<string, FactSaleStatus>> {
  const sb = createServiceClient()
  const out = new Map<string, FactSaleStatus>()
  const unique = [...new Set(keys)]
  for (let i = 0; i < unique.length; i += 150) {
    const { data, error } = await sb
      .from('market_fact_sale')
      .select('listing_key, is_publishable, exclusion_reasons')
      .in('listing_key', unique.slice(i, i + 150)) // @canonical-key — Spark ListingKey values, the key market_fact_sale is keyed by
    if (error) throw new Error(`[getFactSaleStatus] ${error.message}`)
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      out.set(String(r.listing_key), {
        listing_key: String(r.listing_key),
        is_publishable: r.is_publishable === true,
        exclusion_reasons: Array.isArray(r.exclusion_reasons) ? (r.exclusion_reasons as string[]) : [],
      })
    }
  }
  return out
}

export type ServiceAreaCity = { city: string; slug: string }

/**
 * The MLS city names that make up the Central Oregon service area, with the
 * city slug each takes. The same table place membership reads: a listing is in
 * the region when its city matches one of these without case, and its city
 * geography takes that slug.
 */
export async function getServiceAreaCities(): Promise<ServiceAreaCity[]> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('market_service_area').select('city_proper, city_slug').order('city_proper')
  if (error) throw new Error(`[getServiceAreaCities] ${error.message}`)
  return ((data ?? []) as { city_proper: string | null; city_slug: string | null }[])
    .map((r) => ({ city: String(r.city_proper ?? '').trim(), slug: String(r.city_slug ?? '').trim() }))
    .filter((r) => r.city && r.slug)
}
