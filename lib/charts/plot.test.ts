import { describe, expect, it } from 'vitest'
import { buildBarPlot, buildLinePlot, buildMixPlot, linePath } from './plot'

describe('shared chart plot', () => {
  it('draws straight segments and lifts across a gap', () => {
    const plot = buildLinePlot([
      {
        name: 'Median',
        points: [
          { value: 420_000, tick: 'Jan', label: '$420K', at: 1 },
          { value: Number.NaN, tick: 'Feb', label: 'n/a', at: 2 },
          { value: 475_000, tick: 'Mar', label: '$475K', at: 3 },
        ],
      },
    ])
    expect(plot?.kind).toBe('line')
    const d = plot && plot.kind === 'line' ? plot.lines[0]?.d ?? '' : ''
    expect(d).toMatch(/^M/)
    expect(d).not.toMatch(/[CQST]/)
    expect((d.match(/M/g) ?? []).length).toBe(2)
  })

  it('mixes composition as one stacked bar, not a line through types', () => {
    const plot = buildMixPlot([
      {
        name: 'Closed units',
        points: [
          { value: 4850, tick: 'SFR', label: '4,850' },
          { value: 600, tick: 'Land', label: '600' },
        ],
      },
    ])
    expect(plot?.kind).toBe('mix')
    expect(plot && plot.kind === 'mix' ? plot.segments.length : 0).toBe(2)
  })

  it('bars start from a baseline and keep caller labels', () => {
    const plot = buildBarPlot(
      [
        {
          name: 'Share',
          points: [
            { value: 62.9, tick: 'Fireplace', label: '62.9%' },
            { value: 80, tick: 'Garage', label: '80.0%' },
          ],
        },
      ],
      { baselineLabel: '0%' },
    )
    expect(plot?.kind).toBe('bars')
    expect(plot && plot.kind === 'bars' ? plot.yMinLabel : '').toBe('0%')
    expect(plot && plot.kind === 'bars' ? plot.yMaxLabel : '').toBe('80.0%')
  })

  it('vertical bar ticks leave room for 3-letter month labels', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const plot = buildBarPlot([
      {
        name: 'Days',
        points: months.map((tick, i) => ({ value: 10 + i, tick, label: String(10 + i) })),
      },
    ])
    expect(plot?.kind).toBe('bars')
    if (plot?.kind !== 'bars') return
    const first = plot.ticks[0]
    const last = plot.ticks[plot.ticks.length - 1]
    expect(first?.tick).toBe('Jan')
    expect(last?.tick).toBe('Dec')
    expect(first!.x).toBeGreaterThanOrEqual(12)
    expect(last!.x).toBeLessThanOrEqual(plot.vbW - 12)
    expect(first!.y).toBeLessThanOrEqual(plot.vbH - 4)
  })

  it('linePath never emits a cubic', () => {
    const d = linePath([
      { x: 0, y: 10, plot: true, label: 'a', tick: '1' },
      { x: 10, y: 20, plot: true, label: 'b', tick: '2' },
    ])
    expect(d).toBe('M0.00,10.00 L10.00,20.00')
  })
})
