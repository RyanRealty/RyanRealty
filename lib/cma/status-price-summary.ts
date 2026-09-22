/**
 * Closed / Pending / Active price bands (Low · Avg · Median · High) from the
 * homes already on the letter. FlexMLS flow only — immersive craft stays ours.
 * No MoS. Subject column is never part of the rate.
 */

import { countWord, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { median } from '@/lib/cma/market-status'
import { listPriceForPpsf } from '@/lib/cma/status-ppsf'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'

const esc = escapeHtml

export type StatusPriceKey = 'closed' | 'pending' | 'active'

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
  homes: number
  band: PriceBand
  /** Sold $ for closed; list/ask for pending and active. */
  basis: 'sold' | 'list'
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

function closedRow(entries: readonly MatrixEntry[]): StatusPriceRow | null {
  const homes = entries.filter((e) => e.family === 'closed')
  const prices = homes
    .map((e) => e.closePrice)
    .filter((v): v is number => v != null && v > 0)
  const band = priceBand(prices)
  if (!band) return null
  return { key: 'closed', label: 'Closed', homes: band.n, band, basis: 'sold' }
}

function askingRow(
  key: StatusPriceKey,
  label: string,
  entries: readonly MatrixEntry[],
): StatusPriceRow | null {
  const prices = entries
    .map((e) => listPriceForPpsf(e))
    .filter((v): v is number => v != null && v > 0)
  const band = priceBand(prices)
  if (!band) return null
  return { key, label, homes: band.n, band, basis: 'list' }
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
 * One row per status the selected homes actually include.
 * Closed from comps; Pending/Active from band rivals already on the letter.
 */
export function statusPriceSummaries(input: {
  closed?: readonly MatrixEntry[] | null
  active?: readonly MatrixEntry[] | null
}): StatusPriceRow[] {
  const closed = (input.closed ?? []).filter((e) => e.family !== 'subject')
  const { active, pending } = splitActivePending(
    (input.active ?? []).filter((e) => e.family !== 'subject'),
  )
  return [
    closedRow(closed),
    askingRow('pending', 'Pending', pending),
    askingRow('active', 'Active', active),
  ].filter((row): row is StatusPriceRow => row != null)
}

function formatBandCell(n: number): string {
  return usd(n)
}

export function statusPriceBoardHtml(rows: readonly StatusPriceRow[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (row) => `<tr data-status="${esc(row.key)}" data-basis="${esc(row.basis)}">
      <th>${esc(row.label)}</th>
      <td class="n">${esc(String(row.homes))}</td>
      <td class="n">${esc(formatBandCell(row.band.low))}</td>
      <td class="n">${esc(formatBandCell(row.band.avg))}</td>
      <td class="n">${esc(formatBandCell(row.band.median))}</td>
      <td class="n">${esc(formatBandCell(row.band.high))}</td>
    </tr>`,
    )
    .join('')
  const n = rows.reduce((a, r) => a + r.homes, 0)
  return `<div class="status-price" data-status-price="board">
  <h3 class="subhead">Closed · Pending · Active</h3>
  <p class="chart-read">${esc(
    `Low · Avg · Median · High over the ${countWord(n)} homes in this report. Closed uses sold price; Pending and Active use list price.`,
  )}</p>
  <table class="kv is-wide status-price-table">
    <colgroup><col class="sp-status"><col class="sp-homes"><col class="sp-fig"><col class="sp-fig"><col class="sp-fig"><col class="sp-fig"></colgroup>
    <thead><tr><th>Status</th><th class="n">Homes</th><th class="n">Low</th><th class="n">Avg</th><th class="n">Median</th><th class="n">High</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
</div>`
}
