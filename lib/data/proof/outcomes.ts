/**
 * The pure half of the proof block: what a Ryan Realty closing DID, computed
 * with the market's own definitions so our marks and the market's median can
 * legitimately sit on one scale.
 *
 * DATA ACCURACY (CLAUDE.md section 0) — the two formulas here are copied from
 * `public.refresh_market_fact_sale` (supabase/migrations/
 * 20260822233000_refresh_market_fact_sale.sql), which is what produces the
 * Market Truth cells this block draws as context:
 *
 *   days_to_contract  = purchase_contract_date - "OnMarketDate"::date,
 *                       kept only when >= 0
 *   sale_to_orig_list = "ClosePrice" / "OriginalListPrice",
 *                       kept only when "OriginalListPrice" >= 100 and
 *                       "ClosePrice" > 0
 *
 * This is deliberately NOT the CMA comp formula (lib/cma/comps.ts uses
 * `pending_timestamp - ("OnMarketDate" ?? "ListDate")`). Both are defensible
 * readings of "days to pending"; they are not the same number, and this block
 * prints our closings BESIDE a published Bend median. Using the CMA's
 * timestamp against a median built from contract dates would be an
 * apples-to-oranges comparison of exactly the kind section 0 forbids. The
 * comparison decides the formula: the median's definition wins.
 *
 * Neither figure is ever `"DaysOnMarket"`, which is list-to-close and is
 * banned as DOM (CLAUDE.md section 7).
 *
 * The `>= 0` clause is not a nicety. Three of Ryan Realty's own MLS records
 * are off-market sales entered after the fact (contract dated BEFORE the home
 * reached the market, one of them pending eleven seconds after listing). The
 * market's definition drops them, so this drops them, and the count of what
 * was dropped travels in the trace rather than being quietly absorbed.
 */

/** One Ryan Realty closing as the MLS records it. Numbers, not display strings. */
export type ProofClosingInput = {
  id: string
  city: string | null
  propertySubType: string | null
  originalListPrice: number | null
  closePrice: number | null
  /** "OnMarketDate", ISO. The day the home reached the market. */
  onMarketDate: string | null
  /** `purchase_contract_date`, ISO date. The day it went under contract. */
  contractDate: string | null
  /** "CloseDate", ISO. */
  closeDate: string | null
}

/** One closing, computed. A null figure means the market's definition drops it. */
export type ProofOutcomeRow = {
  id: string
  city: string | null
  propertySubType: string | null
  /** ISO date, for the caller to format. */
  closeDate: string
  /** `ClosePrice / OriginalListPrice`, e.g. 0.937. Null when undefined. */
  saleToOriginal: number | null
  /** Whole days, contract minus on-market. Null when undefined or negative. */
  daysToContract: number | null
}

/**
 * DATA_GRAPHICS.md: "If a row's n is too small to be honest (fewer than 6
 * closes in the window for a typical) omit the graphic. Do not pad."
 */
export const PROOF_MIN_CLOSES = 6

/** The window the block reports on, and the window its context median must match. */
export const PROOF_WINDOW_MONTHS = 12

const MIN_ORIGINAL_LIST_PRICE = 100
const MS_PER_DAY = 86_400_000

function finite(n: number | null | undefined): number | null {
  if (n == null) return null
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : null
}

