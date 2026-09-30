import { describe, expect, it } from 'vitest'
import { recommendationGapHold } from '@/lib/cma/gap-hold'

describe('recommendationGapHold', () => {
  it('holds a recommendation more than 15% under the last ask', () => {
    expect(recommendationGapHold(618_000, 849_000).hold).toBe(true)
    expect(recommendationGapHold(755_000, 999_900).hold).toBe(true)
    expect(recommendationGapHold(791_000, 1_098_000).hold).toBe(true)
  })

  it('holds any recommendation above the last ask', () => {
    const gap = recommendationGapHold(1_000_001, 1_000_000)
    expect(gap.hold).toBe(true)
  })

  it('does not hold exactly 15% under, or a recommendation inside the band', () => {
    expect(recommendationGapHold(850_000, 1_000_000).hold).toBe(false)
    expect(recommendationGapHold(1_000_000, 1_000_000).hold).toBe(false)
    expect(recommendationGapHold(900_000, 1_000_000).hold).toBe(false)
  })

  it('does not invent a hold when the ask or the recommendation is missing', () => {
    expect(recommendationGapHold(null, 849_000).hold).toBe(false)
    expect(recommendationGapHold(618_000, null).hold).toBe(false)
  })
})
