/**
 * Local outcome statistics — chapter 2 of the reimagined seller document
 * (docs/plans/CMA_REIMAGINED_2026-09-07.md): "Priced right sells. Priced high
 * sits", shown with the reader's own city's numbers instead of a slogan.
 *
 * Two figures, one population, one window:
 *
 *   offerTiming  When homes like yours get their offer. A CUMULATIVE curve —
 *                the share of the city's single-family closes in the last 12
 *                months that had an accepted offer by day 7, 14, 30, 60, 90,
 *                180 — plus the median. The seller's own days sit on the same
 *                axis, far past the shoulder.
 *   askOutcome   The first price decides the days. Three groups over the same
 *                city and window: sold with the first ask never moved, sold
 *                after the ask was cut (with the median cut), and came off the
 *                market unsold.
 *
 * EVERY FIGURE HERE IS COMPUTED AT BUILD AND STORED ON `render_args`. Nothing
 * downstream recomputes it, and each block carries the `source` that lets a
 * reviewer re-run it (CLAUDE.md §0).
 *
 * THE THREE DEFINITIONS, STATED ONCE
 *
 *  · days for a SALE = `listings.days_to_pending`, on-market date to accepted
 *    offer. Never `DaysOnMarket` / `CumulativeDaysOnMarket`, which are
 *    list-to-close across relists (§7 forbids publishing those as DOM).
 *  · a CUT = `OriginalListPrice > ListPrice` on the closed row. Both columns
 *    are 100% populated on the closed single-family rows in Redmond (678/678)
 *    and Bend (2,088/2,088), verified 2026-09-07, so the split needs no
 *    estimate and the population rate ships in the source block.
 *  · days for a listing that DID NOT SELL = list date to off-market date, the
 *    SAME span `finalCycleDaysOnMarket` measures for the subject's own final
 *    cycle. Reusing that function is the point: the seller's 187 days and the
 *    third bar they are compared against are one measurement, not two.
 *
 * THE MINIMUM. A figure with fewer than 30 datapoints does not ship. The block
 * still renders — it carries `n`, a `reason`, and null figures, so the chapter
 * can say the count was too small instead of silently dropping a graphic.
 */

import { finalCycleDaysOnMarket } from '@/lib/cma/expired-audit'

/** The six marks on the cumulative curve. */
export const OFFER_TIMING_DAYS = [7, 14, 30, 60, 90, 180] as const

/** Below this, a figure is withheld and the block says why (§0: cut, never estimate). */
export const MIN_LOCAL_OUTCOME_N = 30

/** Rolling window every figure in this module is measured over. */
export const LOCAL_OUTCOME_WINDOW_MONTHS = 12

/**
 * A realization bucket is a thinner slice than a whole group, so it gets its
 * own floor. Below this the bucket prints no figure and says why.
 */
export const MIN_REALIZATION_BUCKET_N = 15

/**
 * Redfin's published definition of every share-of-list metric excludes sales
 * that closed 50 percent above or below the ask (fetched 2026-09-07,
 * docs/research/cma-professional-practice-2026-09-07.md §4). A close at 3x its
 * own asking price is a data defect or a related-party transfer, and one of
 * them drags a median. The SAME rule applies everywhere a close-to-ask ratio
 * is measured in this repo, so it is stated once, here.
 */
export const ASK_RATIO_MIN = 0.5
export const ASK_RATIO_MAX = 1.5

/** The §0 trace that ships beside a figure and in `citations`. */
export interface CmaStatSource {
  table: string
  filter: string
  /** ISO instant the rows were pulled. */
  fetchedAt: string
  /** The read, written out so a reviewer can re-run it. */
  query: string
}

export interface CmaOfferTimingPoint {
  days: number
  /** Share of the population with an accepted offer by `days`, 0-100, one decimal. */
  pct: number
}

