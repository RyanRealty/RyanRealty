/**
 * The status evidence table, FlexMLS style (Matt 2026-09-24): List, Sold and
 * $/sqft across the top, Low · Avg · Median · High down each status (Closed,
 * Pending, Active, Expired). It replaced two boards: a price board whose list
 * and sold prices shared one set of Low/Avg/Median/High columns, and a
 * separate "Dollars a square foot" board.
 *
 * Every figure is from the homes already on the letter; nothing reads the
 * city cache or invents months of supply (CLAUDE.md §0). The subject column
 * is never part of a figure. A column that covers fewer homes than its status
 * holds says so under the table.
 */

import { countWord, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { median } from '@/lib/cma/market-status'
import { listPriceForPpsf, ppsfOf } from '@/lib/cma/status-ppsf'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'

const esc = escapeHtml

export type StatusPriceKey = 'closed' | 'pending' | 'active' | 'expired'

export type PriceBand = {
  n: number
  low: number
  avg: number
  median: number
  high: number
}

export type StatusPriceRow = {
  key: StatusPriceKey
  label: string
  /** Homes in this status on the letter. A band can cover fewer. */
  homes: number
  /** The ask: list price, else last ask, else first ask (the matrix List cell). */
  list: PriceBand | null
  /** Closed only. */
  sold: PriceBand | null
  /** Each home's own price over its own living area: sold price once closed, the ask before. */
  ppsf: PriceBand | null
  /** Homes that carry the $/sqft price but no living area. */
  noLivingArea: number
}

export function priceBand(values: readonly number[]): PriceBand | null {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0)
  if (nums.length === 0) return null
  const rounded = nums.map((v) => Math.round(v))
  const mid = median(rounded)
  if (mid == null) return null
  const sum = rounded.reduce((a, b) => a + b, 0)
  return {
    n: rounded.length,
    low: Math.min(...rounded),
    avg: Math.round(sum / rounded.length),
    median: Math.round(mid),
    high: Math.max(...rounded),
  }
}

function bandOf(
  homes: readonly MatrixEntry[],
  pick: (e: MatrixEntry) => number | null | undefined,
): PriceBand | null {
  return priceBand(homes.map(pick).filter((v): v is number => v != null))
}

function statusRow(
  key: StatusPriceKey,
  label: string,
  homes: readonly MatrixEntry[],
): StatusPriceRow | null {
  if (homes.length === 0) return null
  const closed = key === 'closed'
  const rateBasis = (e: MatrixEntry) => (closed ? e.closePrice : listPriceForPpsf(e))
  const list = bandOf(homes, (e) => listPriceForPpsf(e))
  const sold = closed ? bandOf(homes, (e) => e.closePrice) : null
  if (!list && !sold) return null
  return {
    key,
    label,
    homes: homes.length,
    list,
    sold,
    ppsf: bandOf(homes, (e) => ppsfOf(rateBasis(e), e.sqft)),
    noLivingArea: homes.filter((e) => {
      const price = rateBasis(e)
      return price != null && price > 0 && !(e.sqft != null && e.sqft > 0)
    }).length,
  }
}

/** Pending vs Active from the competition set (status on MatrixEntry). */
export function splitActivePending(entries: readonly MatrixEntry[]): {
  active: MatrixEntry[]
  pending: MatrixEntry[]
} {
  const peers = entries.filter((e) => e.family === 'active')
  return {
    active: peers.filter((e) => e.status !== 'pending'),
    pending: peers.filter((e) => e.status === 'pending'),
  }
}

/**
 * One status per group the selected homes actually include: Closed from the
 * sales, Pending and Active from the homes for sale already on the letter,
 * Expired from the listings that came off unsold.
 */
export function statusPriceSummaries(input: {
  closed?: readonly MatrixEntry[] | null
  active?: readonly MatrixEntry[] | null
  unsold?: readonly MatrixEntry[] | null
}): StatusPriceRow[] {
  const closed = (input.closed ?? []).filter((e) => e.family === 'closed')
  const { active, pending } = splitActivePending(
    (input.active ?? []).filter((e) => e.family !== 'subject'),
  )
  const expired = (input.unsold ?? []).filter((e) => e.family === 'unsold')
  return [
    statusRow('closed', 'Closed', closed),
    statusRow('pending', 'Pending', pending),
    statusRow('active', 'Active', active),
    statusRow('expired', 'Expired', expired),
  ].filter((row): row is StatusPriceRow => row != null)
}

const STATS = [
  ['low', 'Low'],
  ['avg', 'Avg'],
  ['median', 'Median'],
  ['high', 'High'],
] as const

function figure(band: PriceBand | null, stat: (typeof STATS)[number][0]): string {
  return band ? esc(usd(band[stat])) : ''
}

function homesLabel(n: number): string {
  return n === 1 ? '1 home' : `${n} homes`
}

/** One sentence per column that covers fewer homes than its status holds. */
function coverageNotes(rows: readonly StatusPriceRow[]): string[] {
  const notes: string[] = []
  const note = (row: StatusPriceRow, column: string, band: PriceBand | null, why: string) => {
    const have = band?.n ?? 0
    const missing = row.homes - have
    if (missing <= 0) return
    notes.push(
      `${row.label} ${column} covers ${have} of ${row.homes} ${row.homes === 1 ? 'home' : 'homes'} (${missing} with ${why}).`,
    )
  }
  for (const row of rows) {
    note(row, 'List', row.list, 'no list price on record')
    if (row.key === 'closed') note(row, 'Sold', row.sold, 'no sold price on record')
    const ppsfMissing = row.homes - (row.ppsf?.n ?? 0)
    note(
      row,
      '$/sqft',
      row.ppsf,
      row.noLivingArea === ppsfMissing ? 'no living area on record' : 'no living area or price on record',
    )
  }
  return notes
}

export function statusPriceBoardHtml(rows: readonly StatusPriceRow[]): string {
  if (rows.length === 0) return ''
  const groups = rows
    .map(
      (row) => `<tbody data-status="${esc(row.key)}">
      <tr class="sp-group"><th scope="rowgroup" colspan="4">${esc(row.label)}<span class="sp-count">${esc(homesLabel(row.homes))}</span></th></tr>
      ${STATS.map(
        ([stat, label]) => `<tr><th scope="row">${label}</th><td class="n">${figure(row.list, stat)}</td><td class="n">${figure(row.sold, stat)}</td><td class="n">${figure(row.ppsf, stat)}</td></tr>`,
      ).join('\n      ')}
    </tbody>`,
    )
    .join('\n    ')
  const n = rows.reduce((a, r) => a + r.homes, 0)
  const notes = coverageNotes(rows)
  return `<div class="status-price" data-status-price="board">
  <h3 class="subhead">${esc(rows.map((r) => r.label).join(' · '))}</h3>
  <p class="chart-read">${esc(
    `The ${countWord(n)} homes in this report, by status. List is the asking price and Sold the closing price. $/sqft is each home's own price over its own living area: the sold price once closed, the list price for the rest.`,
  )}</p>
  <table class="kv is-wide status-price-table">
    <colgroup><col class="sp-stat"><col class="sp-fig"><col class="sp-fig"><col class="sp-fig"></colgroup>
    <thead><tr><th scope="col"></th><th class="n" scope="col">List</th><th class="n" scope="col">Sold</th><th class="n" scope="col">$/sqft</th></tr></thead>
    ${groups}
  </table>${notes.length ? `\n  <p class="small status-price-note">${esc(notes.join(' '))}</p>` : ''}
</div>`
}
