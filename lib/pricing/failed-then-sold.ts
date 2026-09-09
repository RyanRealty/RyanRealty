/**
 * "Near you, homes that came off unsold and then sold" — the LOCAL version of
 * the regional failed-ask backtest.
 *
 * `FAILED_ASK_BACKTEST` (lib/cma/expired-audit.ts) is 3,394 Central Oregon
 * pairs, 2023–2026: a listing cycle that ended Expired / Canceled / Withdrawn,
 * followed by a closed sale at the SAME address. It is the calibration behind
 * the failed-ask cap, and chapter 1 of the seller document prints it as a
 * regional figure. What it cannot say is what happened in the reader's own
 * city, which is the sentence chapter 2 needs
 * (docs/plans/CMA_REIMAGINED_2026-09-07.md, delta of 2026-09-07 afternoon:
 * "from the local pairs, not the regional backtest, when n >= 10; else the
 * regional figure, named as regional").
 *
 * THE PAIRING IS THE SAME PAIRING. Every rule below is `scripts/cma-backtest.mjs`'s,
 * restated as a pure function so the document and the calibration cannot drift:
 *
 *  · address key = street number + street name + city, lower-cased and
 *    whitespace-collapsed. A cycle with any of the three missing is skipped.
 *  · a failure ends on `off_market_date`, falling back to
 *    `status_change_timestamp`.
 *  · a candidate sale's marketing must START at or after the failure — its
 *    `ListDate`, falling back to `CloseDate` when the sale carries no list date.
 *  · the sale must close within RELIST_WINDOW_MONTHS of the failure.
 *  · when several sales qualify, the EARLIEST close is the pair.
 *  · the ratio is close ÷ the ask that failed (`ListPrice` on the failed row —
 *    the last ask, not the original).
 *
 * What differs, deliberately: the window is the subject's city and 24 months
 * rather than the region and three years, and the population is single-family
 * only. Both are stated in the source block; neither changes a rule above.
 */

import { medianVerified } from '@/lib/pricing/local-outcomes'
import type { CmaStatSource } from '@/lib/pricing/local-outcomes'

/** Failures are looked back this far. The regional backtest looks back three years. */
export const FAILED_THEN_SOLD_WINDOW_MONTHS = 24

/** A sale must close within this long after the failure to be its pair. */
export const RELIST_WINDOW_MONTHS = 18

/** Under this many pairs the city figure is withheld and the reason says so. */
export const MIN_FAILED_THEN_SOLD_N = 10

const MS_PER_MONTH = 30.44 * 86_400_000

export interface FailedCycleRow {
  ListingKey?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  StandardStatus?: string | null
  /** The ask that failed — the LAST ask on the failed cycle. */
  ListPrice?: number | null
  OriginalListPrice?: number | null
  off_market_date?: string | null
  status_change_timestamp?: string | null
}

export interface ClosedSaleRow {
  ListingKey?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  ClosePrice?: number | null
  CloseDate?: string | null
  ListDate?: string | null
}

export interface FailedThenSoldPair {
  addressKey: string
  failedListingKey: string | null
  failedStatus: string | null
  failedAsk: number
  failedEnd: string
  soldListingKey: string | null
  closePrice: number
  closeDate: string
  monthsToClose: number
  /** close ÷ failed ask, as a percent. */
  shareOfFailedAskPct: number
}

export interface CmaLocalFailedThenSold {
  city: string
  windowMonths: number
  /** Pairs found. The median is computed over exactly these. */
  n: number
  /** Median close ÷ the ask that failed, percent, one decimal. Null under the minimum. */
  medianShareOfFailedAsk: number | null
  /** Null when the figure is publishable; a sentence when it is withheld. */
  reason: string | null
  source: CmaStatSource
}

