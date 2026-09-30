import { describe, expect, it } from 'vitest'
import {
  V3_SEASON_COLUMNS,
  cellAt,
  nearestInRow,
  seasonBandPlacement,
  seasonCapPct,
  seasonDrawable,
  seasonHeightPct,
  seasonStep,
  seasonTimeline,
} from './V3SeasonStrips.logic'

type Cell = { value: number }

/** A calendar year from a sparse map of month index to value. */
function year(values: Record<number, number>): { cells: (Cell | null)[] } {
  return {
    cells: Array.from({ length: V3_SEASON_COLUMNS }, (_, i) => (i in values ? { value: values[i]! } : null)),
  }
}

/** Newest first, the way the page reads: 2026 (Jan to Aug), 2025 (all), 2024 (Sep to Dec). */
const ROWS = [
  year({ 0: 2.4, 1: 2.8, 2: 3.6, 3: 4.4, 4: 4.8, 5: 4.5, 6: 4.2, 7: 4.0 }),
  year({ 0: 2.2, 1: 2.7, 2: 3.2, 3: 3.9, 4: 4.5, 5: 4.5, 6: 4.2, 7: 3.7, 8: 3.3, 9: 3.0, 10: 2.7, 11: 2.3 }),
  year({ 8: 3.0, 9: 2.8, 10: 2.6, 11: 2.1 }),
]

describe('seasonDrawable', () => {
  it('draws a run of calendar years inside the domain', () => {
    expect(seasonDrawable(ROWS, 6, [{ from: 4, to: 6 }])).toBe(true)
  })

  it('refuses a value outside the domain instead of standing it on the top of its row', () => {
    expect(seasonDrawable([year({ 0: 2, 1: 6.4 })], 6)).toBe(false)
    expect(seasonDrawable([year({ 0: 2, 1: -0.1 })], 6)).toBe(false)
    expect(seasonDrawable([year({ 0: 2, 1: Number.NaN })], 6)).toBe(false)
  })

  it('refuses a row that is not twelve months, an empty domain, a band outside it, and a run of one', () => {
    expect(seasonDrawable([{ cells: [{ value: 2 }, { value: 3 }] }], 6)).toBe(false)
    expect(seasonDrawable(ROWS, 0)).toBe(false)
    expect(seasonDrawable(ROWS, 6, [{ from: 4, to: 7 }])).toBe(false)
    expect(seasonDrawable([year({ 3: 2.5 })], 6)).toBe(false)
  })
})

describe('geometry', () => {
  it('stands every column on zero, as a share of the domain', () => {
    expect(seasonHeightPct(3, 6)).toBe(50)
    expect(seasonHeightPct(6, 6)).toBe(100)
  })

  it('inks only the part past the threshold, and nothing for a value on the line', () => {
    expect(seasonCapPct(4.8, 4)).toBeCloseTo(16.667, 3)
    expect(seasonCapPct(4.0, 4)).toBe(0)
    expect(seasonCapPct(3.7, 4)).toBe(0)
    expect(seasonCapPct(4.8, undefined)).toBe(0)
  })

  it('places a band from the baseline and marks one that closes at the top of the domain', () => {
    expect(seasonBandPlacement({ from: 4, to: 6 }, 6)).toEqual({ bottomPct: (4 / 6) * 100, heightPct: (2 / 6) * 100, closesAtTop: true })
    expect(seasonBandPlacement({ from: 4, to: 6 }, 9)?.closesAtTop).toBe(false)
    expect(seasonBandPlacement({ from: 6, to: 4 }, 9)).toBeNull()
  })
})

describe('time order and the keys', () => {
  const timeline = seasonTimeline(ROWS)

  it('runs from the oldest row to the newest, January to December inside each', () => {
    expect(timeline).toHaveLength(24)
    expect(timeline[0]).toEqual({ row: 2, column: 8 })
    expect(timeline[3]).toEqual({ row: 2, column: 11 })
    expect(timeline[4]).toEqual({ row: 1, column: 0 })
    expect(timeline.at(-1)).toEqual({ row: 0, column: 7 })
  })

  it('steps through time across a year boundary with left and right', () => {
    const jan2025 = { row: 1, column: 0 }
    expect(seasonStep(ROWS, timeline, jan2025, 'ArrowLeft', null)).toEqual({ row: 2, column: 11 })
    expect(seasonStep(ROWS, timeline, { row: 2, column: 11 }, 'ArrowRight', null)).toEqual(jan2025)
    // The ends hold.
    expect(seasonStep(ROWS, timeline, timeline.at(-1)!, 'ArrowRight', null)).toEqual(timeline.at(-1))
    expect(seasonStep(ROWS, timeline, timeline[0]!, 'ArrowLeft', null)).toEqual(timeline[0])
  })

  it('steps to the same month a year newer or older, and stays where that month has no reading', () => {
    const may2025 = { row: 1, column: 4 }
    expect(seasonStep(ROWS, timeline, may2025, 'ArrowUp', null)).toEqual({ row: 0, column: 4 })
    // May 2024 is not in the run: the reading stays on May 2025.
    expect(seasonStep(ROWS, timeline, may2025, 'ArrowDown', null)).toEqual(may2025)
    expect(seasonStep(ROWS, timeline, { row: 1, column: 9 }, 'ArrowDown', null)).toEqual({ row: 2, column: 9 })
  })

  it('reaches the ends, returns to the resting reading, and leaves other keys alone', () => {
    const rest = timeline.at(-1)!
    expect(seasonStep(ROWS, timeline, rest, 'Home', rest)).toEqual(timeline[0])
    expect(seasonStep(ROWS, timeline, timeline[0]!, 'End', rest)).toEqual(rest)
    expect(seasonStep(ROWS, timeline, timeline[0]!, 'Escape', rest)).toEqual(rest)
    expect(seasonStep(ROWS, timeline, rest, 'Tab', rest)).toBeUndefined()
    expect(seasonStep(ROWS, timeline, rest, 'Enter', rest)).toBeUndefined()
  })

  it('finds the nearest month with a reading when a pointer lands on a gap', () => {
    // Over December 2026, which has no reading yet: the nearest is August.
    expect(nearestInRow(ROWS, 0, 11)).toEqual({ row: 0, column: 7 })
    expect(nearestInRow(ROWS, 2, 0)).toEqual({ row: 2, column: 8 })
    expect(cellAt(ROWS, { row: 0, column: 4 })).toEqual({ value: 4.8 })
    expect(cellAt(ROWS, { row: 0, column: 11 })).toBeNull()
  })
})
