/**
 * Matt 2026-09-17: every comparable row (closed / pending / active / expired)
 * must show DOM + listing/price history. Tip Ready / CI refuse if missing.
 */

import type { MatrixEntry } from '@/lib/cma/matrix-entry'

/** Exact matrix row labels (must match SHARED_ROWS in comp-matrix.ts). */
export const COMPARABLE_DOM_ROW_LABEL = 'Days on market'
export const COMPARABLE_PRICE_HISTORY_ROW_LABEL = 'First ask \u2192 last ask \u2192 outcome'

/** Matrix HTML must carry both shared rows. */
export function matrixHtmlHasDomAndPriceHistory(html: string): boolean {
  if (!html || html.trim().length === 0) return false
  return html.includes(COMPARABLE_DOM_ROW_LABEL) && html.includes(COMPARABLE_PRICE_HISTORY_ROW_LABEL)
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
