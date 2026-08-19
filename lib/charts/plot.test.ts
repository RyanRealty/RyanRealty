import { describe, expect, it } from 'vitest'
import { buildBarPlot, buildLinePlot, buildMixPlot, buildRangePlot, linePath } from './plot'

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

  it('clamps line threshold bands to the data domain and drops outsiders', () => {
    const plot = buildLinePlot(
      [
        {
          name: 'Spread',
          points: [
            { value: 1.4, tick: '2024', label: '1.40pp' },
            { value: 2.9, tick: '2026', label: '2.90pp' },
          ],
        },
      ],
      {
        bands: [
          { from: 1.5, to: 2.0, label: 'Norm 1.5–2.0pp' },
          { from: 10, to: 12, label: 'outside the data — must drop' },
        ],
      },
    )
    expect(plot?.kind).toBe('line')
    if (plot?.kind !== 'line') return
    expect(plot.bands).toHaveLength(1)
    const band = plot.bands[0]!
    expect(band.label).toBe('Norm 1.5–2.0pp')
    expect(band.h).toBeGreaterThan(0)
    // Inside the frame's vertical padding.
    expect(band.y).toBeGreaterThan(0)
    expect(band.y + band.h).toBeLessThan(plot.vbH)
  })
})

describe('range plot (lollipop / dumbbell)', () => {
  it('anchors lollipop-only non-negative rows at zero so stem length is magnitude', () => {
    const plot = buildRangePlot([
      { tick: 'Sisters', value: 10, label: '10 days' },
      { tick: 'Bend', value: 18, label: '18 days' },
      { tick: 'Prineville', value: 60, label: '60 days' },
    ])
    expect(plot?.kind).toBe('range')
    if (plot?.kind !== 'range') return
    const bend = plot.rows.find((r) => r.tick === 'Bend')!
    const prine = plot.rows.find((r) => r.tick === 'Prineville')!
    // Zero floor: Bend at 18 of a 60*1.06 domain, and stems start at 0.
    expect(bend.stemStartPct).toBe(0)
    expect(bend.xPct).toBeCloseTo((18 / (60 * 1.06)) * 100, 6)
    expect(prine.xPct).toBeCloseTo((60 / (60 * 1.06)) * 100, 6)
    expect(bend.baseXPct).toBeNull()
  })

  it('spans dumbbell pairs from base to value over a padded extent', () => {
    const plot = buildRangePlot([
      { tick: 'Bend', value: 98.45, label: '98.5%', baseValue: 97.79, baseLabel: '97.8%' },
      { tick: 'Black Butte Ranch', value: 90.15, label: '90.2%', baseValue: 96.0, baseLabel: '96.0%' },
    ])
    expect(plot?.kind).toBe('range')
    if (plot?.kind !== 'range') return
    const bend = plot.rows.find((r) => r.tick === 'Bend')!
    expect(bend.baseXPct).not.toBeNull()
    // The stem covers exactly the base -> value span, whichever direction.
    expect(bend.stemStartPct).toBeCloseTo(Math.min(bend.xPct, bend.baseXPct!), 9)
    expect(bend.stemEndPct).toBeCloseTo(Math.max(bend.xPct, bend.baseXPct!), 9)
    // Padded extent, not zero-anchored: everything stays inside 0..100.
    for (const r of plot.rows) {
      expect(r.xPct).toBeGreaterThanOrEqual(0)
      expect(r.xPct).toBeLessThanOrEqual(100)
      expect(r.baseXPct!).toBeGreaterThanOrEqual(0)
      expect(r.baseXPct!).toBeLessThanOrEqual(100)
    }
    // xMin/xMax labels are the caller's own formatted extremes.
    expect(plot.xMinLabel).toBe('90.2%')
    expect(plot.xMaxLabel).toBe('98.5%')
  })

  it('maps x threshold bands in percent and clamps to the domain', () => {
    const plot = buildRangePlot(
      [
        { tick: 'Bend', value: 3.47, label: '3.5 mo' },
        { tick: 'La Pine', value: 11.15, label: '11.2 mo' },
      ],
      {
        bands: [
          { from: 0, to: 4, label: "Seller's" },
          { from: 4, to: 6, label: 'Balanced' },
          { from: 6, to: 99, label: "Buyer's" }, // open-ended: clamps to the domain top
        ],
      },
    )
    expect(plot?.kind).toBe('range')
    if (plot?.kind !== 'range') return
    expect(plot.bands).toHaveLength(3)
    const [sellers, balanced, buyers] = plot.bands
    expect(sellers!.xPct).toBe(0)
    expect(sellers!.xPct + sellers!.wPct).toBeCloseTo(balanced!.xPct, 9)
    expect(buyers!.xPct + buyers!.wPct).toBeCloseTo(100, 6)
  })

  it('drops rows without a finite value, returns null with none', () => {
    const plot = buildRangePlot([
      { tick: 'Metolius', value: Number.NaN, label: 'n/a' },
      { tick: 'Bend', value: 18, label: '18 days' },
    ])
    expect(plot?.rows.map((r) => r.tick)).toEqual(['Bend'])
    expect(buildRangePlot([{ tick: 'x', value: Number.NaN, label: 'n/a' }])).toBeNull()
  })

  it('clamps an outlier at clampMax with clamped: true instead of stretching the domain', () => {
    // The chart-room broken-bar case: Terrebonne 36 months on 6 actives must
    // not flatten Bend 3.5 into the left edge.
    const plot = buildRangePlot(
      [
        { tick: 'Bend', value: 3.47, label: '3.5 mo' },
        { tick: 'Terrebonne', value: 36, label: '36 mo' },
      ],
      { clampMax: 14 },
    )
    expect(plot?.kind).toBe('range')
    if (plot?.kind !== 'range') return
    const bend = plot.rows.find((r) => r.tick === 'Bend')!
    const terre = plot.rows.find((r) => r.tick === 'Terrebonne')!
    // Domain top is the CLAMPED max (14 * 1.06), not 36 * 1.06.
    expect(bend.xPct).toBeCloseTo((3.47 / (14 * 1.06)) * 100, 6)
    expect(terre.xPct).toBeCloseTo((14 / (14 * 1.06)) * 100, 6)
    expect(terre.clamped).toBe(true)
    expect(bend.clamped).toBe(false)
    // The label still states the true reading.
    expect(terre.label).toBe('36 mo')
  })

  it('places an in-domain reference rule in percent and drops one outside the domain', () => {
    const inDomain = buildRangePlot(
      [
        { tick: 'Bend', value: 6.6, label: '6.6%' },
        { tick: 'Black Butte Ranch', value: 16.7, label: '16.7%' },
      ],
      { refValue: 8.46, refLabel: 'Region 8.5%' },
    )
    expect(inDomain?.kind).toBe('range')
    if (inDomain?.kind !== 'range') return
    expect(inDomain.ref).not.toBeNull()
    expect(inDomain.ref!.label).toBe('Region 8.5%')
    expect(inDomain.ref!.xPct).toBeCloseTo((8.46 / (16.7 * 1.06)) * 100, 6)

    const outside = buildRangePlot([{ tick: 'Bend', value: 6.6, label: '6.6%' }], {
      refValue: 50,
      refLabel: 'Region 50%',
    })
    expect(outside?.kind).toBe('range')
    if (outside?.kind !== 'range') return
    expect(outside.ref).toBeNull()
  })
})
