/**
 * Region-level market pulse — single indexed lookup against market_pulse_live
 * for the `geo_type='region', geo_slug='central-oregon'` row.
 *
 * This is the fast path for the homepage market snapshot. The previous
 * `getMarketSnapshot()` action fanned out 3 RPCs × ~11 cities = 33 round-trips
 * and aggregated in Node. With a region row pre-computed by
 * `refresh_market_pulse()` (10–15 min freshness), one SELECT replaces all
 * of that work. Indexed on `(geo_type, geo_slug, property_type)`.
 *
 * Per CLAUDE.md §0 data accuracy: every figure traces to the same row;
 * `updatedAt` is exposed so callers can render a freshness pill.
 */
import { unstable_cache } from 'next/cache'
import { getMarketPulseRowForGeo } from './getMarketStatsCacheRows'

export type RegionPulse = {
  activeCount: number
  pendingCount: number
  newCount30d: number
  medianListPrice: number | null
  medianActiveDom: number | null
  medianDaysToPending: number | null
  monthsOfSupply: number | null
  marketHealthLabel: string | null
  soldCount30d: number
  soldCount90d: number
  updatedAt: string
}

const COLUMNS = [
  'active_count',
  'pending_count',
  'new_count_30d',
  'median_list_price',
  'median_active_dom',
  'median_days_to_pending',
  'months_of_supply',
  'market_health_label',
  'sold_count_30d',
  'sold_count_90d',
  'updated_at',
].join(', ')

export const getRegionPulse = unstable_cache(
  async (): Promise<RegionPulse | null> => {
    const row = await getMarketPulseRowForGeo({
      geoType: 'region',
      geoSlug: 'central-oregon',
      propertyType: 'A',
      columns: COLUMNS,
    })
    if (!row) return null

    const toNum = (v: unknown): number | null => {
      if (v == null) return null
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : null
    }

    return {
      activeCount: toNum(row.active_count) ?? 0,
      pendingCount: toNum(row.pending_count) ?? 0,
      newCount30d: toNum(row.new_count_30d) ?? 0,
      medianListPrice: toNum(row.median_list_price),
      medianActiveDom: toNum(row.median_active_dom),
      medianDaysToPending: toNum(row.median_days_to_pending),
      monthsOfSupply: toNum(row.months_of_supply),
      marketHealthLabel: (row.market_health_label as string | null) ?? null,
      soldCount30d: toNum(row.sold_count_30d) ?? 0,
      soldCount90d: toNum(row.sold_count_90d) ?? 0,
      updatedAt: String(row.updated_at ?? ''),
    }
  },
  ['region-pulse-central-oregon-v1'],
  { revalidate: 300, tags: ['market-pulse', 'region-pulse'] }
)