/** street number + street name + city, normalized. Null when any part is missing. */
export function addressKey(row: {
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
}): string | null {
  const num = String(row.StreetNumber ?? '').trim().toLowerCase()
  const street = String(row.StreetName ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  const city = String(row.City ?? '').trim().toLowerCase()
  if (!num || !street || !city) return null
  return `${num}|${street}|${city}`
}

/** The day a failed cycle left the market. */
export function failureEnd(row: FailedCycleRow): string | null {
  const end = row.off_market_date ?? row.status_change_timestamp ?? null
  const s = String(end ?? '').trim()
  return s ? s : null
}

function ms(value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(String(value)).getTime()
  return Number.isFinite(t) ? t : null
}

function positive(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Every failure that later sold at the same address, one pair per failure,
 * oldest failure first.
 */
export function pairFailedThenSold(args: {
  failedRows: readonly FailedCycleRow[]
  closedRows: readonly ClosedSaleRow[]
  relistWindowMonths?: number
}): FailedThenSoldPair[] {
  const windowMs = (args.relistWindowMonths ?? RELIST_WINDOW_MONTHS) * MS_PER_MONTH
  const closedByAddress = new Map<string, ClosedSaleRow[]>()
  for (const sale of args.closedRows) {
    const key = addressKey(sale)
    if (!key) continue
    const list = closedByAddress.get(key)
    if (list) list.push(sale)
    else closedByAddress.set(key, [sale])
  }

  const pairs: FailedThenSoldPair[] = []
  for (const failed of args.failedRows) {
    const key = addressKey(failed)
    if (!key) continue
    const end = failureEnd(failed)
    const endMs = ms(end)
    if (end == null || endMs == null) continue
    const failedAsk = positive(failed.ListPrice)
    if (failedAsk == null) continue

    const candidates = (closedByAddress.get(key) ?? [])
      .filter((sale) => {
        const closeMs = ms(sale.CloseDate)
        if (closeMs == null) return false
        const startMs = ms(sale.ListDate) ?? closeMs
        return startMs >= endMs && closeMs - endMs <= windowMs
      })
      .sort((a, b) => (ms(a.CloseDate)! - ms(b.CloseDate)!))
    const sale = candidates[0]
    if (!sale) continue
    const closePrice = positive(sale.ClosePrice)
    if (closePrice == null) continue

    pairs.push({
      addressKey: key,
      failedListingKey: failed.ListingKey ?? null,
      failedStatus: failed.StandardStatus ?? null,
      failedAsk,
      failedEnd: String(end).slice(0, 10),
      soldListingKey: sale.ListingKey ?? null,
      closePrice,
      closeDate: String(sale.CloseDate).slice(0, 10),
      monthsToClose: Math.round(((ms(sale.CloseDate)! - endMs) / MS_PER_MONTH) * 10) / 10,
      shareOfFailedAskPct: (closePrice / failedAsk) * 100,
    })
  }
  return pairs.sort((a, b) => a.failedEnd.localeCompare(b.failedEnd))
}

/**
 * The block the document reads: the city's own median share of the failed ask,
 * or a stated reason there is no city figure.
 */
export function computeLocalFailedThenSold(args: {
  failedRows: readonly FailedCycleRow[]
  closedRows: readonly ClosedSaleRow[]
  city: string
  sinceIso: string
  fetchedAt: string
  windowMonths?: number
  relistWindowMonths?: number
}): CmaLocalFailedThenSold {
  const windowMonths = args.windowMonths ?? FAILED_THEN_SOLD_WINDOW_MONTHS
  const relistWindowMonths = args.relistWindowMonths ?? RELIST_WINDOW_MONTHS
  const pairs = pairFailedThenSold({
    failedRows: args.failedRows,
    closedRows: args.closedRows,
    relistWindowMonths,
  })
  const n = pairs.length
  const source: CmaStatSource = {
    table: 'listings',
    filter:
      `City='${args.city}', PropertyType='A', property_sub_type='Single Family Residence'. ` +
      `Failures: StandardStatus in (Expired, Canceled, Withdrawn), off_market_date >= ${args.sinceIso} ` +
      `(${windowMonths} months); ${args.failedRows.length} cycle(s) read. ` +
      `Sales: StandardStatus='Closed', CloseDate >= ${args.sinceIso}; ${args.closedRows.length} sale(s) read. ` +
      `A pair is the same street number + street name + city, the sale's ListDate (or CloseDate when it has none) ` +
      `on or after the failure's off-market date, closing within ${relistWindowMonths} months of it, earliest close wins. ` +
      `Figure = median ClosePrice / the asking price that failed (ListPrice on the failed cycle), over ${n} pair(s). ` +
      `Same pairing rules as scripts/cma-backtest.mjs, narrowed to one city and single-family homes.`,
    fetchedAt: args.fetchedAt,
    query:
      `select ListingKey, "StreetNumber", "StreetName", "City", "StandardStatus", "ListPrice", "OriginalListPrice", off_market_date, status_change_timestamp from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" in ('Expired','Canceled','Withdrawn') and off_market_date >= '${args.sinceIso}' order by off_market_date, "ListingKey"` +
      ` ;; ` +
      `select ListingKey, "StreetNumber", "StreetName", "City", "ClosePrice", "CloseDate", "ListDate" from listings where "City" = '${args.city}' and "PropertyType" = 'A' and property_sub_type = 'Single Family Residence' and "StandardStatus" = 'Closed' and "CloseDate" >= '${args.sinceIso}' order by "CloseDate", "ListingKey"`,
  }

  if (n < MIN_FAILED_THEN_SOLD_N) {
    return {
      city: args.city,
      windowMonths,
      n,
      medianShareOfFailedAsk: null,
      reason: `${n} ${n === 1 ? 'home' : 'homes'} in ${args.city} came off the market unsold and then sold in the last ${windowMonths} months. That is under the ${MIN_FAILED_THEN_SOLD_N} needed to publish a local figure.`,
      source,
    }
  }
  const median = medianVerified(pairs.map((p) => p.shareOfFailedAskPct))
  if (median == null) {
    return {
      city: args.city,
      windowMonths,
      n,
      medianShareOfFailedAsk: null,
      reason: 'The median could not be confirmed by a second computation, so no figure is published.',
      source,
    }
  }
  return {
    city: args.city,
    windowMonths,
    n,
    medianShareOfFailedAsk: Math.round(median * 10) / 10,
    reason: null,
    source,
  }
}
