/**
 * reachability: entry-point executable spec for the comparable DOM and price-history rows, held by lib/cma/canter-letter-flow.contract.test.ts.
 * Matt 2026-09-17: every comparable row (closed / pending / active / expired)
 * must show DOM + listing/price history. Tip Ready / CI refuse if missing.
 */

import type { MatrixEntry } from '@/lib/cma/matrix-entry'

/** Exact matrix row labels (must match SHARED_ROWS in comp-matrix.ts). */
export const COMPARABLE_DOM_ROW_LABEL = 'Days on market'
/**
 * The same row in the sales table, named for what a sale's count is: first
 * list to an accepted offer (comp-matrix.ts, DAYS_TO_OFFER_ROW_LABEL). The
 * field Matt locked on 2026-09-17 is still there, under the words that say
 * what it counts.
 */
export const COMPARABLE_DAYS_TO_OFFER_ROW_LABEL = 'Days to an offer'
export const COMPARABLE_PRICE_HISTORY_ROW_LABEL = 'First ask \u2192 last ask \u2192 outcome'

/** Matrix HTML must carry both shared rows. */
export function matrixHtmlHasDomAndPriceHistory(html: string): boolean {
  if (!html || html.trim().length === 0) return false
  const hasHistory =
    html.includes(COMPARABLE_PRICE_HISTORY_ROW_LABEL) ||
    (html.includes('First ask') &&
      html.includes('last ask') &&
      html.includes('outcome') &&
      html.includes('class="arc-arrow"'))
  const hasDays =
    html.includes(COMPARABLE_DOM_ROW_LABEL) || html.includes(COMPARABLE_DAYS_TO_OFFER_ROW_LABEL)
  return hasDays && hasHistory
}

/**
 * One comparable (non-subject) row is Tip Ready when it has a DOM figure and
 * a listing/price history (ask path and/or close/outcome).
 */
export function comparableEntryHasDomAndPriceHistory(
  entry: Pick<
    MatrixEntry,
    'family' | 'domDays' | 'firstAsk' | 'lastAsk' | 'listPrice' | 'closePrice' | 'outcome' | 'endLabel'
  >,
): boolean {
  if (entry.family === 'subject') return true
  if (entry.domDays == null || !Number.isFinite(entry.domDays) || entry.domDays < 0) return false
  const hasAsk =
    (entry.firstAsk != null && entry.firstAsk > 0) ||
    (entry.lastAsk != null && entry.lastAsk > 0) ||
    (entry.listPrice != null && entry.listPrice > 0)
  const hasOutcome =
    Boolean(entry.outcome && entry.outcome.trim()) ||
    (entry.closePrice != null && entry.closePrice > 0) ||
    Boolean(entry.endLabel && entry.endLabel.trim())
  return hasAsk && hasOutcome
}

/** Tip Ready refuse: every peer in the set must carry DOM + price history. */
export function comparableSetHasDomAndPriceHistory(
  entries: readonly Pick<
    MatrixEntry,
    'family' | 'domDays' | 'firstAsk' | 'lastAsk' | 'listPrice' | 'closePrice' | 'outcome' | 'endLabel'
  >[],
): boolean {
  const peers = entries.filter((e) => e.family !== 'subject')
  if (peers.length === 0) return false
  return peers.every(comparableEntryHasDomAndPriceHistory)
}
