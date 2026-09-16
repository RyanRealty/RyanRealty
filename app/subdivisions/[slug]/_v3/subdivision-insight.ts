/**
 * SITE-112 — the subdivision fold's paged insight, as data.
 *
 * WHAT THIS REPLACED. The fold's right column ran one plate: a 30-day new
 * count, one listing thumb, the email field, and a §0 trace printed under it
 * all. The table instrument named the result twice — "the stacked-section
 * page" and a fold where "nothing rewards a look" — and REGISTRY §4 had just
 * taken months of supply off this grain, so the column carried no drawn figure
 * at all ("no new sourced figure replaced the removed MOS bars").
 *
 * This is that figure, built as the same object the city fold uses: the
 * beautifului InsightCards pager (`components/motion/insight-cards`, installed
 * from https://www.beautifului.dev/r/insight-cards.json). Two pages, both off
 * reads the page already makes, both drawn on the catalog's own cards.
 *
 *   1. ASKING PRICES — the counted active set split into round price bands on
 *      the catalog's AllocationCard: a segmented bar a reader selects through,
 *      the selected band's own count as the hero figure. The population is the
 *      SAME one `getPlatPublicInventory` counted for the page's own "homes for
 *      sale" figure, so the numbers in the fold cannot disagree (the layout
 *      lock). A listing whose price did not publish is counted OUT of the bands
 *      and named in the sentence rather than dropped silently (§0).
 *   2. HOMES SOLD — the subdivision's own closed count per year on the
 *      catalog's AnomalyCard, with its pointer-scrub and its two metric chips
 *      intact. The chips are the yearly count and the running total, and the
 *      running total is the sum of the years drawn beside it — one population,
 *      one arithmetic, both shown (§0 rule 4). REGISTRY §4 withholds a closed
 *      PRICE statistic at this grain, so no price is charted here.
 *
 * THIS FILE IS THE PURE TURN. Nothing here fetches, reads the clock, or
 * classifies a market; every string arrives preformatted so the client
 * component formats nothing and every numeral keeps the trace the page gave it.
 */

import { formatPriceCompact, formatPriceExact } from '@/lib/format/money'

/** One round price band over the counted active set. */
export type PlatPriceBand = {
  /** Stable key for the segment control. */
  key: string
  /** "$700K - $800K", the band's own range. */
  label: string
  /** Share of the priced set, 0..100, for the segment's width. */
  pct: number
  /** "4 homes" — preformatted, the band's own count. */
  amount: string
  /** The raw count, for the settled face of the count-up. */
  count: number
}

export type PlatForSalePage = {
  bands: PlatPriceBand[]
  /** How many of the counted homes published an asking price. */
  priced: number
  /** The counted active set, as the page's other figures count it. */
  active: number
  /** Middle asking price, preformatted exactly as the page prints it. */
  median: string
  /** The same figure as a number, for the count-up's settled value. */
  medianValue: number
  /** One sentence naming what the bands are and what was left out. */
  note: string
  source: string
  href: string
  hrefLabel: string
}

export type PlatSoldPage = {
  /** Calendar years, oldest first. Complete years only. */
  years: number[]
  /** Homes sold in each of those years. */
  counts: number[]
  /** Running total through each year — the sum of `counts` up to it. */
  running: number[]
  /** "2017 to 2024" */
  window: string
  /** Total closings across the charted years. */
  total: number
  /** The same total, preformatted. */
  totalFormatted: string
  /** The quiet and the busy year, preformatted, so the line reads without a scrub. */
  range: { low: string; high: string }
  source: string
  href: string
  hrefLabel: string
}

export type PlatInsightBoard = {
  forSale: PlatForSalePage | null
  sold: PlatSoldPage | null
}

/**
 * How many years the card can draw. AnomalyCard lays its points 7 apart inside
 * a 49-wide window, so an eighth point is the last one that lands in the frame;
 * a ninth would be scrubbed off the left edge of a chart that never names it.
 */
export const PLAT_INSIGHT_YEARS = 8

/** Under two complete years there is no series, only a dot. */
export const PLAT_INSIGHT_MIN_YEARS = 3

/** The round steps a price band may use, finest first. */
const BAND_STEPS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000] as const

/** Fewer than two bands is a bar with one segment, which draws nothing. */
const MIN_BANDS = 2
/** More than five and the segments stop being readable at 375. */
const MAX_BANDS = 5

export type PlatInsightInput = {
  placeName: string
  /** Asking prices of the counted active set, unsorted, nulls already dropped. */
  askingPrices: readonly number[]
  /** The counted active set's size, as the page's other figures publish it. */
  activeCount: number | null
  /** The published middle asking price, or null when it was withheld. */
  medianListPrice: number | null
  /** Where "see every home for sale" goes. */
  browseHref: string | null
  /** Complete closed years, in any order: `{ year, closedCount }`. */
  closedYears: readonly { year: number; closedCount: number }[]
  /** The §0 trace the page already wrote for the counted inventory. */
  inventorySource: string
  /** The §0 trace the page already wrote for the yearly closed counts. */
  soldSource: string
  /** Where the sold page's pill goes. */
  soldHref: string
  soldHrefLabel: string
}

