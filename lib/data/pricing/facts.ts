/**
 * Pricing-moat DAL. sale_pricing_facts is the SoR for every future close-price
 * estimate. Service-role only (RLS on, no anon policies).
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §2b / §4. No listings.details on this path.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'
import type { PricingSale, SubdivisionCell } from '@/lib/pricing/match'
import { plausibleListedClose, type HoaClass, type LotClass, type ProductKey, type SewerClass, type StoryClass, type WaterClass } from '@/lib/pricing/classes'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

const FACT_COLS = [
  'listing_key',
  'list_number',
  'street_number',
  'street_name',
  'city',
  'city_slug',
  'subdivision',
  'subdivision_norm',
  'latitude',
  'longitude',
  'product_class',
  'beds',
  'baths',
  'sqft',
  'year_built',
  'lot_acres',
  'lot_class',
  'story_class',
  'water_class',
  'sewer_class',
  'hoa_class',
  'close_price',
  'close_date',
  'concessions_amount',
  'concessions_yn',
  'original_ask',
  'last_ask',
  'days_to_offer',
  'cdom',
  'drop_count',
  'close_ppsf',
  'photo_url',
  'public_remarks',
  'new_construction_yn',
  'flag_new_construction',
].join(', ')

function rowToSale(r: Record<string, unknown>): PricingSale | null {
  const closePrice = Number(r.close_price)
  const sqft = Number(r.sqft)
  const closeDate = typeof r.close_date === 'string' ? r.close_date.slice(0, 10) : null
  const listingKey = typeof r.listing_key === 'string' ? r.listing_key : null
  if (!listingKey || !closeDate || !closePrice || closePrice <= 0 || !sqft || sqft < 300) return null
  const lastAsk = r.last_ask != null ? Number(r.last_ask) : null
  if (!plausibleListedClose(closePrice, lastAsk)) return null
  const street = `${r.street_number ?? ''} ${r.street_name ?? ''}`.trim()
  return {
    listingKey,
    listNumber: typeof r.list_number === 'string' ? r.list_number : null,
    address: street,
    city: String(r.city ?? ''),
    citySlug: String(r.city_slug ?? ''),
    subdivision: typeof r.subdivision === 'string' ? r.subdivision : null,
    subdivisionNorm: typeof r.subdivision_norm === 'string' ? r.subdivision_norm : null,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    beds: r.beds != null ? Number(r.beds) : null,
    baths: r.baths != null ? Number(r.baths) : null,
    sqft,
    lotAcres: r.lot_acres != null ? Number(r.lot_acres) : null,
    yearBuilt: r.year_built != null ? Number(r.year_built) : null,
    storyClass: (r.story_class as StoryClass) ?? 'unknown',
    productClass: (r.product_class as ProductKey) ?? 'unknown',
    waterClass: (r.water_class as WaterClass) ?? 'unknown',
    sewerClass: (r.sewer_class as SewerClass) ?? 'unknown',
    hoaClass: (r.hoa_class as HoaClass) ?? 'unknown',
    lotClass: (r.lot_class as LotClass) ?? 'unknown',
    closePrice,
    closeDate,
    concessionsAmount: r.concessions_amount != null ? Number(r.concessions_amount) : null,
    concessionsYn: typeof r.concessions_yn === 'string' ? r.concessions_yn : null,
    originalAsk: r.original_ask != null ? Number(r.original_ask) : null,
    lastAsk,
    daysToOffer: r.days_to_offer != null ? Number(r.days_to_offer) : null,
    cdom: r.cdom != null ? Number(r.cdom) : null,
    dropCount: Number(r.drop_count ?? 0),
    closePpsf: Number(r.close_ppsf ?? closePrice / sqft),
    photoUrl: typeof r.photo_url === 'string' ? r.photo_url : null,
    publicRemarks: typeof r.public_remarks === 'string' ? r.public_remarks : null,
    newConstruction:
      r.new_construction_yn === true || r.flag_new_construction === true
        ? true
        : r.new_construction_yn === false
          ? false
          : null,
  }
}

export async function countSalePricingFacts(): Promise<number> {
  const sb = client()
  if (!sb) return 0
  const { count, error } = await sb.from('sale_pricing_facts').select('listing_key', { count: 'exact', head: true })
  if (error) {
    console.error('[countSalePricingFacts]', error.message)
    return 0
  }
  return count ?? 0
}

export async function selectPricingFactsPool(opts: {
  citySlug: string | null
  closeBefore: string
  closeAfter: string
  sqftMin: number
  sqftMax: number
  productClass?: string | null
  ignoreCity?: boolean
  limit?: number
}): Promise<PricingSale[]> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('sale_pricing_facts')
    .select(FACT_COLS)
    .lt('close_date', opts.closeBefore)
    .gte('close_date', opts.closeAfter)
    .gte('sqft', opts.sqftMin)
    .lte('sqft', opts.sqftMax)
    .gt('close_price', 0)
  if (!opts.ignoreCity && opts.citySlug) q = q.eq('city_slug', opts.citySlug)
  if (opts.productClass && opts.productClass !== 'unknown') q = q.eq('product_class', opts.productClass)
  const { data, error } = await q.order('close_date', { ascending: false }).limit(Math.min(opts.limit ?? 800, 1000))
  if (error) {
    console.error('[selectPricingFactsPool]', error.message)
    return []
  }
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map((r) => rowToSale(r))
    .filter((r): r is PricingSale => r != null)
}

/**
 * THE SUBJECT'S OWN GROUND, COMPLETE — every sale inside a box around the
 * subject across the whole window, rather than the newest N sales citywide.
 *
 * Why this exists (Matt 2026-09-10, 23 Benaiah). `selectPricingFactsPool`
 * orders by close date and caps the read, so for a Bend subject the pool
 * reaches back about SIX months, not the eighteen it asks for: 2,471 Bend
 * sales matched that window on 2026-09-10 and the read returned 800, the
 * oldest closing 2026-03-10. Every rung below that line — the 9-, 12-, 18- and
 * 24-month subdivision rungs, the adjacent-plat rungs, the community rungs —
 * was walking a pool with nothing older in it. The ladder then left the
 * neighborhood, and the report said the neighborhood was exhausted, when what
 * was exhausted was the POOL. The identical floorplan next door at 31 Benaiah,
 * sold fourteen months earlier, was never a candidate at all.
 *
 * A box, not a city: containment is measured from the subject, and a sale four
 * blocks away does not stop being local because its mailing city differs.
 * Paged, so the local window is complete instead of truncated.
 */
