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
import { mlsStatusLabel, type MatrixEntry } from '@/lib/cma/matrix-entry'
import { comparisonSalePrice } from '@/lib/pricing/seller-net'

const esc = escapeHtml

export type StatusPriceKey = 'closed' | 'pending' | 'active' | 'expired' | 'canceled' | 'withdrawn'

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
  /**
   * Recorded concessions, including $0. A null amount stays out of the band
   * and does not reduce the price.
   */
  concessions: PriceBand | null
  /** Each home's own price over its own living area: net sold price once closed, the ask before. */
  ppsf: PriceBand | null
  /** Homes with no $/sqft because the living area is missing. */
  noLivingArea: number
  /** Homes with no $/sqft because the price it divides is missing. */
  noRatePrice: number
}

/**
 * Low, Avg, Median and High of the exact values, each rounded once at the
 * end. Rounding every value first let a median of $316.45 print as $317; the
 * published figure has to be what a recomputation from the rows gives (§0).
 */
export function priceBand(values: readonly number[]): PriceBand | null {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0)
  if (nums.length === 0) return null
  const mid = median(nums)
  if (mid == null) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return {
    n: nums.length,
    low: Math.round(Math.min(...nums)),
    avg: Math.round(sum / nums.length),
    median: Math.round(mid),
    high: Math.round(Math.max(...nums)),
  }
}

function present(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v) && v > 0
}

/** A stored concession. Null is not zero. A reported zero stays. */
function recordedConcession(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null
  return amount
}

/** Same rounding as priceBand, but a reported $0 is a fact and stays in the band. */
function concessionBand(values: readonly (number | null | undefined)[]): PriceBand | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v) && v >= 0)
  if (nums.length === 0) return null
  const mid = median(nums)
  if (mid == null) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return {
    n: nums.length,
    low: Math.round(Math.min(...nums)),
    avg: Math.round(sum / nums.length),
    median: Math.round(mid),
    high: Math.round(Math.max(...nums)),
  }
}

function statusRow(
  key: StatusPriceKey,
  label: string,
  homes: readonly MatrixEntry[],
): StatusPriceRow | null {
  if (homes.length === 0) return null
  const closed = key === 'closed'
  // One pass per home feeds the bands AND the coverage counts, so the note
  // under the table counts exactly the homes the $/sqft band left out.
  const perHome = homes.map((e) => {
    const list = listPriceForPpsf(e)
    const sold = closed && e.closePrice != null && e.closePrice > 0 ? e.closePrice : null
    const concession = recordedConcession(e.concessionsAmount)
    // Null is not a credit. Zero leaves the close unchanged.
    const net = sold != null ? comparisonSalePrice(sold, concession) : null
    const basis = closed ? net : list
    return { list, sold, concession, basis, rate: ppsfOf(basis, e.sqft) }
  })
  const list = priceBand(perHome.map((h) => h.list).filter(present))
  const sold = closed ? priceBand(perHome.map((h) => h.sold).filter(present)) : null
  if (!list && !sold) return null
  const unrated = perHome.filter((h) => h.rate == null)
  return {
    key,
    label,
    homes: homes.length,
    list,
    sold,
    concessions: concessionBand(perHome.map((h) => h.concession)),
    ppsf: priceBand(perHome.map((h) => h.rate).filter(present)),
    noLivingArea: unrated.filter((h) => present(h.basis)).length,
    noRatePrice: unrated.filter((h) => !present(h.basis)).length,
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
    ...unsoldStatusRows(expired),
  ].filter((row): row is StatusPriceRow => row != null)
}

/** A canceled or withdrawn listing is not an expiration. No MLS word stays Expired. */
function unsoldStatusRows(entries: readonly MatrixEntry[]): StatusPriceRow[] {
  const groups = new Map<string, { label: string; homes: MatrixEntry[] }>()
  for (const entry of entries) {
    const label = mlsStatusLabel(entry.mlsStatus) ?? 'Expired'
    const key = label.toLowerCase()
    const group = groups.get(key) ?? { label, homes: [] }
    group.homes.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => statusRow(unsoldStatusKey(group.label), group.label, group.homes))
    .filter((row): row is StatusPriceRow => row != null)
}

