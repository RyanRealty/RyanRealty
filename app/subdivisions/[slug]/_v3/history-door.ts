/**
 * THE YEAR DOOR, and the range it can honestly open.
 *
 * A Ledger row is a door (PUBLIC_UI.md section 3, and V3LedgerRowBase makes `href`
 * required), so the sales-history Ledger sends each closed year to the Central Oregon
 * closed-sales explorer at that year. The explorer does not accept every year it is
 * handed. app/housing-market/history/page.tsx CLAMPS the parameter:
 *
 *   const year = Math.min(2030, Math.max(1998, Number(one(sp.year)) || 2024))
 *
 * A row for 1997 therefore opens a page of 1998 aggregates, under a heading that reads
 * "Active query 1998". That is a §0 failure with a public URL: a plat figure whose door
 * shows a different year's data, beneath a sentence promising the year the row names.
 * It is not hypothetical — 7,553 closed single-family sales across 497 plats predate
 * 1998, and the earliest is 1993 (verified live 2026-08-12 against public.listings,
 * PropertyType='A', StandardStatus like '%closed%', ClosePrice > 0).
 *
 * So the split happens HERE, before any row is built: a year inside the explorer's range
 * becomes a row with a working door, and a year outside it is stated as a count in the
 * section's note instead of being either silently dropped or given a lying link. The
 * section total still covers every year, so nothing the RPC returned leaves the page.
 *
 * THE RANGE IS MECHANICALLY BOUND, NOT RESTATED. The two constants below mirror literals
 * in a file this route does not own, which is exactly the drift that produced the defect.
 * `ci:subdivision-stats-integrity` parses the clamp out of the explorer page and fails
 * when either bound stops matching, so the destination cannot move without this file
 * moving with it.
 */

import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'

/** The explorer this section's rows open. It reads `year` and `city`. */
export const HISTORY_PATH = '/housing-market/history'

/** Earliest year the explorer will accept. Mirrors its Math.max bound. */
export const HISTORY_MIN_YEAR = 1998

/** Latest year the explorer will accept. Mirrors its Math.min bound. */
export const HISTORY_MAX_YEAR = 2030

/** True when the explorer opens at this year rather than clamping to another one. */
export function explorerOpensYear(year: number): boolean {
  return Number.isInteger(year) && year >= HISTORY_MIN_YEAR && year <= HISTORY_MAX_YEAR
}

/**
 * The door for one year. The city narrows the destination when the page resolved one;
 * 'Central Oregon' is the page's no-city sentinel and adds no filter.
 */
export function historyYearHref(year: number, cityName: string): string {
  const cityQuery = cityName === 'Central Oregon' ? '' : `&city=${encodeURIComponent(cityName)}`
  return `${HISTORY_PATH}?year=${year}${cityQuery}`
}

export type HistoryYearSplit = {
  /** Years the explorer opens at the year the row names. These become rows. */
  openable: SubdivisionSalesYear[]
  /** Closings in years the explorer cannot open. Stated, never dropped. */
  outsideClosed: number
  /** How many such years, so the note can say "year" or "years". */
  outsideYears: number
}

/** Split one plat's yearly aggregates by what the explorer can actually open. */
export function splitByExplorerRange(history: readonly SubdivisionSalesYear[]): HistoryYearSplit {
  const openable: SubdivisionSalesYear[] = []
  let outsideClosed = 0
  let outsideYears = 0
  for (const row of history) {
    if (explorerOpensYear(row.year)) {
      openable.push(row)
      continue
    }
    outsideClosed += row.closedCount
    outsideYears += 1
  }
  return { openable, outsideClosed, outsideYears }
}
