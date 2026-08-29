/**
 * Chart Room series for /housing-market. Time is the monthly median close.
 * Relate is how the cities sit on months of supply. Rank is median list
 * price by city, only when two or more cities publish a median.
 *
 * Geometry is V3Chart / lib/charts/plot.ts. Nothing here fetches.
 */
import { buildYearSeries } from '@/lib/kb/year-series'
import type { MarketPulseSnapshot } from '@/lib/data'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceCompact } from '@/lib/format/money'
import {
  v3Text,
  type V3ChartProps,
  type V3ChartRangeRow,
} from '@/components/site/v3'
import { placeMedianChart } from '@/app/cities/[slug]/_v3/city-sections'
import type { MedianMonth } from './market-charts'

const MOS_SCALE_MAX = 14

export const TIME_CHART_CAPTION = 'Median close by month, single-family, Central Oregon'
export const RELATE_CHART_CAPTION = 'Months of supply by city, single-family, now'
export const RANK_CHART_CAPTION = 'Median list price by city, single-family, now'

export function buildHubTimeChart(monthly: readonly MedianMonth[]): V3ChartProps | undefined {
  return placeMedianChart(buildYearSeries([...monthly], 5), TIME_CHART_CAPTION)
}

export function buildHubRelateChart(
  snapshots: readonly MarketPulseSnapshot[],
): V3ChartProps | undefined {
  const rows: V3ChartRangeRow[] = snapshots
    .filter((row) => row.months_of_supply != null && row.months_of_supply > 0 && row.geo_label)
    .sort((a, b) => (a.months_of_supply ?? 0) - (b.months_of_supply ?? 0))
    .map((row) => ({
      tick: v3Text(row.geo_label),
      value: row.months_of_supply as number,
      label: v3Text(`${formatMonthsOfSupply(row.months_of_supply as number)} mo`),
    }))
  if (rows.length < 2) return undefined
  return {
    caption: v3Text(RELATE_CHART_CAPTION),
    kind: 'range',
    rows,
    bands: [
      { from: 0, to: 4, label: v3Text("Seller's 4 or less") },
      { from: 4, to: 6, label: v3Text('4 to 6') },
      { from: 6, to: 99, label: v3Text("Buyer's 6 or more") },
    ],
    clampMax: MOS_SCALE_MAX,
  }
}

export function buildHubRankChart(
  snapshots: readonly MarketPulseSnapshot[],
): V3ChartProps | undefined {
  const ranked = snapshots
    .filter((row) => row.median_list_price != null && row.median_list_price > 0 && row.geo_label)
    .sort((a, b) => (b.median_list_price ?? 0) - (a.median_list_price ?? 0))
  if (ranked.length < 2) return undefined
  const rows: V3ChartRangeRow[] = ranked.map((row) => {
    const label = formatPriceCompact(row.median_list_price as number)
    return {
      tick: v3Text(row.geo_label),
      value: row.median_list_price as number,
      label: v3Text(label && label !== '\u2014' ? label : String(row.median_list_price)),
    }
  })
  return {
    caption: v3Text(RANK_CHART_CAPTION),
    kind: 'range',
    rows,
  }
}