function unsoldStatusKey(label: string): StatusPriceKey {
  const key = label.toLowerCase()
  if (key === 'canceled' || key === 'withdrawn' || key === 'expired') return key
  return 'expired'
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
    if (row.concessions) note(row, 'Concessions', row.concessions, 'no concession recorded')
    const why =
      row.noRatePrice === 0
        ? 'no living area on record'
        : row.noLivingArea === 0
          ? `no ${row.key === 'closed' ? 'sold' : 'list'} price on record`
          : 'no living area or price on record'
    note(row, '$/sqft', row.ppsf, why)
  }
  return notes
}

export function statusPriceBoardHtml(rows: readonly StatusPriceRow[]): string {
  if (rows.length === 0) return ''
  // A letter with no closed row prints no Sold column: a column of blanks
  // reads as missing data.
  const showSold = rows.some((row) => row.sold)
  const figureCells = (row: StatusPriceRow, stat: (typeof STATS)[number][0]) =>
    [row.list, ...(showSold ? [row.sold] : []), row.concessions, row.ppsf]
      .map((band) => `<td class="n">${figure(band, stat)}</td>`)
      .join('')
  const columns = showSold ? 5 : 4
  const groups = rows
    .map(
      (row) => `<tbody data-status="${esc(row.key)}">
      <tr class="sp-group"><th scope="rowgroup" colspan="${columns}">${esc(row.label)}<span class="sp-count">${esc(homesLabel(row.homes))}</span></th></tr>
      ${STATS.map(([stat, label]) => `<tr><th scope="row">${label}</th>${figureCells(row, stat)}</tr>`).join('\n      ')}
    </tbody>`,
    )
    .join('\n    ')
  const n = rows.reduce((a, r) => a + r.homes, 0)
  const notes = coverageNotes(rows)
  const read = [
    n === 1 ? 'The one home in this report, by status.' : `The ${countWord(n)} homes in this report, by status.`,
    showSold ? 'List is the asking price and Sold the closing price.' : 'List is the asking price.',
    'Concessions are seller-paid costs the MLS recorded. A blank means nothing was recorded, and zero means the sale reported none.',
    showSold
      ? "$/sqft is each home's own price over its own living area. Once closed, that price is the sold price after a recorded concession, or the sold price when none was recorded. Before a sale it is the list price."
      : "$/sqft is each home's list price over its own living area.",
  ].join(' ')
  return `<div class="status-price" data-status-price="board" data-homes="${n}">
  <h3 class="subhead">${esc(rows.map((r) => r.label).join(' · '))}</h3>
  <p class="chart-read">${esc(read)}</p>
  <table class="kv is-wide status-price-table">
    <colgroup><col class="sp-stat">${'<col class="sp-fig">'.repeat(columns - 1)}</colgroup>
    <thead><tr><th scope="col"></th><th class="n" scope="col">List</th>${showSold ? '<th class="n" scope="col">Sold</th>' : ''}<th class="n" scope="col">Concessions</th><th class="n" scope="col">$/sqft</th></tr></thead>
    ${groups}
  </table>${notes.length ? `\n  <p class="small status-price-note">${esc(notes.join(' '))}</p>` : ''}
</div>`
}

/** How many homes a rendered board counts, read off the board itself. */
export function statusPriceBoardHomes(boardHtml: string | null | undefined): number | null {
  const m = /data-status-price="board"[^>]*\bdata-homes="(\d+)"/.exec(boardHtml ?? '')
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * THE BOARD, ONE TAP AWAY (web chapter only, Matt 2026-10-07).
 *
 * The status table opened the sales chapter and pushed the sales that set the
 * price two phone screens down. On the web it moves under those sales and sits
 * behind a closed disclosure that names what it holds. Every figure is still
 * in the document, the board is the letter's own markup unchanged, and a
 * <details> opens without script. The print letter keeps it open and where it
 * was.
 */
export function statusPriceBoardDisclosureHtml(boardHtml: string | null | undefined): string {
  const html = (boardHtml ?? '').trim()
  if (!html) return ''
  const n = statusPriceBoardHomes(html)
  const label =
    n == null
      ? 'Every home in this report, by status'
      : n === 1
        ? 'The one home in this report, by status'
        : `All ${n} homes by status`
  return `<details class="status-price-more"><summary class="status-price-s">${esc(label)}</summary>
  ${html}
</details>`
}
