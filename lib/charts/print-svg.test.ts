/**
 * Emphasis contract for print bar charts.
 *
 * The defect: `b.highlight || b.index === 0` forced the FIRST bar to full
 * opacity alongside the highlighted ones. On the CMA seasonality chart the
 * caption read "the shortest waits land in May and April" while January — the
 * slowest month, and index 0 — was drawn in exactly the same navy. On the comps
 * chart, comp 1 was emphasized as strongly as the recommended list price.
 * Caught by rendering a real CMA for 833 Maple, not by any fixture.
 */
import { describe, expect, it } from 'vitest'
import { buildBarPlot, buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'

const points = [
  { value: 50, tick: 'Jan', label: '50' },
  { value: 40, tick: 'Feb', label: '40' },
  { value: 10, tick: 'Apr', label: '10' },
  { value: 12, tick: 'May', label: '12' },
]

function opacities(svg: string): string[] {
  return [...svg.matchAll(/<rect[^>]*opacity="([\d.]+)"/g)].map((m) => m[1]!)
}

describe('print bar chart emphasis', () => {
  it('emphasizes only the named bars, never the first bar as well', () => {
    const plot = buildBarPlot([{ name: 'days', points }], { highlightTicks: ['Apr', 'May'] })!
    const svg = renderPrintChartSvg(plot, { caption: 'c', colors: PRINT_NAVY_CREAM })
    const solid = opacities(svg).filter((o) => o === '1')
    // Exactly two: April and May. January must not ride along on index 0.
    expect(solid).toHaveLength(2)
    const bars = plot.bars
    expect(bars.find((b) => b.tick === 'Jan')!.highlight).toBe(false)
    expect(bars.filter((b) => b.highlight).map((b) => b.tick).sort()).toEqual(['Apr', 'May'])
  })

  it('still emphasizes the first bar when no bars are named', () => {
    // Charts that declare no highlights keep the primary-series convention.
    const plot = buildBarPlot([{ name: 'days', points }])!
    const svg = renderPrintChartSvg(plot, { caption: 'c', colors: PRINT_NAVY_CREAM })
    expect(opacities(svg).filter((o) => o === '1')).toHaveLength(1)
  })
})

describe('print line chart', () => {
  it('names the y range and the years on the line, not only in aria', () => {
    const plot = buildLinePlot([
      {
        name: 'Median close',
        points: [
          { value: 239000, tick: '2016', label: '$239K', at: 2016 },
          { value: 333000, tick: '2020', label: '$333K', at: 2020 },
          { value: 492000, tick: '2024', label: '$492K', at: 2024 },
        ],
      },
    ])!
    const svg = renderPrintChartSvg(plot, { caption: 'Median close by year', colors: PRINT_NAVY_CREAM })
    expect(svg).toContain('$239K')
    expect(svg).toContain('$492K')
    expect(svg).toContain('2016')
    expect(svg).toContain('2024')
    expect(svg).toContain('Median close by year')
    expect(svg).toContain('<text')
  })
})