/** Round-number band edges that put the set into 2..5 non-empty groups. */
export function pickBandStep(prices: readonly number[]): number | null {
  if (prices.length === 0) return null
  for (const step of BAND_STEPS) {
    const buckets = new Set(prices.map((p) => Math.floor(p / step)))
    if (buckets.size >= MIN_BANDS && buckets.size <= MAX_BANDS) return step
  }
  return null
}

/**
 * "$700K–$800K" — BOTH edges, so a band is a closed range and never an open
 * claim. The lowest band starts at zero dollars, which is not a price anyone
 * asks, so that one reads as its ceiling.
 */
function bandLabel(lowerEdge: number, step: number): string {
  if (lowerEdge <= 0) return `Under ${formatPriceCompact(step)}`
  return `${formatPriceCompact(lowerEdge)}–${formatPriceCompact(lowerEdge + step)}`
}

/**
 * The share a segment prints beside its name. The exact count is the figure
 * (it is the hero and it is in the band's own face); this is the width, so it
 * rounds to a whole percent — except under one percent, where a whole percent
 * would print the zero the band is not.
 */
export function bandShare(count: number, total: number): number {
  const raw = (count / total) * 100
  return raw < 1 ? Math.round(raw * 10) / 10 : Math.round(raw)
}

export function buildPlatPriceBands(prices: readonly number[]): PlatPriceBand[] {
  const step = pickBandStep(prices)
  if (step == null) return []
  const byBucket = new Map<number, number>()
  for (const price of prices) {
    const bucket = Math.floor(price / step)
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1)
  }
  const buckets = [...byBucket.entries()].sort((a, b) => a[0] - b[0])
  const total = prices.length
  return buckets.map(([bucket, count]) => ({
    key: String(bucket * step),
    label: bandLabel(bucket * step, step),
    // Widths are the real shares. A band holding one home draws as a sliver,
    // which is the honest picture of one home.
    pct: bandShare(count, total),
    amount: `${count.toLocaleString('en-US')} ${count === 1 ? 'home' : 'homes'}`,
    count,
  }))
}

function completeSoldYears(
  rows: readonly { year: number; closedCount: number }[],
): { year: number; closedCount: number }[] {
  return rows
    .filter((r) => Number.isInteger(r.year) && r.closedCount > 0)
    .map((r) => ({ year: r.year, closedCount: r.closedCount }))
    .sort((a, b) => a.year - b.year)
    .slice(-PLAT_INSIGHT_YEARS)
}

export function buildSubdivisionInsightBoard(input: PlatInsightInput): PlatInsightBoard {
  const prices = input.askingPrices.filter((p) => Number.isFinite(p) && p > 0)
  const bands = buildPlatPriceBands(prices)
  const active = input.activeCount
  const median = input.medianListPrice

  const forSale: PlatForSalePage | null =
    bands.length >= MIN_BANDS && median != null && median > 0
      ? {
          bands,
          priced: prices.length,
          active: active ?? prices.length,
          median: formatPriceExact(median),
          medianValue: median,
          note:
            active != null && active !== prices.length
              ? `Asking prices of the ${prices.length.toLocaleString('en-US')} of ${active.toLocaleString('en-US')} homes for sale in ${input.placeName} that publish one.`
              : `Asking prices of all ${prices.length.toLocaleString('en-US')} homes for sale in ${input.placeName}.`,
          source: input.inventorySource,
          href: input.browseHref ?? '/homes-for-sale',
          hrefLabel: `See every home for sale in ${input.placeName}`,
        }
      : null

  const years = completeSoldYears(input.closedYears)
  let running = 0
  const runningTotals = years.map((r) => {
    running += r.closedCount
    return running
  })
  const counts = years.map((r) => r.closedCount)
  const sold: PlatSoldPage | null =
    years.length >= PLAT_INSIGHT_MIN_YEARS
      ? {
          years: years.map((r) => r.year),
          counts,
          running: runningTotals,
          window: `${years[0].year} to ${years[years.length - 1].year}`,
          total: running,
          totalFormatted: running.toLocaleString('en-US'),
          range: {
            low: Math.min(...counts).toLocaleString('en-US'),
            high: Math.max(...counts).toLocaleString('en-US'),
          },
          source: `${input.soldSource} The running total on the second chip is the sum of the years drawn beside it: ${counts.join(' + ')} = ${running.toLocaleString('en-US')}.`,
          href: input.soldHref,
          hrefLabel: input.soldHrefLabel,
        }
      : null

  return { forSale, sold }
}

/** A count, the way the page prints one. Never rounded to thousands. */
export function platInsightCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Whole dollars, the way the page prints an asking price. */
export function platInsightMoney(value: number): string {
  return formatPriceExact(Math.round(value))
}
