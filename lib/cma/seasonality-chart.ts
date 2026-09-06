/**
 * When homes sell fastest: one unit, twelve months. A line.
 * Emphasize the short months. Do not grow stems from zero with a number
 * on every mark (dataviz skill).
 */
import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import type { CmaSeasonality } from '@/lib/cma/extras'

export function seasonalityChartSvg(x: CmaSeasonality): string {
  const months = [...x.byMonth].sort((a, b) => a.month - b.month)
  const priced = months.filter((m) => m.medianDaysToPending != null)
  if (priced.length < 6) return ''
  const fastest = new Set(x.fastestMonths.map((n) => n.slice(0, 3)))
  const plot = buildLinePlot(
    [
      {
        name: 'Days',
        points: months.map((m) => ({
          value: m.medianDaysToPending ?? Number.NaN,
          tick: m.monthName.slice(0, 3),
          label:
            m.medianDaysToPending != null ? String(Math.round(m.medianDaysToPending)) : '',
          at: m.month,
        })),
      },
    ],
  )
  if (!plot) return ''
  return renderPrintChartSvg(plot, {
    caption: 'Days from list to under contract',
    colors: PRINT_NAVY_CREAM,
    highlightTicks: [...fastest],
  })
}
