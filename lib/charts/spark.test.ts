import { describe, expect, it } from 'vitest'
import { buildSparkPlot } from './plot'

/**
 * The Ledger's twelve-month run (SITE-52). What these hold is honesty, not
 * looks: a gap in the source breaks the line rather than reading as zero, a
 * run under the small-n floor is not drawn, and a flat run is not the floor.
 */
describe('buildSparkPlot', () => {
  it('draws one unbroken run through consecutive published points', () => {
    const plot = buildSparkPlot([1, 2, 3, 4], { w: 120, h: 24, pad: 2 })
    expect(plot).not.toBeNull()
    expect(plot!.d).toMatch(/^M2\.0 22\.0 L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L118\.0 2\.0$/)
    expect(plot!.n).toBe(4)
    expect(plot!.last).toEqual({ x: 118, y: 2 })
  })

  it('lifts the pen over a null month instead of drawing it as zero', () => {
    const plot = buildSparkPlot([2, 4, null, 4, 2], { w: 100, h: 20, pad: 0 })
    expect(plot).not.toBeNull()
    // Two M runs: 0..1 and 3..4. Nothing is placed at index 2.
    expect(plot!.d.match(/M/g)).toHaveLength(2)
    expect(plot!.d).not.toMatch(/ 50\.0 /)
    expect(plot!.n).toBe(4)
  })

  it('refuses a run with fewer published points than the caller\'s floor', () => {
    const twelve = [3, null, null, 5, null, null, 4, null, null, null, null, 6]
    expect(buildSparkPlot(twelve, { w: 120, h: 24, minPoints: 6 })).toBeNull()
    expect(buildSparkPlot(twelve, { w: 120, h: 24, minPoints: 4 })).not.toBeNull()
    expect(buildSparkPlot([1], { w: 120, h: 24 })).toBeNull()
    expect(buildSparkPlot([], { w: 120, h: 24 })).toBeNull()
  })

  it('sits a flat run on the middle line, not the floor', () => {
    const plot = buildSparkPlot([7, 7, 7], { w: 100, h: 20, pad: 0 })
    expect(plot!.d).toBe('M0.0 10.0 L50.0 10.0 L100.0 10.0')
  })

  it('keeps x on the full index axis so a trailing null still leaves the gap', () => {
    const plot = buildSparkPlot([1, 2, null], { w: 100, h: 20, pad: 0 })
    expect(plot!.last).toEqual({ x: 50, y: 0 })
  })
})
