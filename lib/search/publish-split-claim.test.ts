import { describe, expect, it } from 'vitest'
import { publishSplitClaim, sortOrderPhrase } from './publish-split-claim'

const base = {
  sort: 'newest',
  frameLabel: null,
  mapMounted: true,
  low: 45_000,
  high: 4_200_000,
  askCount: 20,
  bandCount: 18,
}

describe('publishSplitClaim', () => {
  it('a whole frame in hand: drawn count, ask range, "on this map" (unchanged)', () => {
    const c = publishSplitClaim({ ...base, visibleCount: 23, rowsInHand: 23, totalCount: 23 })!
    expect(c.figure).toBe(23)
    expect(c.noun).toBe('homes')
    expect(c.where).toBe(' on this map')
    expect(c.truncated).toBe(false)
    expect(c.range).toEqual({ low: 45_000, high: 4_200_000 })
    expect(c.order).toBeNull()
    expect(c.note).toBeNull()
  })

  it('the Bend-camera fail: 491 rows of a larger frame never print as "491 homes on this map"', () => {
    const c = publishSplitClaim({ ...base, visibleCount: 491, rowsInHand: 500, totalCount: 1_298 })!
    expect(c.figure).toBe(1_298)
    expect(c.truncated).toBe(true)
    // A range over the first 500 is not the frame's range.
    expect(c.range).toBeNull()
    expect(c.order).toBe('newest first')
    expect(c.note).toBe('first 491 on the map')
    expect(c.source).toContain('1,298 listings match')
    expect(c.source).toContain('display cap, not the whole set')
  })

  it('the regional frame names Central Oregon and its exact count', () => {
    const c = publishSplitClaim({
      ...base,
      frameLabel: 'Central Oregon',
      visibleCount: 48,
      rowsInHand: 48,
      totalCount: 3_282,
      mapMounted: false,
    })!
    expect(`${c.figure} ${c.noun}${c.where}, ${c.order}`).toBe('3282 homes in Central Oregon, newest first')
    // Before the map mounts (a phone on the list) the held rows are listed, not pinned.
    expect(c.note).toBe('first 48 listed')
    expect(c.source).toContain('for Central Oregon, the service area this site covers')
    expect(c.source).toContain('are listed;')
  })

  it('names the order the held rows follow for every sort', () => {
    expect(sortOrderPhrase('price_asc')).toBe('lowest price first')
    expect(sortOrderPhrase('price_desc')).toBe('highest price first')
    expect(sortOrderPhrase('price_per_sqft_asc')).toBe('lowest price per sq ft first')
    expect(sortOrderPhrase('year_oldest')).toBe('oldest built first')
    expect(sortOrderPhrase('')).toBe('newest first')
    expect(sortOrderPhrase(undefined)).toBe('newest first')
    expect(sortOrderPhrase('bogus')).toBe('newest first')
  })

  it('singular agrees with the figure', () => {
    const c = publishSplitClaim({ ...base, visibleCount: 1, rowsInHand: 1, totalCount: 1, low: 500_000, high: 500_000 })!
    expect(c.noun).toBe('home')
    expect(c.source).toContain('1 listing matches')
  })

  it('prints nothing for an empty frame (the empty state speaks instead)', () => {
    expect(publishSplitClaim({ ...base, visibleCount: 0, rowsInHand: 0, totalCount: 0 })).toBeNull()
  })

  it('never uses an em dash in public copy', () => {
    const c = publishSplitClaim({ ...base, visibleCount: 500, rowsInHand: 500, totalCount: 3_282, frameLabel: 'Central Oregon' })!
    const c2 = publishSplitClaim({ ...base, visibleCount: 23, rowsInHand: 23, totalCount: 23 })!
    for (const text of [c.source, c.note ?? '', c.where, c.order ?? '', c2.source]) {
      expect(text).not.toMatch(/—/)
    }
  })
})
