import { describe, expect, it } from 'vitest'
import { publishListingPillRead } from './publish-listing-pill-read'

describe('publishListingPillRead', () => {
  it('reads both pills against the place record in one sentence with a trace', () => {
    const read = publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: 402, placeName: 'Bend', asOfLabel: 'Sep 9, 2026' })
    expect(read).not.toBeNull()
    expect(read!.sentence).toBe(
      '112 days listed is about 4.9 times the 23 a typical Bend home takes to go under contract; $446 a square foot is 10.9% over the Bend closed median of $402.',
    )
    expect(read!.source).toContain('trailing 90 days')
    expect(read!.source).toContain('trailing 12 months')
    expect(read!.source).toContain('computed Sep 9, 2026')
  })

  it('says inside, longer than, or about N times, and under or over', () => {
    expect(publishListingPillRead({ daysLive: 9, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      '9 days listed is inside the 23 a typical Bend home takes to go under contract.',
    )
    expect(publishListingPillRead({ daysLive: 30, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      '30 days listed is longer than the 23 a typical Bend home takes to go under contract.',
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: 23, ppsf: 380, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      '$380 a square foot is 5.5% under the Bend closed median of $402.',
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: null, ppsf: 402, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      '$402 a square foot matches the Bend closed median.',
    )
  })

  it('withholds without a place, and drops a clause whose figure is missing', () => {
    expect(publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: 402, placeName: '' })).toBeNull()
    expect(publishListingPillRead({ daysLive: 112, daysToPending: null, ppsf: 446, medianPpsf: null, placeName: 'Bend' })).toBeNull()
    const one = publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: null, placeName: 'Bend' })
    expect(one!.sentence).not.toContain('square foot')
    expect(one!.source).not.toContain('12 months')
  })
})
