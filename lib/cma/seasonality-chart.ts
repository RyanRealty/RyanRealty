/**
 * Seasonality bars for CMA print and immersive. Same plot as every other
 * document chart: lib/charts/plot + print-svg navy/cream.
 */
import { buildBarPlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import type { CmaSeasonality } from '@/lib/cma/extras'

export function seasonalityChartSvg(x: CmaSeasonality): string {
  const fastest = new Set(x.fastestMonths.map((n) => n.slice(0, 3)))
  const plot = buildBarPlot(
    [
      {
        name: 'Median days to pending',
        points: x.byMonth.map((m) => ({
          value: m.medianDaysToPending ?? Number.NaN,
          tick: m.monthName.slice(0, 3),
          label:
            m.medianDaysToPending != null ? String(Math.round(m.medianDaysToPending)) : 'n/a',
        })),
      },
    ],
    { highlightTicks: [...fastest], baselineLabel: '0' },
  )
  if (!plot) return ''
  return renderPrintChartSvg(plot, {
    caption: 'Median days to pending by close month',
    colors: PRINT_NAVY_CREAM,
    kicker: 'Days to pending',
  })
}
