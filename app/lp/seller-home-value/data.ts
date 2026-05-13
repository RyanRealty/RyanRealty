/**
 * Data fetchers for the seller LP. Server-only. Reuses the existing
 * Supabase service client + market-stats patterns so the same data the
 * rest of the platform sees is what shows on the page — never invented.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getLiveMarketPulse } from '@/app/actions/market-stats'

export type RecentSoldListing = {
  photoUrl: string
  neighborhood: string | null
  city: string | null
  listPrice: number | null
  closePrice: number | null
  domDays: number | null
  beds: number | null
  baths: number | null
  closedAt: string | null
}

export type BendMarketSnapshot = {
  medianListPrice: number | null
  activeCount: number | null
  newCount30d: number | null
  marketHealthLabel: string | null
}

/**
 * Pull the most recent SFR closings in Bend with photos, for the recent-sold
 * social-proof grid. Filters: status closed, City=Bend, has a photo, sorted by
 * CloseDate desc, limit 6. Returns rows ready for direct render.
 */
export async function getRecentBendSoldListings(): Promise<RecentSoldListing[]> {
  try {
    const supabase = createServiceClient()
    const oneEightyDaysAgo = new Date()
    oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180)

    const { data, error } = await supabase
      .from('listings')
      .select(
        'PhotoURL, SubdivisionName, City, ListPrice, ClosePrice, CumulativeDaysOnMarket, BedroomsTotal, BathroomsTotal, CloseDate'
      )
      .ilike('City', 'Bend')
      .or('StandardStatus.ilike.%Closed%,StandardStatus.ilike.%Sold%')
      .not('PhotoURL', 'is', null)
      .not('ClosePrice', 'is', null)
      .gte('CloseDate', oneEightyDaysAgo.toISOString().slice(0, 10))
      .order('CloseDate', { ascending: false })
      .limit(6)

    if (error || !data) return []

    return (data as Array<Record<string, unknown>>).map((r) => ({
      photoUrl: String(r['PhotoURL'] ?? ''),
      neighborhood: (r['SubdivisionName'] as string | null) ?? null,
      city: (r['City'] as string | null) ?? null,
      listPrice: typeof r['ListPrice'] === 'number' ? r['ListPrice'] : null,
      closePrice: typeof r['ClosePrice'] === 'number' ? r['ClosePrice'] : null,
      domDays:
        typeof r['CumulativeDaysOnMarket'] === 'number'
          ? r['CumulativeDaysOnMarket']
          : null,
      beds:
        typeof r['BedroomsTotal'] === 'number' ? r['BedroomsTotal'] : null,
      baths:
        typeof r['BathroomsTotal'] === 'number' ? r['BathroomsTotal'] : null,
      closedAt: (r['CloseDate'] as string | null) ?? null,
    }))
  } catch (e) {
    console.warn('[seller-lp/data] getRecentBendSoldListings failed:', e)
    return []
  }
}

/**
 * Live Bend market snapshot (city-level residential).
 * Pulled from market_pulse_live so the LP shows the same figures as the
 * weekly market packets and city pages. Never invented.
 */
export async function getBendMarketSnapshot(): Promise<BendMarketSnapshot | null> {
  try {
    const pulse = await getLiveMarketPulse({ geoType: 'city', geoSlug: 'bend' })
    if (!pulse) return null
    return {
      medianListPrice: pulse.median_list_price,
      activeCount: pulse.active_count ?? null,
      newCount30d: pulse.new_count_30d ?? null,
      marketHealthLabel: pulse.market_health_label ?? null,
    }
  } catch (e) {
    console.warn('[seller-lp/data] getBendMarketSnapshot failed:', e)
    return null
  }
}

/**
 * Compact USD formatter — "$894K" for $894,000, "$1.2M" for $1,200,000.
 * The locked design-system rule: currency rounded to nearest thousand.
 */
export function formatPriceCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m.toFixed(m >= 10 ? 0 : 1)}M`
  }
  const k = Math.round(value / 1_000)
  return `$${k}K`
}