export async function selectPricingFactsNear(opts: {
  latitude: number
  longitude: number
  radiusMiles: number
  closeBefore: string
  closeAfter: string
  sqftMin: number
  sqftMax: number
  productClass?: string | null
  maxRows?: number
}): Promise<PricingSale[]> {
  const sb = client()
  if (!sb) return []
  if (!Number.isFinite(opts.latitude) || !Number.isFinite(opts.longitude)) return []
  const dLat = opts.radiusMiles / 69
  const cos = Math.abs(Math.cos((opts.latitude * Math.PI) / 180))
  const dLng = opts.radiusMiles / (69 * Math.max(cos, 0.1))
  const { rows, error } = await fetchPagedRows<Record<string, unknown>>((from, to) => {
    let q = sb
      .from('sale_pricing_facts')
      .select(FACT_COLS)
      .lt('close_date', opts.closeBefore)
      .gte('close_date', opts.closeAfter)
      .gte('sqft', opts.sqftMin)
      .lte('sqft', opts.sqftMax)
      .gt('close_price', 0)
      .gte('latitude', opts.latitude - dLat)
      .lte('latitude', opts.latitude + dLat)
      .gte('longitude', opts.longitude - dLng)
      .lte('longitude', opts.longitude + dLng)
    if (opts.productClass && opts.productClass !== 'unknown') q = q.eq('product_class', opts.productClass)
    // Stable total order — range paging without one skips and duplicates rows.
    return q
      .order('close_date', { ascending: false })
      .order('listing_key', { ascending: false })
      .range(from, to)
  }, opts.maxRows ?? 3000)
  if (error) {
    console.error('[selectPricingFactsNear]', error.message)
    return []
  }
  return rows.map((r) => rowToSale(r)).filter((r): r is PricingSale => r != null)
}

export async function getPricingMarketIndex(citySlug: string): Promise<MarketIndexPoint[]> {
  const sb = client()
  if (!sb) return []
  const { data, error } = await sb
    .from('pricing_market_index')
    .select('month, n, median_ppsf, median_sale_to_original, median_days_to_offer')
    .eq('city_slug', citySlug)
    .order('month', { ascending: true })
    .limit(400)
  if (error) {
    console.error('[getPricingMarketIndex]', error.message)
    return []
  }
  return (data ?? [])
    .map((r) => ({
      month: String(r.month).slice(0, 10),
      ppsf: Number(r.median_ppsf),
      n: Number(r.n),
      saleToOriginal: r.median_sale_to_original != null ? Number(r.median_sale_to_original) : null,
      daysToOffer: r.median_days_to_offer != null ? Number(r.median_days_to_offer) : null,
    }))
    .filter((p) => p.ppsf > 0)
}

export async function getPricingSubdivisionCells(citySlug: string): Promise<Map<string, SubdivisionCell>> {
  const sb = client()
  const out = new Map<string, SubdivisionCell>()
  if (!sb) return out
  const { rows, error } = await fetchPagedRows<{
    city_slug: string
    subdivision_norm: string | null
    n: number
    median_ppsf: number
  }>((from, to) =>
    sb
      .from('pricing_subdivision_cells')
      .select('city_slug, subdivision_norm, n, median_ppsf')
      .eq('city_slug', citySlug)
      .order('subdivision_norm', { ascending: true })
      .range(from, to),
  )
  if (error) {
    console.error('[getPricingSubdivisionCells]', error.message)
    return out
  }
  for (const r of rows) {
    const sub = typeof r.subdivision_norm === 'string' ? r.subdivision_norm : null
    if (!sub) continue
    out.set(`${r.city_slug}:${sub}`, { medianPpsf: Number(r.median_ppsf), n: Number(r.n) })
  }
  return out
}

/** One-row WaterSource read. Safe: bounded by ListingKey. */
export async function getListingWaterSource(listingKey: string): Promise<unknown> {
  const sb = client()
  if (!sb || !listingKey.trim()) return null
  const canonicalKey = await resolveCanonicalListingKey(listingKey)
  const { data, error } = await sb
    .from('listings')
    .select('water, details->WaterSource')
    .eq('ListingKey', canonicalKey)
    .maybeSingle()
  if (error || !data) return null
  const fromDetails = (data as { WaterSource?: unknown }).WaterSource
  return fromDetails ?? data.water ?? null
}
