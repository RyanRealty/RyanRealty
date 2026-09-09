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

  it('shares are the row count over the largest count in the set', () => {
    const rows = placeIndexRows([
      { name: 'Big', href: '/subdivisions/big', count: 20 },
      { name: 'Half', href: '/subdivisions/half', count: 10 },
      { name: 'None', href: '/subdivisions/none' },
    ])
    expect(rows.find((r) => r.name === 'Big')?.share).toBe(1)
    expect(rows.find((r) => r.name === 'Half')?.share).toBe(0.5)
    expect(rows.find((r) => r.name === 'None')?.share).toBeNull()
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
