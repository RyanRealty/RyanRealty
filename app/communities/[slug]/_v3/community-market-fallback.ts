/**
 * Route-local: what "Typical price in {community}" draws when a monthly
 * median line cannot be published (SITE-116 round 3, defect 4).
 *
 * THE DEFECT. When fewer than six of the last 36 months carry enough closes
 * for this community to publish a monthly median (lib/data/market-truth/
 * public-monthly.ts, the six-month floor), the section fell to a Quiet with
 * one sentence: "Too few recent sales here to chart." The separate evaluator
 * named it by TASTE.md's own word — a "missing state", an empty state that
 * describes the product instead of showing it — and it was also misleading
 * on Tetherow, which had 26 closes in twelve months: the SERIES was too thin
 * per month, not the sales.
 *
 * THE STATE THIS BUILDS, from reads the page already holds and nothing else:
 *
 *  1. ASKING PRICES, NOW. The alias-aware active set the homes list draws
 *     (resortTilesForSlug → listing_tile_mv, live MLS), kept to detached
 *     houses through the same classifyType the Atlas uses, counted into
 *     price bands. A distribution of what is for sale is a real answer to
 *     "what does a house here cost" when the sold series cannot be drawn.
 *
 *  2. CLOSES INSIDE THE BOUNDARY, LAST 90 DAYS. The Atlas population's sold
 *     marks (lib/atlas/build-place-atlas.ts): every close of the last
 *     ATLAS_HEAT_WINDOW_DAYS whose coordinate falls inside the recorded
 *     boundary, each carrying its close price and days since close. Houses
 *     only, one lollipop row per close, most recent first.
 *
 * WHAT IT WILL NOT DRAW. A city median (the competitive brief refuses a Bend
 * median on a community page), a monthly median built from months that did
 * not publish one, or a count of months whose value the DAL withheld — a null
 * month is unknown, not zero (§0). Every figure in a claim below is computed
 * from the exact points the chart plots, so the sentence and the drawing
 * cannot disagree.
 */

import type { AtlasDot, V3ChartProps, V3ChartRangeRow, V3ChartPoint } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import { classifyType } from '@/app/_v3/home-field-items'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatCount } from '@/lib/format/count'
import { formatPriceCompact } from '@/lib/format/money'

/** Fewer than this many asking prices is a list, not a distribution. */
export const ASKING_BANDS_MIN = 3

/**
 * The price ladder. Fixed edges, so two communities' bands read alike; the
 * empty bands at either end are trimmed so a $1.5M–$4M community does not
 * open with three zero columns.
 */
const BAND_EDGES = [0, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, Infinity] as const

/** A band edge: `$500K`, `$1M`, `$1.5M` — a whole million drops its `.0`. */
function edgeLabel(v: number): string {
  return formatPriceCompact(v).replace(/\.0M$/, 'M')
}

function bandLabel(lo: number, hi: number): string {
  if (lo === 0) return `Under ${edgeLabel(hi)}`
  if (!Number.isFinite(hi)) return `${edgeLabel(lo)}+`
  return `${edgeLabel(lo)}–${edgeLabel(hi)}`
}

/** Detached houses only, with a published whole-property ask, ascending. */
export function askingPrices(tiles: readonly Pick<ListingTile, 'listPrice' | 'propertyType' | 'propertySubType'>[]): number[] {
  return tiles
    .filter((t) => classifyType({ propertyType: t.propertyType, propertySubType: t.propertySubType }).typeKey === 'house')
    .map((t) => Number(t.listPrice))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
}

/** Nearest-rank quantile over an ascending array. */
function quantile(sorted: readonly number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
  return sorted[idx]!
}

/**
 * The asking-price distribution as category bars, one per price band.
 * Undefined below ASKING_BANDS_MIN prices: nothing is padded.
 *
 * SITE-116 round 4 (defect 4: "four identical flat navy rectangles with no
 * value labels, no visible hover"): every band carries its count over the
 * bar (`barValues` — the count per band IS the reading), the hover layer
 * washes the band under the pointer and rests on the modal band
 * (`columnBands`, `restingRead: 'max'`), and the claim names the WINDOW —
 * the date the live tiles were read, the same clock the Atlas stamps its
 * own read with — when the caller passes it.
 */
