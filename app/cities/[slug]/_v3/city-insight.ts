/**
 * SITE-93 — the city fold's paged insight, as data.
 *
 * The fold used to stack three plates of one shape: a months-of-supply card, a
 * new-listings card, and the email ask, each an eyebrow over a figure over a
 * source line. The evaluator named that shape twice ("the stacked-section
 * page", "cream box"), and the answer is not another plate — it is ONE object
 * the reader can page and scrub, which is what beautifului-insight is.
 *
 * THIS FILE IS THE PURE TURN. It takes figures the page already read and
 * publishes them preformatted, so the client component formats nothing and
 * every numeral on the page keeps the trace the page gave it (CLAUDE.md §0).
 * Nothing here fetches, reads the clock, or classifies a market.
 *
 * THE MONTHLY PATH IS THE SAME SERIES THE #market OVERLAY DRAWS
 * (getPublicDetachedMonthly / getPriceHistory through `leftoverOrCacheMonthly`,
 * the in-progress month already dropped by the caller). The overlay answers
 * seasonality — Jan-Dec lines, one per year. This answers the trend — one
 * continuous path a reader can scrub. Same rows, two questions; a value read
 * off either one is the same value, and the source line names the series.
 */

import { formatPrice } from '@/lib/format/money'
import { formatMonthYear } from '@/lib/format/date'

/** One complete month of the published closed-sale series. */
export type CityInsightPoint = {
  /** "August 2026" — the month these sales closed in. */
  label: string
  /** Median close price for that month. */
  median: number
  /** How many homes closed that month. */
  sold: number
}

export type CityInsightPath = {
  points: CityInsightPoint[]
  /** "January 2026 - August 2026" */
  window: string
  source: string
  href: string
  hrefLabel: string
}

export type CityInsightBoard = {
  /** The supply page's one sentence: the verdict bound to the number beside it. */
  supplyProse: string | null
  supplyHref: string
  supplyHrefLabel: string
  /** The median-close path, or null when the series is too thin to draw. */
  path: CityInsightPath | null
}

/**
 * The fewest months that draw a path rather than a zigzag. Under this the page
 * publishes the bars alone; a two-point "trend" is not a trend (§0).
 */
export const CITY_INSIGHT_MIN_MONTHS = 5

/**
 * How many months the fold's path carries. EIGHT, because that is exactly what
 * the catalog card shows: AnomalyCard spaces its points 7 apart and opens a
 * 49-wide window, so a ninth month would be drawn outside the frame and a
 * reader would scrub a line whose left end is a month the card never names.
 * Eight complete months is what fits, so eight is what is published.
 */
export const CITY_INSIGHT_MONTHS = 8

export type CityInsightInput = {
  placeName: string
  /** Market report path for this city, e.g. "/housing-market/bend". */
  marketHref: string
  /** The verdict sentence the page already built, or null when MOS is withheld. */
  verdictProse: string | null
  /** Complete months, oldest first, as `leftoverOrCacheMonthly` publishes them. */
  months: readonly { periodStart: string; medianSalePrice: number | null; soldCount: number | null }[]
  /** Where the monthly rows came from, in a visitor's words. */
  pathSourceName?: string
}

export function buildCityInsightBoard(input: CityInsightInput): CityInsightBoard {
  const points: CityInsightPoint[] = []
  for (const row of input.months) {
    const median = row.medianSalePrice
    const sold = row.soldCount
    // Both metrics or neither: a price line beside a blank volume line is a
    // toggle that answers nothing, and a zero-filled month is a §0 lie.
    if (median == null || !Number.isFinite(median) || median <= 0) continue
    if (sold == null || !Number.isFinite(sold) || sold <= 0) continue
    // periodStart arrives as a calendar day or a full timestamp depending on
    // which of the two monthly sources answered; formatMonthYear takes the day.
    const label = formatMonthYear(String(row.periodStart).slice(0, 10))
    if (!label) continue
    points.push({ label, median, sold: Math.round(sold) })
  }
  const tail = points.slice(-CITY_INSIGHT_MONTHS)
  const sourceName = input.pathSourceName ?? 'Oregon Data Share'
  const path: CityInsightPath | null =
    tail.length >= CITY_INSIGHT_MIN_MONTHS
      ? {
          points: tail,
          window: `${tail[0].label} - ${tail[tail.length - 1].label}`,
          source: `${sourceName} · closed detached single-family sales in ${input.placeName}, one point per calendar month, ${tail[0].label} through ${tail[tail.length - 1].label}. Median sale price is the middle closed price that month; homes sold is how many closed. The month in progress is not plotted, so a partial month never draws as a fall. Same rows as the year overlay further down this page.`,
          href: input.marketHref,
          hrefLabel: `The ${input.placeName} market report`,
        }
      : null
  return {
    supplyProse: input.verdictProse,
    supplyHref: '/months-of-supply',
    supplyHrefLabel: 'How months of supply is counted',
    path,
  }
}

/** The settled face for a scrubbed point. Whole dollars, the way the page prints them. */
export function cityInsightMoney(value: number): string {
  return formatPrice(Math.round(value))
}

/** Homes sold that month. A count, never rounded to thousands. */
export function cityInsightCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
