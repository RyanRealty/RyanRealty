/**
 * Pricing-moat DAL. sale_pricing_facts is the SoR for every future close-price
 * estimate. Service-role only (RLS on, no anon policies).
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §2b / §4. No listings.details on this path.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'
import type { PricingSale, SubdivisionCell } from '@/lib/pricing/match'
import type { HoaClass, LotClass, ProductKey, SewerClass, StoryClass, WaterClass } from '@/lib/pricing/classes'

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
].join(', ')

function rowToSale(r: Record<string, unknown>): PricingSale | null {
  const closePrice = Number(r.close_price)
  const sqft = Number(r.sqft)
  const closeDate = typeof r.close_date === 'string' ? r.close_date.slice(0, 10) : null
  const listingKey = typeof r.listing_key === 'string' ? r.listing_key : null
  if (!listingKey || !closeDate || !closePrice || closePrice <= 0 || !sqft || sqft < 300) return null
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
    lastAsk: r.last_ask != null ? Number(r.last_ask) : null,
    daysToOffer: r.days_to_offer != null ? Number(r.days_to_offer) : null,
    cdom: r.cdom != null ? Number(r.cdom) : null,
    dropCount: Number(r.drop_count ?? 0),
    closePpsf: Number(r.close_ppsf ?? closePrice / sqft),
    photoUrl: typeof r.photo_url === 'string' ? r.photo_url : null,
    publicRemarks: typeof r.public_remarks === 'string' ? r.public_remarks : null,
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
  return (data ?? []).map((r) => rowToSale(r as Record<string, unknown>)).filter((r): r is PricingSale => r != null)
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
  const { data, error } = await sb
    .from('pricing_subdivision_cells')
    .select('city_slug, subdivision_norm, n, median_ppsf')
    .eq('city_slug', citySlug)
    .limit(2000)
  if (error) {
    console.error('[getPricingSubdivisionCells]', error.message)
    return out
  }
  for (const r of data ?? []) {
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
  const { data, error } = await sb
    .from('listings')
    .select('water, details->WaterSource')
    .eq('ListingKey', listingKey.trim())
    .maybeSingle()
  if (error || !data) return null
  const fromDetails = (data as { WaterSource?: unknown }).WaterSource
  return fromDetails ?? data.water ?? null
}
