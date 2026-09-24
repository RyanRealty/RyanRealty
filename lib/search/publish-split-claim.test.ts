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
    expect(c.order).toBe('newest listed first')
    expect(c.note).toBe('first 491 on the map')
    expect(c.source).toContain('1,298 listings match')
    expect(c.source).toContain('display cap, not the whole set')
  })

  it('a count that did not come back in time is a floor: "501+", "at least", never a count', () => {
    // The Sold split view read 501 rows (the cap plus one) and stopped waiting
    // for its uncapped count at the answer deadline (getViewportListings).
    const c = publishSplitClaim({
      ...base,
      sold: true,
      visibleCount: 500,
      rowsInHand: 500,
      totalCount: 501,
      countIsFloor: true,
    })!
    expect(c.figure).toBe(501)
    expect(c.figureIsFloor).toBe(true)
    expect(c.noun).toBe('homes')
    expect(c.order).toBe('most recently sold first')
    expect(c.source).toContain('at least 501 listings match; the full count was not read.')
    expect(c.source).not.toMatch(/: 501 listings match/)
    // The exact count, when it came back, is printed as a count.
    const exact = publishSplitClaim({ ...base, visibleCount: 500, rowsInHand: 500, totalCount: 177_269 })!
    expect(exact.figureIsFloor).toBe(false)
    expect(exact.source).toContain('177,269 listings match.')
  })

  it('a floor as large as the rows in hand is still a floor, never a count or a range', () => {
    // A shape drawn over a capped Sold read: 120 of the 500 rows read fall in
    // the shape, and more of the shape lies past the rows the read returned.
    const c = publishSplitClaim({
      ...base,
      sold: true,
      visibleCount: 120,
      rowsInHand: 120,
      totalCount: 120,
      countIsFloor: true,
    })!
    expect(c.figure).toBe(120)
    expect(c.figureIsFloor).toBe(true)
    expect(c.truncated).toBe(true)
    // An ask range over part of the set is not the set's range.
    expect(c.range).toBeNull()
    expect(c.order).toBe('most recently sold first')
    expect(c.source).toContain('at least 120 listings match')
    // One home in hand of a floor is still "1+ homes", not "1 home".
    const one = publishSplitClaim({ ...base, visibleCount: 1, rowsInHand: 1, totalCount: 1, countIsFloor: true })!
    expect(one.figureIsFloor).toBe(true)
    expect(one.noun).toBe('homes')
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
    expect(`${c.figure} ${c.noun}${c.where}, ${c.order}`).toBe('3282 homes in Central Oregon, newest listed first')
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
    // newest / oldest order by the on-market date (Matt 2026-09-23), and say so.
    expect(sortOrderPhrase('newest')).toBe('newest listed first')
    expect(sortOrderPhrase('oldest')).toBe('oldest listed first')
    expect(sortOrderPhrase('')).toBe('newest listed first')
    expect(sortOrderPhrase(undefined)).toBe('newest listed first')
    expect(sortOrderPhrase('bogus')).toBe('newest listed first')
    // Legacy spellings name the order the data path serves.
    expect(sortOrderPhrase('priceAsc')).toBe('lowest price first')
  })

  it('on the Sold scope the date sorts follow the close date, and the line says so', () => {
    expect(sortOrderPhrase('newest', { sold: true })).toBe('most recently sold first')
    expect(sortOrderPhrase(undefined, { sold: true })).toBe('most recently sold first')
    expect(sortOrderPhrase('oldest', { sold: true })).toBe('oldest sold first')
    expect(sortOrderPhrase('price_desc', { sold: true })).toBe('highest price first')
    const c = publishSplitClaim({ ...base, sold: true, visibleCount: 500, rowsInHand: 500, totalCount: 91_204 })!
    expect(`${c.figure} ${c.noun}${c.where}, ${c.order}`).toBe('91204 homes on this map, most recently sold first')
    expect(c.source).toContain('The first 500, most recently sold first, are listed and pinned')
    for (const text of [c.source, c.order ?? '']) expect(text).not.toMatch(/—/)
    // For sale is unchanged.
    expect(publishSplitClaim({ ...base, sold: false, visibleCount: 500, rowsInHand: 500, totalCount: 900 })!.order).toBe(
      'newest listed first',
    )
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
