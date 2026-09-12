import { describe, expect, it } from 'vitest'
import { publishPlatUnsold } from './publish-plat-unsold'
import type { PlatUnsoldOutcome } from '@/lib/data/subdivisions/getPlatUnsoldOutcomes'

function outcome(over: Partial<PlatUnsoldOutcome> = {}): PlatUnsoldOutcome {
  return {
    platSlug: 'tetherow-phase-1',
    platLabel: 'Tetherow Phase 1',
    unsoldCount: 19,
    unsoldInPolygon: 19,
    unsoldByName: 0,
    medianDaysListed: 124,
    daysSample: 19,
    cutCount: 8,
    medianCutPct: 7.0,
    windowStart: '2025-09-09',
    windowEnd: '2026-09-09',
    ...over,
  }
}

describe('publishPlatUnsold', () => {
  it('says how many did not sell, how long they ran, and how many cut first', () => {
    const read = publishPlatUnsold({ placeName: 'Tetherow Phase 1', outcome: outcome(), closedCount: 31 })
    expect(read.clean).toBe(false)
    expect(read.sentence).toContain('19 homes came off the market in Tetherow Phase 1 without selling')
    expect(read.sentence).toContain('The middle one ran 124 days')
    expect(read.sentence).toContain('8 of them cut the ask first, a median of 7.0%')
    expect(read.sentence).not.toContain('Over the same stretch')
    expect(read.figure).toEqual({ value: '19', label: 'homes did not sell' })
  })

  it('speaks when the plat was measured and nothing failed', () => {
    const read = publishPlatUnsold({
      placeName: 'Outcrop',
      outcome: outcome({ unsoldCount: 0, unsoldInPolygon: 0, unsoldByName: 0, medianDaysListed: null, daysSample: 0, cutCount: 0, medianCutPct: null }),
    })
    expect(read.measured).toBe(true)
    expect(read.clean).toBe(true)
    expect(read.figure).toBeNull()
    expect(read.sentence).toContain('Every home that came off the market in Outcrop')
    expect(read.sentence).toContain('sold')
  })

  it('NOT MEASURED IS NOT CLEAN — a null read claims nothing', () => {
    // The founding case: diamond-bar-ranch has no boundaries row, the first
    // shape of the view could not reach it, and the page published "every home
    // sold" while two listings had come off unsold inside the window.
    const read = publishPlatUnsold({ placeName: 'Diamond Bar Ranch', outcome: null, windowEnd: '2026-09-09' })
    expect(read.measured).toBe(false)
    expect(read.clean).toBe(false)
    expect(read.sentence).toBe('')
    expect(read.figure).toBeNull()
  })

  it('prints no median where the MV measured none — unknown is not zero', () => {
    const read = publishPlatUnsold({
      placeName: 'Petrosa',
      outcome: outcome({ medianDaysListed: null, daysSample: 0, cutCount: 0, medianCutPct: null }),
    })
    expect(read.sentence).not.toMatch(/\b0 days\b/)
    expect(read.sentence).toContain('Not one of them cut the ask first')
    expect(read.source).toContain('none of them cut the ask')
  })

  it('says one home in the singular, and never calls a single value a median', () => {
    const read = publishPlatUnsold({
      placeName: 'Awbrey Glen',
      outcome: outcome({ unsoldCount: 1, cutCount: 1, daysSample: 1, medianCutPct: 3.2 }),
    })
    expect(read.sentence).toContain('One home came off the market')
    expect(read.sentence).toContain('It ran 124 days')
    // A Golf Homes at Tetherow render printed "One home came off the market …
    // and every one cut the ask first, a median of 7.1%": plural grammar over
    // one row, and a "median" that is a single value. Both are wrong, and the
    // second is a §0 claim the publisher did not compute.
    expect(read.sentence).toContain('cut the ask 3.2% first')
    expect(read.sentence).not.toContain('every one')
    expect(read.sentence).not.toContain('median')
    expect(read.source).toContain('on the one listing that carries both dates')
    expect(read.source).toContain('the total price change on the one that cut')
    expect(read.figure?.label).toBe('home did not sell')
  })

  it('keeps the plural median wording when there is a population to take one over', () => {
    const read = publishPlatUnsold({
      placeName: 'Awbrey Glen',
      outcome: outcome({ unsoldCount: 6, cutCount: 6, daysSample: 5, medianCutPct: 3.2 }),
    })
    expect(read.sentence).toContain('6 homes came off the market')
    expect(read.sentence).toContain('The middle one ran 124 days')
    expect(read.sentence).toContain('every one cut the ask first, a median of 3.2%')
    expect(read.source).toContain('median over 5 of the 6 that carry both dates')
    expect(read.source).toContain('median over the 6 that cut')
  })

  it('says a single home never cut, without the plural', () => {
    const read = publishPlatUnsold({
      placeName: 'Awbrey Glen',
      outcome: outcome({ unsoldCount: 1, cutCount: 0, daysSample: 1, medianCutPct: null }),
    })
    expect(read.sentence).toContain('never cut the ask')
    expect(read.sentence).not.toContain('not one of them')
  })

  it('carries both attributions and the window in the trace, and never an address', () => {
    const read = publishPlatUnsold({
      placeName: 'Eagle Crest',
      outcome: outcome({ unsoldCount: 63, unsoldInPolygon: 6, unsoldByName: 57, daysSample: 63, cutCount: 43, medianCutPct: 6.4 }),
    })
    expect(read.source).toContain('point-in-polygon\n      (6)'.replace(/\s+/g, ' '))
    expect(read.source).toContain('by MLS subdivision name (57)')
    expect(read.source).toContain('2025-09-09')
    expect(read.source).toContain('2026-09-09')
    expect(read.source).not.toMatch(/\d+\s+(NW|SE|SW|NE)\s/)
  })

  it('makes no sold comparison — the two figures count different populations', () => {
    // Two errors in sequence: the plat's LIFETIME 981 sales beside 19 failures
    // from one year, then a twelve-month DETACHED closed count beside a failure
    // count that takes every property type. The section above this one is
    // "What sold in {name}"; the reader compares by looking.
    const read = publishPlatUnsold({ placeName: 'Tetherow Phase 1', outcome: outcome(), closedCount: 31 })
    expect(read.sentence).not.toContain('Over the same stretch')
    expect(read.sentence).not.toContain('981')
  })

  it('omits the closed comparison when the plat has no closed figure', () => {
    const read = publishPlatUnsold({ placeName: 'Petrosa', outcome: outcome(), closedCount: null })
    expect(read.sentence).not.toContain('Over the same stretch')
  })
})
