/**
 * List $/sf and sold $/sf per status, from the homes already on the letter
 * (the three matrices). Nothing here invents months of supply or reads the
 * city cache — each rate is that home's own ask or sale over its own living
 * area (CLAUDE.md §0). The rates caption each matrix; the status table's
 * $/sqft column lives in status-price-summary.ts (the separate "Dollars a
 * square foot" board folded into it, Matt 2026-09-24).
 */

import { countWord, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { median } from '@/lib/cma/market-status'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'

const esc = escapeHtml

export type StatusPpsfKey = 'sold' | 'active' | 'expired'

export type PpsfBand = {
  n: number
  median: number
  low: number
  high: number
}

export type StatusPpsfRow = {
  key: StatusPpsfKey
  label: string
  homes: number
  list: PpsfBand | null
  sold: PpsfBand | null
}

/** Same ask the matrix List $/sqft cell uses. */
export function listPriceForPpsf(
  entry: Pick<MatrixEntry, 'listPrice' | 'lastAsk' | 'firstAsk'>,
): number | null {
  const n = entry.listPrice ?? entry.lastAsk ?? entry.firstAsk
  return n != null && n > 0 ? n : null
}

export function ppsfOf(price: number | null | undefined, sqft: number | null | undefined): number | null {
  if (price == null || !(price > 0) || sqft == null || !(sqft > 0)) return null
  return price / sqft
}

/**
 * Median, low and high of the exact rates, each rounded once at the end, the
 * same math as the status table's $/sqft column (priceBand), so a matrix
 * caption and the table never differ by a dollar on the same homes.
 */
export function ppsfBand(values: readonly number[]): PpsfBand | null {
  if (values.length === 0) return null
  const mid = median([...values])
  if (mid == null) return null
  return {
    n: values.length,
    median: Math.round(mid),
    low: Math.round(Math.min(...values)),
    high: Math.round(Math.max(...values)),
  }
}

function homesOf(
  entries: readonly MatrixEntry[],
  list: PpsfBand | null,
  sold: PpsfBand | null,
): number {
  if (list || sold) return entries.length
  return 0
}

function closedRow(entries: readonly MatrixEntry[]): StatusPpsfRow | null {
  const homes = entries.filter((e) => e.family === 'closed')
  if (homes.length === 0) return null
  const list = ppsfBand(
    homes
      .map((e) => ppsfOf(listPriceForPpsf(e), e.sqft))
      .filter((v): v is number => v != null),
  )
  const sold = ppsfBand(
    homes
      .map((e) => ppsfOf(e.closePrice, e.sqft))
      .filter((v): v is number => v != null),
  )
  if (!list && !sold) return null
  return { key: 'sold', label: 'Sold', homes: homesOf(homes, list, sold), list, sold }
}

function askingRow(
  key: StatusPpsfKey,
  label: string,
  family: MatrixEntry['family'],
  entries: readonly MatrixEntry[],
): StatusPpsfRow | null {
  const homes = entries.filter((e) => e.family === family)
  if (homes.length === 0) return null
  const list = ppsfBand(
    homes
      .map((e) => ppsfOf(listPriceForPpsf(e), e.sqft))
      .filter((v): v is number => v != null),
  )
  if (!list) return null
  return { key, label, homes: homes.length, list, sold: null }
}

/**
 * One row per status that the selected homes actually include.
 * Subject column is never part of the rate.
 */
export function statusPpsfSummaries(input: {
  closed?: readonly MatrixEntry[] | null
  unsold?: readonly MatrixEntry[] | null
  active?: readonly MatrixEntry[] | null
}): StatusPpsfRow[] {
  const closed = (input.closed ?? []).filter((e) => e.family !== 'subject')
  const unsold = (input.unsold ?? []).filter((e) => e.family !== 'subject')
  const active = (input.active ?? []).filter((e) => e.family !== 'subject')
  return [
    closedRow(closed),
    askingRow('active', 'Active', 'active', active),
    askingRow('expired', 'Expired', 'unsold', unsold),
  ].filter((row): row is StatusPpsfRow => row != null)
}

function theseHomes(n: number, kind: 'sale' | 'listing'): string {
  const word = countWord(n)
  if (kind === 'sale') {
    return n === 1 ? 'This one sale' : `These ${word} sales`
  }
  return n === 1 ? 'This one listing' : `These ${word} listings`
}

function aFoot(band: PpsfBand): string {
  if (band.n < 2 || band.low === band.high) return `${usd(band.median)} a foot`
  return `${usd(band.low)} to ${usd(band.high)} a foot (median ${usd(band.median)})`
}

/** One sentence under a matrix, for the status that table is. */
export function statusPpsfCaptionHtml(family: 'closed' | 'unsold' | 'active', entries: readonly MatrixEntry[]): string {
  const rows = statusPpsfSummaries({
    closed: family === 'closed' ? entries : [],
    unsold: family === 'unsold' ? entries : [],
    active: family === 'active' ? entries : [],
  })
  const row = rows[0]
  if (!row) return ''
  const list = row.list
  const sold = row.sold
  const listVerb = row.homes === 1 ? 'lists' : 'list'
  let sentence = ''
  if (family === 'closed' && list && sold) {
    sentence = `${theseHomes(row.homes, 'sale')} ${listVerb} at ${aFoot(list)} and sold at ${aFoot(sold)}.`
  } else if (family === 'closed' && sold) {
    sentence = `${theseHomes(row.homes, 'sale')} sold at ${aFoot(sold)}.`
  } else if (list) {
    sentence = `${theseHomes(row.homes, 'listing')} ${listVerb} at ${aFoot(list)}.`
  }
  if (!sentence) return ''
  return `<p class="small ppsf-status-caption" data-ppsf-status="${esc(row.key)}">${esc(sentence)}</p>`
}
