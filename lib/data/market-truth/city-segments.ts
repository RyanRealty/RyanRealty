/**
 * Internal admin city × sale-segment board. Same store as getMetric
 * (`market_metric` mt-v1). A missing cell is null, never 0.
 * PropertyType G (rent) is out of the sale board. No neighborhood MOS.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { staleReason } from '@/lib/data/market-truth/getMetric'
import {
  BOARD_STATS,
  SALE_SEGMENTS,
  collapseCitySegmentRows,
  type CitySegmentRow,
  type RawSegmentCell,
} from '@/lib/data/market-truth/city-segment-collapse'

export type { CitySegmentRow } from '@/lib/data/market-truth/city-segment-collapse'
export { BOARD_STATS, SALE_SEGMENTS, collapseCitySegmentRows } from '@/lib/data/market-truth/city-segment-collapse'

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function emptyRow(segment: string): CitySegmentRow {
  return {
    segment,
    activeCount: null,
    medianList: null,
    monthsOfSupply: null,
    verdict: null,
    sampleN: null,
  }
}

export async function getCitySegmentBoard(citySlug: string): Promise<CitySegmentRow[]> {
  const geoSlug = hyphenSlug(citySlug)
  if (!geoSlug) return SALE_SEGMENTS.map(emptyRow)

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select(
      'segment, stat_id, value, value_text, sample_n, window_months, period_end, computed_at, complete_through, is_publishable',
    )
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', 'city')
    .eq('geo_slug', geoSlug)
    .in('segment', [...SALE_SEGMENTS])
    .in('stat_id', [...BOARD_STATS])
    .eq('is_publishable', true)
    .not('value', 'is', null)

  if (error) throw new Error(`getCitySegmentBoard: ${error.message}`)
  return collapseCitySegmentRows((data ?? []) as RawSegmentCell[], {
    stale: (row) =>
      Boolean(
        staleReason({
          completeThrough: String(row.complete_through ?? ''),
          periodEnd: String(row.period_end ?? ''),
          windowMonths: Number(row.window_months),
        }),
      ),
  })
}