export interface CmaOfferTiming {
  city: string
  windowMonths: number
  /** Closes with a usable `days_to_pending` in the window. */
  n: number
  /** Null when `n` is under the minimum — never a curve drawn on a handful. */
  points: CmaOfferTimingPoint[] | null
  medianDays: number | null
  /** Null when the figures are publishable; a sentence when they are not. */
  reason: string | null
  source: CmaStatSource
}

export type CmaAskOutcomeKey = 'sold-no-cut' | 'sold-after-cut' | 'did-not-sell'

export interface CmaAskOutcomeGroup {
  key: CmaAskOutcomeKey
  /**
   * How many listings the median was computed over — NOT how many landed in
   * the group. A sale with no days-to-pending value is a sale, but it is not a
   * datapoint, and printing a count the figure beside it was not computed from
   * is the §0 defect this field exists to avoid. The two differ by one row in
   * Bend and by none in Redmond (verified 2026-09-07); the source line states
   * how many were set aside.
   */
  n: number
  medianDays: number | null
  /** `sold-after-cut` only: median of (original ask − final ask) / original ask, in percent. */
  medianCutPct?: number | null
  /**
   * Median close ÷ ORIGINAL ask, in percent — what the group actually realized
   * against the price it opened at. Null on `did-not-sell` (nothing closed) and
   * null when the count is under the minimum.
   */
  medianSoldToOriginalAskPct: number | null
  /**
   * How many sales that median was computed over — smaller than `n` whenever a
   * row carries days but no usable pair of prices. Printing `n` beside a figure
   * computed on fewer rows is the §0 defect this field exists to avoid.
   */
  soldToOriginalAskN: number
  reason: string | null
}

export interface CmaAskOutcome {
  city: string
  windowMonths: number
  groups: CmaAskOutcomeGroup[]
  source: CmaStatSource
}

/** The rows `getCmaCityClosedOutcomes` returns, narrowed to what is measured. */
export interface LocalClosedRow {
  CloseDate?: string | null
  days_to_pending?: number | null
  OriginalListPrice?: number | null
  ListPrice?: number | null
  ClosePrice?: number | null
}

/** The rows `getCmaCityFailedOutcomes` returns, narrowed to what is measured. */
export interface LocalFailedRow {
  StandardStatus?: string | null
  ListDate?: string | null
  OnMarketDate?: string | null
  off_market_date?: string | null
  status_change_timestamp?: string | null
  DaysOnMarket?: number | null
}

// ── medians, computed twice on purpose ──────────────────────────────────────

/**
 * Median by sorting and picking the middle. The obvious implementation.
 *
 * `medianCounted` below answers the same question a completely different way,
 * and `medianVerified` ships a number only when the two agree. That is not
 * ceremony: a median is the figure a seller reads as "half the homes", it is
 * computed here rather than by the database, and §0 asks for the cross-check
 * of derived math rather than one implementation's word for it.
 */
