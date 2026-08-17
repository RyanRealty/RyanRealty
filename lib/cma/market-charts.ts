/**
 * Client CMA charts. A real path through priced months, not a dead bar.
 */

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
  const right = W - 8
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

/** New listings and median ask over the last year. */
export function listingTrendSvg(points: ListingTrendPoint[]): string {
  const series = points.filter((p) => p.newListings > 0 || p.medianAsk != null)
  if (series.length < 4) return ''
  const W = 720
  const H = 240
  const left = 8
  const right = W - 8
  const top = 18
  const bottom = 178
  const counts = series.map((p) => p.newListings)
  const yCount = scaleY(counts, top, bottom)
  const xs = series.map((_, i) => left + ((right - left) * i) / Math.max(series.length - 1, 1))
  const countPath = linePath(xs, counts.map(yCount))
  const asks = series.map((p) => p.medianAsk).filter((n): n is number => n != null && n > 0)
  const askPath =
    asks.length >= 4
      ? (() => {
          const yAsk = scaleY(asks, top, bottom)
          const askXs: number[] = []
          const askYs: number[] = []
          series.forEach((p, i) => {
            if (p.medianAsk != null && p.medianAsk > 0) {
              askXs.push(xs[i]!)
              askYs.push(yAsk(p.medianAsk))
            }
          })
          return askXs.length >= 4
            ? `<path d="${linePath(askXs, askYs)}" fill="none" stroke="#102742" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>`
            : ''
        })()
      : ''
  const labels = xs
    .map(
      (x, i) =>
        `<text x="${x.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" font-size="11" fill="#102742" opacity="0.75">${monthLabel(series[i]!.month)}</text>`,
    )
    .join('')
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="New listings and median ask" class="trend-svg">
    <path d="${countPath}" fill="none" stroke="#102742" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${askPath}
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${labels}
  </svg>
  <p class="small">Solid line is new listings. Dashed line is median ask when a month has a priced list.</p>`
}