/** Midnight UTC of an ISO date/timestamp, so a day count never picks up a time zone. */
function utcDay(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

/**
 * `close_price / original_list_price`, the market fact definition. Null when
 * either side is missing or the original list price is below the $100 floor
 * the fact table uses to reject placeholder prices.
 */
export function saleToOriginalList(
  closePrice: number | null | undefined,
  originalListPrice: number | null | undefined,
): number | null {
  const close = finite(closePrice)
  const original = finite(originalListPrice)
  if (close == null || original == null) return null
  if (!(close > 0) || !(original >= MIN_ORIGINAL_LIST_PRICE)) return null
  return close / original
}

/**
 * `contract_date - on_market_date` in whole days, the market fact definition.
 * Null when either date is missing or the difference is negative — an MLS
 * record whose contract predates its market date is an off-market sale
 * entered after the fact, not a market outcome.
 */
export function daysToContract(
  contractDate: string | null | undefined,
  onMarketDate: string | null | undefined,
): number | null {
  const contract = utcDay(contractDate)
  const onMarket = utcDay(onMarketDate)
  if (contract == null || onMarket == null) return null
  const days = Math.round((contract - onMarket) / MS_PER_DAY)
  return days >= 0 ? days : null
}

/**
 * `percentile_cont(0.5)` — the same median Postgres computes for the Market
 * Truth cells, so an even-n set interpolates between the two middle values
 * rather than picking one of them.
 */
export function medianCont(values: readonly number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = (sorted.length - 1) / 2
  const lo = Math.floor(mid)
  const hi = Math.ceil(mid)
  const low = sorted[lo]
  const high = sorted[hi]
  if (low == null || high == null) return null
  return low + (high - low) * (mid - lo)
}

/** Every closing in the window, computed, plus what the set as a whole says. */
export type ProofOutcomes = {
  rows: ProofOutcomeRow[]
  /** Closings in the window. The number the block states out loud. */
  closings: number
  /** Rows carrying a sale-to-original-list figure. */
  saleToOriginalN: number
  /** Rows carrying a days-to-contract figure. */
  daysToContractN: number
  /** Closings the market's own definition drops from the days figure. */
  daysExcludedN: number
  medianSaleToOriginal: number | null
  medianDaysToContract: number | null
  /** Distinct cities in the set, sorted. The block names them rather than implying one market. */
  cities: string[]
  /** False when the window holds fewer than PROOF_MIN_CLOSES closings. */
  publishable: boolean
  /** Set when `publishable` is false: the one quiet line the section prints instead. */
  quietReason: string | null
}

/**
 * Compute the window's outcomes. `closings` may hold rows outside the window;
 * `windowStart`/`windowEnd` (ISO dates, inclusive) decide what counts, so the
 * caller can fetch once and the window stays a stated fact rather than a
 * property of the query.
 */
export function computeProofOutcomes(input: {
  closings: readonly ProofClosingInput[]
  windowStart: string
  windowEnd: string
}): ProofOutcomes {
  const start = utcDay(input.windowStart)
  const end = utcDay(input.windowEnd)

  const inWindow = input.closings.filter((c) => {
    const close = utcDay(c.closeDate)
    if (close == null || start == null || end == null) return false
    return close >= start && close <= end
  })

  const rows: ProofOutcomeRow[] = inWindow
    .map((c) => ({
      id: c.id,
      city: c.city,
      propertySubType: c.propertySubType,
      closeDate: String(c.closeDate).slice(0, 10),
      saleToOriginal: saleToOriginalList(c.closePrice, c.originalListPrice),
      daysToContract: daysToContract(c.contractDate, c.onMarketDate),
    }))
    // Newest close first: the record reads as "what we just did", and the
    // strips place each mark by value anyway, so this is the hover list order.
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate))

  const saleValues = rows.map((r) => r.saleToOriginal).filter((v): v is number => v != null)
  const dayValues = rows.map((r) => r.daysToContract).filter((v): v is number => v != null)
  const cities = [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))].sort()

  const closings = rows.length
  const publishable = closings >= PROOF_MIN_CLOSES

  return {
    rows,
    closings,
    saleToOriginalN: saleValues.length,
    daysToContractN: dayValues.length,
    daysExcludedN: closings - dayValues.length,
    medianSaleToOriginal: medianCont(saleValues),
    medianDaysToContract: medianCont(dayValues),
    cities,
    publishable,
    quietReason: publishable
      ? null
      : 'Too few recent closings here to chart.',
  }
}