export function medianSorted(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Median by counting, with no sort anywhere: for each candidate value, count
 * how many of the population fall below it and how many equal it, and take the
 * value whose rank straddles the middle. Even-length sets average the two
 * middle order statistics, selected the same way.
 */
export function medianCounted(values: readonly number[]): number | null {
  const n = values.length
  if (n === 0) return null
  /** The k-th smallest value, 1-indexed, without sorting. */
  const orderStatistic = (k: number): number => {
    for (const candidate of values) {
      let below = 0
      let equal = 0
      for (const v of values) {
        if (v < candidate) below++
        else if (v === candidate) equal++
      }
      if (below < k && k <= below + equal) return candidate
    }
    // Unreachable for 1 <= k <= n: every rank is covered by some value's band.
    return values[0]
  }
  if (n % 2 === 1) return orderStatistic((n + 1) / 2)
  return (orderStatistic(n / 2) + orderStatistic(n / 2 + 1)) / 2
}

/**
 * The median the document may print: `medianSorted` confirmed by
 * `medianCounted`. Returns null when the two disagree, which cannot happen for
 * a finite set of finite numbers and is therefore a bug signal, not a data
 * one — and a withheld figure beats a wrong one.
 */
export function medianVerified(values: readonly number[]): number | null {
  const a = medianSorted(values)
  const b = medianCounted(values)
  if (a == null || b == null) return null
  return a === b ? a : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── offer timing ────────────────────────────────────────────────────────────

/** Days-to-pending values usable as a measurement: present, finite, not negative. */
export function usableDaysToPending(rows: readonly LocalClosedRow[]): number[] {
  const out: number[] = []
  for (const r of rows) {
    if (r.days_to_pending == null) continue
    const n = Number(r.days_to_pending)
    if (!Number.isFinite(n) || n < 0) continue
    out.push(Math.round(n))
  }
  return out
}

/**
 * The cumulative curve + median over one city's closes.
 *
 * `pct` at day D is the share of the population whose accepted offer came on
 * or before day D — cumulative, so the series is non-decreasing by
 * construction and the last point is the share that took 180 days or less
 * (not necessarily 100).
 */
export function computeOfferTiming(args: {
  rows: readonly LocalClosedRow[]
  city: string
  sinceIso: string
  fetchedAt: string
  windowMonths?: number
}): CmaOfferTiming {
  const days = usableDaysToPending(args.rows)
  const n = days.length
  const windowMonths = args.windowMonths ?? LOCAL_OUTCOME_WINDOW_MONTHS
  const source: CmaStatSource = {
    table: 'listings',
    filter: `City='${args.city}', PropertyType='A', property_sub_type='Single Family Residence', StandardStatus='Closed', CloseDate >= ${args.sinceIso}; days measured as days_to_pending (on-market date to accepted offer), rows with no days_to_pending excluded`,
    fetchedAt: args.fetchedAt,
    query: `select ListingKey, CloseDate, days_to_pending, OriginalListPrice, ListPrice, ClosePrice from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"`,
  }
  if (n < MIN_LOCAL_OUTCOME_N) {
    return {
      city: args.city,
      windowMonths,
      n,
      points: null,
      medianDays: null,
      reason: `${n} ${n === 1 ? 'sale' : 'sales'} in ${args.city} in the last ${windowMonths} months carried a days-to-offer value. That is under the ${MIN_LOCAL_OUTCOME_N} needed to publish a timing curve.`,
      source,
    }
  }
  const medianDays = medianVerified(days)
  if (medianDays == null) {
    return {
      city: args.city,
      windowMonths,
      n,
      points: null,
      medianDays: null,
      reason: 'The median could not be confirmed by a second computation, so no timing figure is published.',
      source,
    }
  }
  const points = OFFER_TIMING_DAYS.map((d) => ({
    days: d,
    pct: round1((days.filter((v) => v <= d).length / n) * 100),
  }))
  return { city: args.city, windowMonths, n, points, medianDays, reason: null, source }
}

// ── first ask → outcome ─────────────────────────────────────────────────────

function askPair(row: LocalClosedRow): { original: number; final: number } | null {
  const original = Number(row.OriginalListPrice)
  const final = Number(row.ListPrice)
  if (!Number.isFinite(original) || original <= 0) return null
  if (!Number.isFinite(final) || final <= 0) return null
  return { original, final }
}

/**
 * Close ÷ ORIGINAL ask as a percent, or null when the row cannot support one:
 * a missing price, a non-positive price, or a ratio outside the ±50 percent
 * bounds above.
 */
export function soldToOriginalAskPct(row: LocalClosedRow): number | null {
  const original = Number(row.OriginalListPrice)
  const close = Number(row.ClosePrice)
  if (!Number.isFinite(original) || original <= 0) return null
  if (!Number.isFinite(close) || close <= 0) return null
  const ratio = close / original
  if (ratio < ASK_RATIO_MIN || ratio > ASK_RATIO_MAX) return null
  return ratio * 100
}

/** True when the ask that closed the sale is below the ask that opened it. */
export function soldAfterCut(row: LocalClosedRow): boolean {
  const asks = askPair(row)
  return asks != null && asks.original > asks.final
}

/** True when the ask never came down: the home sold at or above its first ask. */
export function soldWithoutCut(row: LocalClosedRow): boolean {
  const asks = askPair(row)
  return asks != null && asks.original <= asks.final
}

/**
 * Days a listing that never sold spent on the market: list date to off-market
 * date, through the SAME function the subject's own final cycle uses.
 */
export function failedRowDays(row: LocalFailedRow): number | null {
  return finalCycleDaysOnMarket({
    listDate: row.ListDate ?? row.OnMarketDate ?? null,
    offMarketDate: row.off_market_date ?? row.status_change_timestamp ?? null,
    daysOnMarket: row.DaysOnMarket ?? null,
  })
}

function group(
  key: CmaAskOutcomeKey,
  days: number[],
  label: string,
  opts: { cutPcts?: number[]; realizationPcts?: number[] } = {},
): CmaAskOutcomeGroup {
  const n = days.length
  const cutPcts = opts.cutPcts
  // The realization median stands on its own count and its own minimum: a
  // group can carry enough sales to publish days and not enough usable price
  // pairs to publish a share, and the reverse.
  const realizationPcts = opts.realizationPcts ?? []
  const soldToOriginalAskN = realizationPcts.length
  const realizationMedian =
    key === 'did-not-sell' || soldToOriginalAskN < MIN_LOCAL_OUTCOME_N
      ? null
      : medianVerified(realizationPcts)
  const medianSoldToOriginalAskPct = realizationMedian == null ? null : round1(realizationMedian)
  const base = {
    key,
    n,
    ...(cutPcts ? { medianCutPct: null as number | null } : {}),
    medianSoldToOriginalAskPct,
    soldToOriginalAskN,
  }
  if (n < MIN_LOCAL_OUTCOME_N) {
    return {
      ...base,
      medianDays: null,
      reason: `${n} ${label} in this window, under the ${MIN_LOCAL_OUTCOME_N} needed to publish a median.`,
    }
  }
  const medianDays = medianVerified(days)
  if (medianDays == null) {
    return {
      ...base,
      medianDays: null,
      reason: 'The median could not be confirmed by a second computation, so no figure is published.',
    }
  }
  const medianCutPct = cutPcts ? medianVerified(cutPcts) : undefined
  return {
    ...base,
    medianDays,
    ...(cutPcts ? { medianCutPct: medianCutPct == null ? null : round1(medianCutPct) } : {}),
    reason: null,
  }
}

/**
 * The three groups, over one city and one window.
 *
 * Closed rows are split by whether the first ask ever moved; failed rows are
 * counted whole. Each group carries its own `n` and its own minimum, so a city
 * with plenty of sales and few failures publishes two bars and says why the
 * third is missing.
 */
export function computeAskOutcome(args: {
  closedRows: readonly LocalClosedRow[]
  failedRows: readonly LocalFailedRow[]
  city: string
  sinceIso: string
  fetchedAt: string
  windowMonths?: number
}): CmaAskOutcome {
  const windowMonths = args.windowMonths ?? LOCAL_OUTCOME_WINDOW_MONTHS
  const closedWithAsks = args.closedRows.filter((r) => askPair(r) != null)
  const askPopulationPct =
    args.closedRows.length > 0 ? round1((closedWithAsks.length / args.closedRows.length) * 100) : 0

  const noCutRows = closedWithAsks.filter(soldWithoutCut)
  const cutRows = closedWithAsks.filter(soldAfterCut)
  const noCutDays = usableDaysToPending(noCutRows)
  const cutDays = usableDaysToPending(cutRows)
  const cutPcts = cutRows
    .map((r) => askPair(r)!)
    .map(({ original, final }) => ((original - final) / original) * 100)
  // What each sold group realized against the ask it OPENED at. Same rows, one
  // more measurement; rows with no close price or a ratio outside ±50 percent
  // are not datapoints and are counted out in the source line.
  const realizationOf = (rows: readonly LocalClosedRow[]): number[] =>
    rows.map(soldToOriginalAskPct).filter((n): n is number => n != null)
  const noCutRealization = realizationOf(noCutRows)
  const cutRealization = realizationOf(cutRows)
  const failedDays = args.failedRows
    .map(failedRowDays)
    .filter((d): d is number => d != null && d >= 0)

  const soldWithoutDays = noCutRows.length - noCutDays.length + (cutRows.length - cutDays.length)
  const failedWithoutDays = args.failedRows.length - failedDays.length

  const source: CmaStatSource = {
    table: 'listings',
    filter:
      `City='${args.city}', PropertyType='A', property_sub_type='Single Family Residence'. ` +
      `Sold groups: StandardStatus='Closed', CloseDate >= ${args.sinceIso}, split on OriginalListPrice > ListPrice (a cut); ` +
      `${closedWithAsks.length} of ${args.closedRows.length} closed rows (${askPopulationPct}%) carry both asks; days = days_to_pending. ` +
      `Did not sell: StandardStatus in (Expired, Canceled, Withdrawn), off_market_date >= ${args.sinceIso}, ` +
      `days = list date to off-market date (finalCycleDaysOnMarket, the same span measured for the subject). ` +
      `Each group's n is the count the median was computed over: ${soldWithoutDays} sold row(s) and ` +
      `${failedWithoutDays} off-market row(s) carried no usable days figure and were set aside. ` +
      `Share of the original ask = ClosePrice / OriginalListPrice on the same closed rows, ` +
      `excluding closes more than 50% above or below that ask (${noCutRealization.length} of ${noCutRows.length} ` +
      `no-cut and ${cutRealization.length} of ${cutRows.length} cut sale(s) carried a usable pair).`,
    fetchedAt: args.fetchedAt,
    query:
      `select ListingKey, CloseDate, days_to_pending, OriginalListPrice, ListPrice, ClosePrice from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"` +
      ` ;; ` +
      `select ListingKey, "StandardStatus", "ListDate", "OnMarketDate", off_market_date, status_change_timestamp, "DaysOnMarket" from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" in ('Expired','Canceled','Withdrawn') and off_market_date >= '${args.sinceIso}' order by off_market_date, "ListingKey"`,
  }

  return {
    city: args.city,
    windowMonths,
    groups: [
      group('sold-no-cut', noCutDays, `sales in ${args.city} closed without a price cut`, {
        realizationPcts: noCutRealization,
      }),
      group('sold-after-cut', cutDays, `sales in ${args.city} closed after a price cut`, {
        cutPcts,
        realizationPcts: cutRealization,
      }),
      group('did-not-sell', failedDays, `listings in ${args.city} came off the market unsold`),
    ],
    source,
  }
}

/** YYYY-MM-DD `months` calendar months before `asOf`. */
export function localOutcomeWindowStart(asOf: Date, months = LOCAL_OUTCOME_WINDOW_MONTHS): string {
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

// ── what the original ask actually realized, by weeks on the market ─────────

/**
 * The single best overpricing exhibit we can build honestly
 * (docs/research/cma-professional-practice-2026-09-07.md §4, item 4): the
 * median share of the ORIGINAL asking price that sales realized, split by how
 * long they took to find a buyer. It replaces the "% of list by weeks" table
 * every brokerage site attributes to NAR and nobody can source — that primary
 * source was fetched for and not reached, so the figure is computed on our own
 * closed rows instead of cited.
 *
 * Buckets are inclusive at the label: weeks = days_to_pending / 7, so a sale
 * that went pending on day 14 is 2.0 weeks and sits in '0-2', and day 15 is
 * 2.14 weeks and sits in '3-4'.
 */
export const REALIZATION_BUCKETS = [
  { weeks: '0-2', maxWeeks: 2 },
  { weeks: '3-4', maxWeeks: 4 },
  { weeks: '5-8', maxWeeks: 8 },
  { weeks: '9-16', maxWeeks: 16 },
  { weeks: '17+', maxWeeks: Infinity },
] as const

export type CmaRealizationBucketLabel = (typeof REALIZATION_BUCKETS)[number]['weeks']

export interface CmaRealizationBucket {
  weeks: CmaRealizationBucketLabel
  /** Sales in the bucket carrying BOTH a days figure and a usable price pair. */
  n: number
  /** Median ClosePrice ÷ OriginalListPrice, percent, one decimal. */
  medianPctOfOriginalAsk: number | null
  /** Null when the figure is publishable; a sentence when it is withheld. */
  reason: string | null
}

export interface CmaOriginalAskRealization {
  city: string
  windowMonths: number
  /** Sales that landed in some bucket — the sum of the buckets' own counts. */
  n: number
  buckets: CmaRealizationBucket[]
  source: CmaStatSource
}

/** Which bucket a days-to-pending value falls in. */
export function realizationBucketFor(days: number): CmaRealizationBucketLabel {
  const weeks = days / 7
  for (const b of REALIZATION_BUCKETS) if (weeks <= b.maxWeeks) return b.weeks
  return '17+'
}

/**
 * The table, over the SAME closed rows chapter 2's other two figures are
 * computed from. A row counts only when it carries both a days-to-pending
 * value and a close-to-original-ask ratio inside ±50 percent; a bucket under
 * MIN_REALIZATION_BUCKET_N prints no figure and says how many it had.
 */
export function computeOriginalAskRealization(args: {
  rows: readonly LocalClosedRow[]
  city: string
  sinceIso: string
  fetchedAt: string
  windowMonths?: number
}): CmaOriginalAskRealization {
  const windowMonths = args.windowMonths ?? LOCAL_OUTCOME_WINDOW_MONTHS
  const byBucket = new Map<CmaRealizationBucketLabel, number[]>(
    REALIZATION_BUCKETS.map((b) => [b.weeks, [] as number[]]),
  )
  let withDays = 0
  for (const row of args.rows) {
    const days = row.days_to_pending == null ? null : Number(row.days_to_pending)
    if (days == null || !Number.isFinite(days) || days < 0) continue
    withDays++
    const pct = soldToOriginalAskPct(row)
    if (pct == null) continue
    byBucket.get(realizationBucketFor(Math.round(days)))!.push(pct)
  }
  const buckets = REALIZATION_BUCKETS.map(({ weeks }) => {
    const pcts = byBucket.get(weeks)!
    const n = pcts.length
    if (n < MIN_REALIZATION_BUCKET_N) {
      return {
        weeks,
        n,
        medianPctOfOriginalAsk: null,
        reason: `${n} ${n === 1 ? 'sale' : 'sales'} took ${weeks === '17+' ? '17 weeks or more' : `${weeks} weeks`} to find a buyer in this window, under the ${MIN_REALIZATION_BUCKET_N} needed to publish a figure.`,
      }
    }
    const median = medianVerified(pcts)
    if (median == null) {
      return {
        weeks,
        n,
        medianPctOfOriginalAsk: null,
        reason: 'The median could not be confirmed by a second computation, so no figure is published.',
      }
    }
    return { weeks, n, medianPctOfOriginalAsk: round1(median), reason: null }
  })
  const n = buckets.reduce((sum, b) => sum + b.n, 0)
  return {
    city: args.city,
    windowMonths,
    n,
    buckets,
    source: {
      table: 'listings',
      filter:
        `City='${args.city}', PropertyType='A', property_sub_type='Single Family Residence', ` +
        `StandardStatus='Closed', CloseDate >= ${args.sinceIso}. Weeks = days_to_pending / 7, bucket edges ` +
        `inclusive at the label. Figure = median ClosePrice / OriginalListPrice, excluding closes more than ` +
        `50% above or below that ask. ${withDays} of ${args.rows.length} closed row(s) carried a days figure; ` +
        `${n} of those also carried a usable price pair and were measured.`,
      fetchedAt: args.fetchedAt,
      query: `select ListingKey, CloseDate, days_to_pending, OriginalListPrice, ClosePrice from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"`,
    },
  }
}
