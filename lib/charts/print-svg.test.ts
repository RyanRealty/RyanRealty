import { describe, expect, it } from 'vitest'
import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_LINE_PAD, PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'

describe('print chart labels', () => {
  it('prints a caption and a left Y-axis on a line chart', () => {
    const plot = buildLinePlot(
      [
        {
          name: 'Median sold',
          points: [
            { value: 400000, label: '$400,000', tick: 'Jan', at: 1 },
            { value: 450000, label: '$450,000', tick: 'Jun', at: 6 },
          ],
        },
      ],
      { pad: PRINT_LINE_PAD },
    )
    expect(plot).not.toBeNull()
    const html = renderPrintChartSvg(plot!, { caption: 'Median sold by month', colors: PRINT_NAVY_CREAM })
    expect(html).toContain('Median sold by month')
    expect(html).toContain('$450,000')
    expect(html).toContain('$400,000')
    expect(html).toContain('Jan')
    expect(html).toContain('Jun')
    expect(html).toContain('text-anchor="end"')
    expect(html).not.toContain('rr-chart-y')
    expect(html).toContain('Solid: Median sold')
  })
})
