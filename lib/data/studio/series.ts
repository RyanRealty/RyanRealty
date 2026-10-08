/**
 * lib/data/studio/series.ts — the trend film's line, with its provenance.
 *
 * The same Market Truth cells the public city pages chart
 * (getPublicDetachedMonthly: median_close, one-month windows, detached
 * segment, published cells only), read with their provenance kept, because a
 * film's §0 trace needs each labelled month's sample size and computed date,
 * which the public series drops. A month whose cell is withheld or missing is
 * null: a gap in the line, never a zero and never a neighbor's value.
 */
import 'server-only'
import { getMetrics } from '@/lib/data/market-truth/getMetric'
import { completeMonthKeys, lastDayOfMonth, publishedNumber } from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey } from '@/lib/format/date'

/** Two years: enough to see a season repeat, short enough to read on a phone. */
export const STUDIO_TREND_MONTHS = 24

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type StudioSeriesMonth = {
  /** YYYY-MM-DD, the month's last day: the cell's period_end. */
  periodEnd: string
  /** "Oct 2024". */
  tick: string
  value: number | null
  sampleN: number | null
  computedAt: string | null
  definitionId: string | null
}

function lastDay(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return lastDayOfMonth(year, month - 1)
}

/**
 * Complete months only, oldest first; the month in progress is never drawn.
 * "In progress" is the Pacific month, the way the city pages key it: in UTC
 * the last evening of a month already reads as next month, and that month's
 * partial cell would be drawn and labelled as complete.
 */
export async function getStudioPriceSeries(opts: {
  geoType: 'city' | 'region'
  geoSlug: string
  now?: Date
}): Promise<StudioSeriesMonth[]> {
  const current = zonedDateKey(opts.now ?? new Date()).slice(0, 7)
  const keys = completeMonthKeys(current, STUDIO_TREND_MONTHS)
  if (keys.length === 0) return []
  const cells = await getMetrics(
    keys.map((key) => ({
      stat: 'median_close',
      geoType: opts.geoType,
      geoSlug: opts.geoSlug,
      segment: 'detached',
      windowMonths: 1,
      periodEnd: lastDay(key),
    })),
  )
  return keys.map((key, i) => {
    const cell = cells[i]
    // The public charts' own test of a plottable cell, so the film and the
    // city page can never disagree about which months exist.
    const value = publishedNumber(cell)
    const published = value != null
    const [year, month] = key.split('-').map(Number)
    return {
      periodEnd: lastDay(key),
      tick: `${MONTHS[month - 1]} ${year}`,
      value,
      sampleN: published ? (cell?.provenance.sampleN ?? null) : null,
      computedAt: published ? (cell?.provenance.computedAt ?? null) : null,
      definitionId: published ? (cell?.provenance.definitionId ?? null) : null,
    }
  })
}
