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
import {
  PRINT_NAVY_CREAM,
  renderPrintChartSvg,
  renderPrintLollipopRowsSvg,
  renderPrintOutcomeStripSvg,
} from '@/lib/charts/print-svg'

const points = [
  { value: 50, tick: 'Jan', label: '50' },
  { value: 40, tick: 'Feb', label: '40' },
  { value: 10, tick: 'Apr', label: '10' },
  { value: 12, tick: 'May', label: '12' },
]

function filledDots(svg: string): number {
  return [...svg.matchAll(/<circle[^>]*fill="#102742"/g)].length
}

function hollowDots(svg: string): number {
  return [...svg.matchAll(/<circle[^>]*fill="none"/g)].length
}

describe('print bar chart emphasis', () => {
  it('fills only the named marks, never the first month as well', () => {
    const plot = buildBarPlot([{ name: 'days', points }], { highlightTicks: ['Apr', 'May'] })!
    const svg = renderPrintChartSvg(plot, { caption: 'c', colors: PRINT_NAVY_CREAM })
    expect(filledDots(svg)).toBe(2)
    expect(hollowDots(svg)).toBe(2)
    expect(barsOf(plot)).toEqual(['Apr', 'May'])
  })

  it('fills every mark when none are named', () => {
    const plot = buildBarPlot([{ name: 'days', points }])!
    const svg = renderPrintChartSvg(plot, { caption: 'c', colors: PRINT_NAVY_CREAM })
    expect(filledDots(svg)).toBe(4)
    expect(hollowDots(svg)).toBe(0)
  })
})

function barsOf(plot: { bars: { tick: string; highlight: boolean }[] }): string[] {
  expect(plot.bars.find((b) => b.tick === 'Jan')!.highlight).toBe(false)
  return plot.bars.filter((b) => b.highlight).map((b) => b.tick).sort()
}

describe('print bar chart scale', () => {
  it('names the y range and the bar values, not only the month ticks', () => {
    const plot = buildBarPlot([{ name: 'days', points }], {
      highlightTicks: ['Apr', 'May'],
      baselineLabel: '0',
    })!
    const svg = renderPrintChartSvg(plot, {
      caption: 'Median days to pending by close month',
      colors: PRINT_NAVY_CREAM,
    })
    expect(svg).toContain('>0</text>')
    expect(svg).toContain('>50</text>')
    expect(svg).toContain('>10</text>')
    expect(svg).toContain('Median days to pending by close month')
    expect(svg).toContain('<circle')
    expect(svg).not.toContain('rx="2"')
  })
})

describe('print lollipop rows', () => {
  it('names each sale and puts this list on the shared scale', () => {
    const svg = renderPrintLollipopRowsSvg({
      rows: [
        { tick: '1345 3rd', value: 372_000, label: '$372K', filled: false },
        { tick: '2465 7th', value: 399_000, label: '$399K', filled: false },
        { tick: 'This list', value: 401_000, label: '$401K', filled: true },
      ],
      caption: 'Adjusted comparable sales',
      colors: PRINT_NAVY_CREAM,
    })
    expect(svg).toContain('1345 3rd')
    expect(svg).toContain('This list')
    expect(svg).toContain('$401K')
    expect(svg).toContain('$372K')
    expect(svg.match(/<circle/g)?.length).toBe(3)
  })
})

describe('print outcome strip', () => {
  it('lists closed sales, this list, and failed asks as named rows', () => {
    const svg = renderPrintOutcomeStripSvg({
      sold: [380_000, 390_000, 400_000, 405_000],
      unsold: [430_000, 450_000, 460_000],
      list: 401_000,
      lastAsk: 460_000,
      xMinLabel: '$341K',
      xMaxLabel: '$460K',
      listLabel: 'This list',
      lastAskLabel: 'Last ask',
      caption: 'Sold and unsold in this band',
      colors: PRINT_NAVY_CREAM,
    })
    expect(svg).toContain('Sold')
    expect(svg).toContain('This list')
    expect(svg).toContain("Didn't sell")
    expect(svg).toContain('Last ask')
    expect(svg).toContain('$401K')
    expect(svg).toContain('$460K')
    expect(svg).not.toContain('$341K')
    expect(svg.match(/<circle/g)?.length).toBe(8)
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
    expect(svg).toContain('<circle')
  })
})
