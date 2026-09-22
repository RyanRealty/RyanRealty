import { describe, expect, it } from 'vitest'
import { newHomeRateParagraph } from '@/lib/cma/new-home-rate'

const murphy = {
  subjectYear: 2022,
  subjectSqft: 2468,
  asOfIso: '2026-09-22',
  rangeLow: 693000,
  rangeHigh: 735000,
  comps: [
    { address: '61166 Berkshire', yearBuilt: 2026, closePrice: 727850, sqft: 2607 },
    { address: '61145 Wagyu', yearBuilt: 2024, closePrice: 725000, sqft: 1976 },
    { address: '61178 Berkshire', yearBuilt: 2025, closePrice: 735000, sqft: 2492 },
    { address: '20457 Aberdeen', yearBuilt: 2022, closePrice: 735000, sqft: 2269 },
    { address: '20619 Boer', yearBuilt: 2025, closePrice: 725000, sqft: 2431 },
  ],
  rivals: [{ address: '20615 Boer', yearBuilt: 2026, listPrice: 699900, sqft: 2353 }],
}

describe('new homes at the same price', () => {
  it('names the newer rate, the same-year sale, and the new listing, and does not raise the range', () => {
    const text = newHomeRateParagraph(murphy)
    expect(text).toContain('Your home was built in 2022.')
    expect(text).toContain('built in 2025 or 2026')
    expect(text).toContain('$279, $295, and $298 a square foot')
    expect(text).toContain('20457 Aberdeen, built in 2022 like yours, closed at $324 a square foot.')
    expect(text).toContain('20615 Boer, built in 2026, is listed at $699,900, $297 a square foot.')
    expect(text).toContain('did not sell for more per square foot')
    expect(text).not.toContain('61145 Wagyu')
  })

  it('says nothing when the subject is itself new', () => {
    expect(newHomeRateParagraph({ ...murphy, subjectYear: 2026 })).toBeNull()
  })

  it('does not treat one same-year sale as a reason to move the range when newer homes closed higher', () => {
    const text = newHomeRateParagraph({
      ...murphy,
      comps: [
        { address: '1 New', yearBuilt: 2026, closePrice: 800000, sqft: 2500 },
        { address: '2 New', yearBuilt: 2025, closePrice: 780000, sqft: 2400 },
        { address: '3 Old', yearBuilt: 2022, closePrice: 600000, sqft: 2400 },
      ],
      rivals: [],
    })
    expect(text).toContain('not enough to move the range')
  })
})