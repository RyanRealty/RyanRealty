/**
 * Client CMA charts. A real path through priced months, not a dead bar.
 * Count and dollars never share an axis.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'

export type TrendPoint = {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  endOfPeriodInventory?: number | null
}

export type ListingTrendPoint = {
  month: string
  newListings: number
  medianAsk: number | null
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`)
  return d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
}

function chartUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ')
}

function scaleY(vals: number[], top: number, bottom: number): (v: number) => number {
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, 1)
  return (v: number) => bottom - ((bottom - top) * (v - min)) / span
}

/** Median close over completed months. Needs six priced months. */
export function medianCloseLineSvg(points: TrendPoint[]): string {
  const priced = [...points]
    .filter((p) => p.medianSalePrice != null && p.medianSalePrice > 0)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (priced.length < 6) return ''
  const W = 720
  const H = 220
  const left = 8
  const right = W - 24
  const top = 18
  const bottom = 168
  const vals = priced.map((p) => p.medianSalePrice!)
  const y = scaleY(vals, top, bottom)
  const xs = priced.map((_, i) => left + ((right - left) * i) / Math.max(priced.length - 1, 1))
  const ys = vals.map(y)
  const path = linePath(xs, ys)
  const area = `${path} L${xs[xs.length - 1]!.toFixed(1)},${bottom} L${xs[0]!.toFixed(1)},${bottom} Z`
  const dots = xs
    .map(
      (x, i) =>
        `<circle cx="${x.toFixed(1)}" cy="${ys[i]!.toFixed(1)}" r="4" fill="#102742"/><text x="${x.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" font-size="11" fill="#102742" opacity="0.75">${monthLabel(priced[i]!.periodStart)}</text>`,
    )
    .join('')
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median close by month" class="trend-svg">
    <path d="${area}" fill="#102742" fill-opacity="0.08"/>
    <path d="${path}" fill="none" stroke="#102742" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${dots}
  </svg>
  <p class="small">Range $${Math.round(min).toLocaleString('en-US')} to $${Math.round(max).toLocaleString('en-US')}.</p>`
}

function ledgerTable(chunk: readonly ListingTrendPoint[]): string {
  const heads =
    `<th class="stub" scope="col"></th>` +
    chunk.map((p) => `<th scope="col">${escapeHtml(monthLabel(p.month))}</th>`).join('')
  const counts =
    `<th class="stub" scope="row">Listed</th>` +
    chunk
      .map((p) => {
        const empty = p.newListings <= 0
        return `<td><div class="n${empty ? ' is-zero' : ''}">${empty ? '—' : p.newListings}</div></td>`
      })
      .join('')
  const asks =
    `<th class="stub" scope="row">Ask</th>` +
    chunk
      .map((p) => {
        const ask =
          p.medianAsk != null && p.medianAsk > 0 && p.newListings > 0 ? chartUsd(p.medianAsk) : '—'
        return `<td><div class="a">${escapeHtml(ask)}</div></td>`
      })
      .join('')
  return `<table class="month-ledger" role="img" aria-label="New listings and asking prices">
    <thead><tr>${heads}</tr></thead>
    <tbody>
      <tr>${counts}</tr>
      <tr>${asks}</tr>
    </tbody>
  </table>`
}

/** Twelve months as a ledger: how many listed, and at what ask. No dual axis. */
export function listingTrendSvg(points: ListingTrendPoint[]): string {
  const series = [...points].sort((a, b) => a.month.localeCompare(b.month))
  if (series.length < 4) return ''
  if (!series.some((p) => p.newListings > 0 || (p.medianAsk != null && p.medianAsk > 0))) return ''

  const chunks: ListingTrendPoint[][] =
    series.length <= 7
      ? [series]
      : [series.slice(0, Math.ceil(series.length / 2)), series.slice(Math.ceil(series.length / 2))]

  return `<div class="month-ledger-wrap">${chunks.map(ledgerTable).join('')}</div>
  <p class="small">How many listed each month, and the median ask.</p>`
}
