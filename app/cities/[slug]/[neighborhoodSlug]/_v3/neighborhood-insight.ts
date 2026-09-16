/**
 * SITE-104 — the neighborhood fold's paged insight, as data.
 *
 * THE SAME OBJECT THE CITY AND THE SUBDIVISION FOLDS SHIP
 * (app/cities/[slug]/_v3/city-insight.ts, app/subdivisions/[slug]/_v3/subdivision-insight.ts),
 * bound to this grain's own reads. The class gets one paged fold figure; a
 * second invention per route is what TASTE.md calls designing the instance.
 *
 * WHAT IT REPLACED. The neighborhood opened with the two MOS bars floating on
 * the photograph as a cream overlay — the evaluator measured its claim
 * sentence clipped off the top on desktop and the whole card covering the
 * hillside at 375 — and then one alerts sentence beside an email form. No
 * drawing, nothing to page, nothing to scrub. This is the object the builder
 * card asks for: "paged insights with a scrubber over live charts".
 *
 * THIS FILE IS THE PURE TURN. It takes figures the page already read and
 * publishes them preformatted, so the client component formats nothing and
 * every numeral keeps the trace the page gave it (CLAUDE.md §0). Nothing here
 * fetches, reads the clock, or classifies a market.
 *
 * THE MONTHLY PATH IS THE SAME SERIES THE #market OVERLAY DRAWS
 * (leftoverNeighborhoodOrCityMonthly, and only when that read answered with
 * THIS neighborhood's own rows — a city fallback under a neighborhood heading
 * is a §0 lie, so the caller passes null and the page publishes one page).
 * The overlay answers seasonality — one line per year. This answers the
 * trend — one continuous path a reader can scrub — and it publishes the
 * monthly SOLD COUNT, which appears nowhere else on this page.
 *
 * THE SERIES IS THE MONTHS THIS PLACE PUBLISHED, NOT EVERY CALENDAR MONTH. A
 * neighborhood is small enough that some months close too few homes to publish
 * a median at all, and those months are absent from the read rather than zero.
 * Every plotted point is a real published month and each tick names it, so the
 * source line says so in a visitor's words instead of letting a continuous line
 * imply a month that was never drawn (§0 rule 5).
 */

import { formatPrice } from '@/lib/format/money'
import { formatMonthYear } from '@/lib/format/date'

/** One published month of the closed-sale series. */
export type NeighborhoodInsightPoint = {
  /** "July 2026" — the month these sales closed in. */
  label: string
  /** Median close price for that month. */
  median: number
  /** How many homes closed that month. */
  sold: number
}

export type NeighborhoodInsightPath = {
  points: NeighborhoodInsightPoint[]
  /** "June 2025 - July 2026" */
  window: string
  /**
   * What the line covers, preformatted. A chart a reader has to scrub to get a
   * single number out of is a decorative squiggle in a still; this is the same
   * months stated as a range, so the drawing is legible before anyone touches
   * it and every figure on it is one of these rows (§0).
   */
  range: { medianLow: string; medianHigh: string; soldLow: string; soldHigh: string }
  /** The newest plotted month, for the sentence above the card. */
  latest: { label: string; median: number; medianFormatted: string }
  source: string
  href: string
  hrefLabel: string
}

export type NeighborhoodInsightBoard = {
  /** The supply page's one sentence: the verdict bound to the number beside it. */
  supplyProse: string | null
  supplyHref: string
  supplyHrefLabel: string
  /** The closed-sale path, or null when the series is too thin to draw. */
  path: NeighborhoodInsightPath | null
}

/**
 * The fewest published months that draw a path rather than a zigzag. Under
 * this the fold publishes the bars alone; a two-point "trend" is not a trend
 * (§0).
 */
export const NBH_INSIGHT_MIN_MONTHS = 5

/**
 * How many months the fold's path carries. EIGHT, because that is exactly what
 * the catalog card shows: AnomalyCard spaces its points 7 apart and opens a
 * 49-wide window, so a ninth month would be drawn outside the frame and a
 * reader would scrub a line whose left end is a month the card never names.
 */
export const NBH_INSIGHT_MONTHS = 8

export type NeighborhoodInsightInput = {
  placeName: string
  /** The parent city's market report path, e.g. "/housing-market/bend". */
  marketHref: string
  /** The parent city, named on the pill so the reader knows where it goes. */
  cityName: string
  /** The verdict sentence the page already built, or null when MOS is withheld. */
  verdictProse: string | null
  /**
   * Complete months, oldest first, as `leftoverNeighborhoodOrCityMonthly`
   * publishes them — or an empty list when that read fell back to the city.
   */
  months: readonly { periodStart: string; medianSalePrice: number | null; soldCount: number | null }[]
  /** Where the monthly rows came from, in a visitor's words. */
  pathSourceName?: string
}

export function buildNeighborhoodInsightBoard(
  input: NeighborhoodInsightInput,
): NeighborhoodInsightBoard {
  const points: NeighborhoodInsightPoint[] = []
  for (const row of input.months) {
    const median = row.medianSalePrice
    const sold = row.soldCount
    // Both metrics or neither: a price line beside a blank volume line is a
    // toggle that answers nothing, and a zero-filled month is a §0 lie.
    if (median == null || !Number.isFinite(median) || median <= 0) continue
    if (sold == null || !Number.isFinite(sold) || sold <= 0) continue
    // periodStart arrives as a calendar day or a full timestamp depending on
    // which monthly source answered; formatMonthYear takes the day.
    const label = formatMonthYear(String(row.periodStart).slice(0, 10))
    if (!label) continue
    points.push({ label, median, sold: Math.round(sold) })
  }
  const tail = points.slice(-NBH_INSIGHT_MONTHS)
  const sourceName = input.pathSourceName ?? 'Oregon Data Share'
  const last = tail[tail.length - 1]
  const path: NeighborhoodInsightPath | null =
    tail.length >= NBH_INSIGHT_MIN_MONTHS && last
      ? {
          points: tail,
          window: `${tail[0].label} - ${last.label}`,
          range: {
            medianLow: formatPrice(Math.min(...tail.map((p) => p.median))),
            medianHigh: formatPrice(Math.max(...tail.map((p) => p.median))),
            soldLow: Math.min(...tail.map((p) => p.sold)).toLocaleString('en-US'),
            soldHigh: Math.max(...tail.map((p) => p.sold)).toLocaleString('en-US'),
          },
          latest: { label: last.label, median: last.median, medianFormatted: formatPrice(last.median) },
          source: `${sourceName} · closed detached single-family sales in ${input.placeName}, one point per month this neighborhood published a closed median, ${tail[0].label} through ${last.label}. Median sale price is the middle closed price that month; homes sold is how many closed. A month where too few homes closed to publish a median is not plotted, and neither is the month in progress, so a thin month never draws as a fall. Same rows as the year overlay further down this page.`,
          href: input.marketHref,
          hrefLabel: `The ${input.cityName} market report`,
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
export function nbhInsightMoney(value: number): string {
  return formatPrice(Math.round(value))
}

/** Homes sold that month. A count, never rounded to thousands. */
export function nbhInsightCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
