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
    query: `select ListingKey, CloseDate, days_to_pending, OriginalListPrice, ListPrice from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"`,
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
  cutPcts?: number[],
): CmaAskOutcomeGroup {
  const n = days.length
  if (n < MIN_LOCAL_OUTCOME_N) {
    return {
      key,
      n,
      medianDays: null,
      ...(cutPcts ? { medianCutPct: null } : {}),
      reason: `${n} ${label} in this window, under the ${MIN_LOCAL_OUTCOME_N} needed to publish a median.`,
    }
  }
  const medianDays = medianVerified(days)
  if (medianDays == null) {
    return {
      key,
      n,
      medianDays: null,
      ...(cutPcts ? { medianCutPct: null } : {}),
      reason: 'The median could not be confirmed by a second computation, so no figure is published.',
    }
  }
  const medianCutPct = cutPcts ? medianVerified(cutPcts) : undefined
  return {
    key,
    n,
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
      `${failedWithoutDays} off-market row(s) carried no usable days figure and were set aside.`,
    fetchedAt: args.fetchedAt,
    query:
      `select ListingKey, CloseDate, days_to_pending, OriginalListPrice, ListPrice from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"` +
      ` ;; ` +
      `select ListingKey, "StandardStatus", "ListDate", "OnMarketDate", off_market_date, status_change_timestamp, "DaysOnMarket" from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" in ('Expired','Canceled','Withdrawn') and off_market_date >= '${args.sinceIso}' order by off_market_date, "ListingKey"`,
  }

  return {
    city: args.city,
    windowMonths,
    groups: [
      group('sold-no-cut', noCutDays, `sales in ${args.city} closed without the ask coming down`),
      group('sold-after-cut', cutDays, `sales in ${args.city} closed after the ask came down`, cutPcts),
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