export function askingBandsChart(
  tiles: readonly Pick<ListingTile, 'listPrice' | 'propertyType' | 'propertySubType'>[],
  placeName: string,
  options?: { asOf?: string | null },
): V3ChartProps | undefined {
  const prices = askingPrices(tiles)
  if (prices.length < ASKING_BANDS_MIN) return undefined

  const counts: number[] = []
  for (let i = 0; i < BAND_EDGES.length - 1; i += 1) {
    const lo = BAND_EDGES[i]!
    const hi = BAND_EDGES[i + 1]!
    counts.push(prices.filter((p) => p >= lo && p < hi).length)
  }
  let first = counts.findIndex((c) => c > 0)
  let last = counts.length - 1
  while (last > first && counts[last] === 0) last -= 1
  if (first < 0) return undefined
  // At least two columns, so a set that happens to fit one band still reads
  // as a scale: widen to the neighbouring band on the side that exists.
  if (first === last) {
    if (last < counts.length - 1) last += 1
    else if (first > 0) first -= 1
  }

  const points: V3ChartPoint[] = []
  for (let i = first; i <= last; i += 1) {
    const n = counts[i]!
    points.push({
      value: n,
      label: v3Text(`${formatCount(n)} ${n === 1 ? 'house' : 'houses'}`),
      tick: v3Text(bandLabel(BAND_EDGES[i]!, BAND_EDGES[i + 1]!)),
      at: i - first,
    })
  }

  const n = prices.length
  const lo = prices[0]!
  const hi = prices[n - 1]!
  const q1 = quantile(prices, 0.25)
  const q3 = quantile(prices, 0.75)
  // The window, named in the claim: "as of Sep 15, 2026" — the date the
  // tiles were read — when the caller passes it, else the caption's "right
  // now" stands alone.
  const asOf = options?.asOf?.trim()
  const subject = `${n === 1 ? '1 house' : `${formatCount(n)} houses`} for sale in ${placeName}${asOf ? ` as of ${asOf}` : ''}`
  const claim =
    n === 1
      ? `${subject}, asking ${formatPriceCompact(lo)}.`
      : lo === hi
        ? `${subject}, all asking ${formatPriceCompact(lo)}.`
        : `${subject}, asking ${formatPriceCompact(lo)} to ${formatPriceCompact(hi)}; ` +
          `the middle half asks ${formatPriceCompact(q1)} to ${formatPriceCompact(q3)}.`

  return {
    kind: 'bars',
    run: true,
    barLabels: 'all',
    barValues: true,
    columnBands: true,
    restingRead: 'max',
    caption: v3Text(`What ${placeName} houses are asking right now`),
    claim: v3Text(claim),
    series: [{ name: v3Text('Houses for sale'), points }],
    baselineLabel: v3Text('0'),
  }
}

/** The Atlas's sold marks that are houses with a close price, most recent first. */
export function recentHouseCloses(dots: readonly AtlasDot[]): Array<{ price: number; soldAgo: number; key: string; href?: string }> {
  return dots
    .filter((d) => d.s === 'sold' && d.t === 'house' && d.p != null && d.p > 0 && d.soldAgo != null && d.soldAgo >= 0)
    .map((d) => ({ price: d.p!, soldAgo: d.soldAgo!, key: d.k, href: d.href }))
    .sort((a, b) => a.soldAgo - b.soldAgo || b.price - a.price)
}

function agoTick(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  const weeks = Math.round(days / 7)
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
}

/**
 * The last closes inside the boundary as one lollipop row per close. The
 * tick is how long ago it closed (the dot carries days since close, not the
 * date itself — so that is what prints, and nothing is back-derived).
 * Undefined with no qualifying close.
 */
export function recentClosesChart(
  dots: readonly AtlasDot[],
  placeName: string,
  windowDays: number,
): V3ChartProps | undefined {
  const closes = recentHouseCloses(dots)
  if (closes.length === 0) return undefined
  const rows: V3ChartRangeRow[] = closes.map((c) => ({
    tick: v3Text(agoTick(c.soldAgo)),
    value: c.price,
    label: v3Text(formatPriceCompact(c.price)),
    note: v3Text(`House, closed ${c.soldAgo === 0 ? 'today' : `${formatCount(c.soldAgo)} ${c.soldAgo === 1 ? 'day' : 'days'} ago`}, inside the recorded ${placeName} boundary`),
  }))
  const prices = closes.map((c) => c.price).sort((a, b) => a - b)
  const n = closes.length
  const claim =
    n === 1
      ? `1 house closed inside the ${placeName} boundary in the last ${windowDays} days, at ${formatPriceCompact(prices[0]!)}.`
      : `${formatCount(n)} houses closed inside the ${placeName} boundary in the last ${windowDays} days, ` +
        `${formatPriceCompact(prices[0]!)} to ${formatPriceCompact(prices[n - 1]!)}.`
  return {
    kind: 'range',
    caption: v3Text(`Closed inside the ${placeName} boundary, last ${windowDays} days`),
    claim: v3Text(claim),
    rows,
    rangeKeyLabel: v3Text('Close price'),
  }
}

/**
 * The one sentence between the heading and the drawings that says why there
 * is no median line, in a reader's words. Undefined when nothing is drawn.
 */
export function marketFallbackNote(placeName: string, hasAsking: boolean, hasCloses: boolean): string | undefined {
  if (!hasAsking && !hasCloses) return undefined
  const drawn =
    hasAsking && hasCloses
      ? 'what is for sale and what has just closed'
      : hasAsking
        ? 'what is for sale'
        : 'what has just closed'
  return (
    `Too few ${placeName} houses close in any one month to draw a monthly median without inventing one, ` +
    `so this section draws ${drawn} instead.`
  )
}

/** The §0 trace for the fallback section, naming both populations. */
export function marketFallbackSource(input: {
  placeName: string
  askingCount: number
  closesCount: number
  windowDays: number
}): string {
  const parts: string[] = []
  if (input.askingCount > 0) {
    parts.push(
      `asking prices are the ${formatCount(input.askingCount)} detached houses active under ${input.placeName}'s ` +
        `MLS subdivision names (listing_tile_mv, live MLS through Oregon Data Share — the same set the homes list draws), ` +
        `counted into fixed price bands`,
    )
  }
  if (input.closesCount > 0) {
    parts.push(
      `closes are the ${formatCount(input.closesCount)} houses among the map's sold marks — every close of the last ` +
        `${input.windowDays} days whose coordinate falls inside the recorded boundary (getAtlasTiles), each at its close price`,
    )
  }
  return (
    `regional MLS through Oregon Data Share: ${parts.join('; ')}. ` +
    `The median-sale figures come from detached houses whose primary membership is ${input.placeName}. ` +
    `No monthly median line is drawn because fewer than six of the last 36 months publish one for this community; ` +
    `months of supply and a buyer's or seller's verdict stay off this grain.`
  )
}
