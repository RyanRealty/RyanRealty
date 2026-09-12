import { describe, expect, it } from 'vitest'
import { publishListingPillRead } from './publish-listing-pill-read'

describe('publishListingPillRead', () => {
  it('reads both pills against the place record in one sentence with a trace', () => {
    const read = publishListingPillRead({ daysLive: 112, daysToPending: 23, ppsf: 446, medianPpsf: 402, placeName: 'Bend', asOfLabel: 'Sep 9, 2026' })
    expect(read).not.toBeNull()
    expect(read!.sentence).toBe(
      "It's been listed 112 days. Typical Bend homes go under contract in 23. At $446 a square foot, it's 10.9% over Bend's closed median of $402.",
    )
    expect(read!.sentence).not.toMatch(/times the/)
    expect(read!.source).toContain('trailing 90 days')
    expect(read!.source).toContain('trailing 12 months')
    expect(read!.source).toContain('computed Sep 9, 2026')
  })

  it('states both numbers without a ratio, and under or over', () => {
    expect(publishListingPillRead({ daysLive: 9, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      "It's been listed 9 days. Typical Bend homes go under contract in 23.",
    )
    expect(publishListingPillRead({ daysLive: 30, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      "It's been listed 30 days. Typical Bend homes go under contract in 23.",
    )
    expect(publishListingPillRead({ daysLive: 1, daysToPending: 23, ppsf: null, medianPpsf: null, placeName: 'Bend' })!.sentence).toBe(
      "It's been listed 1 day. Typical Bend homes go under contract in 23.",
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: 23, ppsf: 380, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      "At $380 a square foot, it's 5.5% under Bend's closed median of $402.",
    )
    expect(publishListingPillRead({ daysLive: null, daysToPending: null, ppsf: 402, medianPpsf: 402, placeName: 'Bend' })!.sentence).toBe(
      "At $402 a square foot, it matches Bend's closed median.",
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
