/**
 * placeIndexRows — the ordering, the dedupe, and the §0 rule that an
 * unmeasured place prints no figure rather than a zero.
 */
import { describe, expect, it } from 'vitest'
import { placeIndexRows } from './V3PlaceIndex'

describe('placeIndexRows', () => {
  it('orders measured rows by count, biggest first', () => {
    const rows = placeIndexRows([
      { name: 'Small', href: '/subdivisions/small', count: 2 },
      { name: 'Big', href: '/subdivisions/big', count: 23 },
      { name: 'Middle', href: '/subdivisions/middle', count: 7 },
    ])
    expect(rows.map((r) => r.name)).toEqual(['Big', 'Middle', 'Small'])
  })

  it('puts unmeasured rows after every measured one, alphabetically', () => {
    const rows = placeIndexRows([
      { name: 'Zeta', href: '/subdivisions/zeta' },
      { name: 'Alpha', href: '/subdivisions/alpha', count: null },
      { name: 'Counted', href: '/subdivisions/counted', count: 0 },
    ])
    expect(rows.map((r) => r.name)).toEqual(['Counted', 'Alpha', 'Zeta'])
  })

  it('keeps a counted zero as a zero and an absent count as null (§0)', () => {
    const rows = placeIndexRows([
      { name: 'Counted none', href: '/subdivisions/a', count: 0 },
      { name: 'Never counted', href: '/subdivisions/b' },
    ])
    expect(rows.find((r) => r.name === 'Counted none')?.count).toBe(0)
    expect(rows.find((r) => r.name === 'Never counted')?.count).toBeNull()
  })

  it('shares are the square root of the row count over the largest count in the set', () => {
    // sqrt, not linear (taste pass, SITE-30): a right-skewed set (one huge
    // count, many small ones) flattens every small bar to nothing under a
    // linear share. sqrt keeps 1 at the top and null for the unmeasured, but
    // pulls the small end apart so two small counts stay visually distinct.
    const rows = placeIndexRows([
      { name: 'Big', href: '/subdivisions/big', count: 20 },
      { name: 'Half', href: '/subdivisions/half', count: 10 },
      { name: 'None', href: '/subdivisions/none' },
    ])
    expect(rows.find((r) => r.name === 'Big')?.share).toBe(1)
    expect(rows.find((r) => r.name === 'Half')?.share).toBeCloseTo(Math.SQRT1_2, 10)
    expect(rows.find((r) => r.name === 'None')?.share).toBeNull()
  })

  it('a small count still gets a visually distinct share from another small count', () => {
    // The evaluator's own finding: 18 of 22 real rows rendered as 15-46px
    // stubs under the old linear share against one outlier. Two small counts
    // 5x apart should land at meaningfully different widths, not both near 0.
    const rows = placeIndexRows([
      { name: 'Outlier', href: '/subdivisions/outlier', count: 3241 },
      { name: 'Small', href: '/subdivisions/small', count: 50 },
      { name: 'Smaller', href: '/subdivisions/smaller', count: 10 },
    ])
    const small = rows.find((r) => r.name === 'Small')?.share ?? 0
    const smaller = rows.find((r) => r.name === 'Smaller')?.share ?? 0
    expect(small).toBeGreaterThan(smaller)
    expect(small - smaller).toBeGreaterThan(0.03)
  })

  it('drops a row with no name or no destination rather than shipping a nameless anchor', () => {
    const rows = placeIndexRows([
      { name: '   ', href: '/subdivisions/nameless', count: 4 },
      { name: 'No door', href: '  ' },
      { name: 'Real', href: '/subdivisions/real', count: 1 },
    ])
    expect(rows.map((r) => r.name)).toEqual(['Real'])
  })

  it('dedupes on href so the map array and the indexable set can be unioned', () => {
    const rows = placeIndexRows([
      { name: 'Tetherow Phase 1', href: '/subdivisions/tetherow-phase-1', count: 23 },
      { name: 'Tetherow Phase 1', href: '/subdivisions/tetherow-phase-1', count: 99 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.count).toBe(23)
  })

  it('is empty for an empty set, which is what makes the section omit itself', () => {
    expect(placeIndexRows([])).toEqual([])
  })
})
