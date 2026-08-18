/**
 * Client CMA charts. Same plot + labeled print SVG as every other document.
 * Market numbers arrive already computed from the cache. This file draws.
 */

import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_LINE_PAD, PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import { formatPriceExact } from '@/lib/format/money'

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

function monthKey(iso: string): number {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/** Median close over completed months. Needs six priced months. */
export function medianCloseLineSvg(points: TrendPoint[]): string {
  const priced = [...points]
    .filter((p) => p.medianSalePrice != null && p.medianSalePrice > 0)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (priced.length < 6) return ''
  const plot = buildLinePlot(
    [
      {
        name: 'Median sold',
        points: priced.map((p) => ({
          value: p.medianSalePrice as number,
          label: formatPriceExact(p.medianSalePrice),
          tick: monthLabel(p.periodStart),
          at: monthKey(p.periodStart),
        })),
      },
    ],
    { pad: PRINT_LINE_PAD },
  )
  if (!plot) return ''
  return renderPrintChartSvg(plot, { caption: 'Median sold by month', colors: PRINT_NAVY_CREAM })
}

/** New listings and median ask as two labeled charts. Dual-axis is banned. */
export function listingTrendSvg(points: ListingTrendPoint[]): string {
  const series = points.filter((p) => p.newListings > 0 || p.medianAsk != null)
  if (series.length < 4) return ''
  const listPlot = buildLinePlot(
    [
      {
        name: 'New listings',
        points: series.map((p) => ({
          value: p.newListings,
          label: String(p.newListings),
          tick: monthLabel(p.month),
          at: monthKey(p.month),
        })),
      },
    ],
    { pad: PRINT_LINE_PAD },
  )
  const asks = series.filter((p) => p.medianAsk != null && p.medianAsk > 0)
  const askPlot =
    asks.length >= 4
      ? buildLinePlot(
          [
            {
              name: 'Median ask',
              points: asks.map((p) => ({
                value: p.medianAsk as number,
                label: formatPriceExact(p.medianAsk),
                tick: monthLabel(p.month),
                at: monthKey(p.month),
              })),
            },
          ],
          { pad: PRINT_LINE_PAD },
        )
      : null
  const list = listPlot
    ? renderPrintChartSvg(listPlot, { caption: 'New listings by month', colors: PRINT_NAVY_CREAM })
    : ''
  const ask = askPlot
    ? renderPrintChartSvg(askPlot, { caption: 'Median ask by month', colors: PRINT_NAVY_CREAM })
    : ''
  return `${list}${ask}`
}
