/**
 * Client CMA charts. A real path through priced months, not a dead bar.
 * Count and dollars never share an axis.
 */

import { PRINT_NAVY_CREAM, renderPrintPairedSvg } from '@/lib/charts/print-svg'

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

/** New listings (count) over median ask (dollars). One calendar. Two scales. */
export function listingTrendSvg(points: ListingTrendPoint[]): string {
  const series = [...points].sort((a, b) => a.month.localeCompare(b.month))
  if (series.length < 4) return ''
  if (!series.some((p) => p.newListings > 0 || (p.medianAsk != null && p.medianAsk > 0))) return ''

  const counts = series.map((p) => p.newListings)
  const asks = series.map((p) => (p.medianAsk != null && p.medianAsk > 0 ? p.medianAsk : null))
  const finiteAsks = asks.filter((n): n is number => n != null)
  const maxCount = Math.max(...counts, 0)
  const minAsk = finiteAsks.length ? Math.min(...finiteAsks) : 0
  const maxAsk = finiteAsks.length ? Math.max(...finiteAsks) : 0

  return renderPrintPairedSvg({
    top: {
      kicker: 'New listings',
      values: counts,
      labels: counts.map((n) => (n > 0 ? String(n) : '')),
      yMinLabel: '0',
      yMaxLabel: String(maxCount),
      fromZero: true,
    },
    bottom: {
      kicker: 'Median ask',
      values: asks,
      labels: asks.map((n) => (n != null ? chartUsd(n) : '')),
      yMinLabel: finiteAsks.length ? chartUsd(minAsk) : '0',
      yMaxLabel: finiteAsks.length ? chartUsd(maxAsk) : '0',
      fromZero: false,
    },
    ticks: series.map((p) => monthLabel(p.month)),
    caption: 'New listings and asking prices',
    colors: PRINT_NAVY_CREAM,
  })
}
