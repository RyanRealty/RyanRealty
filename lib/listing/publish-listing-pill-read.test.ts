import { describe, expect, it } from 'vitest'
import { publishListingPillRead } from './publish-listing-pill-read'

describe('publishListingPillRead', () => {
  it('reads both pills against the place record in one sentence with a trace', () => {
    const read = publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: 402, placeName: 'Bend', asOfLabel: 'Sep 9, 2026' })
    expect(read).not.toBeNull()
    expect(read!.sentence).toBe(
      'Listed 112 days; a typical Bend home goes under contract in 23 days; $446 a square foot, about 11% above the Bend median of $402.',
    )
    expect(read!.source).toContain('trailing 90 days')
    expect(read!.source).toContain('trailing 12 months')
    expect(read!.source).toContain('computed Sep 9, 2026')
  })

  it('states the facts neutrally (F29)', () => {
    expect(publishListingPillRead({ daysLive: 9, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      'Listed 9 days; a typical Bend home goes under contract in 23 days.',
    )
    expect(publishListingPillRead({ daysLive: 30, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      'Listed 30 days; a typical Bend home goes under contract in 23 days.',
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: 23, ppsf: 380, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      '$380 a square foot, about 5% below the Bend median of $402.',
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: null, ppsf: 402, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      '$402 a square foot, in line with the Bend median of $402.',
    )
  })

  it('withholds without a place, and drops a clause whose figure is missing', () => {
    expect(publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: 402, placeName: '' })).toBeNull()
    expect(publishListingPillRead({ daysLive: 112, daysToPending: null, ppsf: 446, medianPpsf: null, placeName: 'Bend' })).toBeNull()
    const one = publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: null, placeName: 'Bend' })
    expect(one!.sentence).not.toContain('square foot')
    expect(one!.source).not.toContain('12 months')
  })

  it('does not compare a condo or lot against detached-home medians', () => {
    expect(publishListingPillRead({ daysLive: 5, daysToPending: 23, ppsf: 400, medianPpsf: 402, placeName: 'Bend', detached: false })).toBeNull()
  })
})
