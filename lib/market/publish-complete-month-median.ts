/**
 * Closed-sale month median for a city/community market Instrument.
 *
 * Charts already drop the Pacific in-progress month. The Instrument used to
 * read the newest monthly cache row and label it "this month median sale".
 * An in-progress row with sold_count > 0 and a null median (Powell Butte
 * August 2026: 1 close, median_sale_price null) then hid the last complete
 * month (July $1,262,500 / 6). That is a different figure, not a missing one.
 *
 * Founding case: /housing-market/powell-butte (fleet 19ac3db1d801907c92b9f705bf5ab49c).
 *
 * Publish the current month only when that row has a verified median.
 * Otherwise publish the last complete month under its calendar name.
 * Do not invent a median. Do not label July as this month.
 */

const MONTH_NAME = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export type MonthMedianRow = {
  medianSalePrice: number | null
  periodStart: string | null
}

export type PublishedMonthMedian = {
  value: number
  label: string
  periodStart: string
  grain: 'current' | 'complete'
}

function asPositiveMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

/** YYYY-MM from a cache period_start (`2026-07-01` or ISO). */
export function monthKeyFromPeriodStart(periodStart: string | null | undefined): string | null {
  if (!periodStart) return null
  const key = periodStart.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(key) ? key : null
}

export function completeMonthMedianLabel(periodStart: string): string | null {
  const key = monthKeyFromPeriodStart(periodStart)
  if (!key) return null
  const month = Number(key.slice(5, 7))
  const name = MONTH_NAME[month - 1]
  return name ? `${name} median sale` : null
}

function publishRow(
  row: MonthMedianRow | null | undefined,
  currentMonthKey: string,
): PublishedMonthMedian | null {
  if (!row?.periodStart) return null
  const value = asPositiveMedian(row.medianSalePrice)
  if (value == null) return null
  const key = monthKeyFromPeriodStart(row.periodStart)
  if (!key) return null
  if (key === currentMonthKey) {
    return {
      value,
      label: 'this month median sale',
      periodStart: row.periodStart,
      grain: 'current',
    }
  }
  const label = completeMonthMedianLabel(row.periodStart)
  if (!label) return null
  return {
    value,
    label,
    periodStart: row.periodStart,
    grain: 'complete',
  }
}

export function publishCompleteMonthMedian(input: {
  monthly: MonthMedianRow | null | undefined
  lastComplete?: MonthMedianRow | null
  currentMonthKey: string
}): PublishedMonthMedian | null {
  if (!/^\d{4}-\d{2}$/.test(input.currentMonthKey)) return null
  return publishRow(input.monthly, input.currentMonthKey)
    ?? publishRow(input.lastComplete, input.currentMonthKey)
}
