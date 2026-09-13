import { describe, expect, it } from 'vitest'
import { reviewerInitials, uniqueReviewerInitials } from './reviewer-initials'

describe('reviewerInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(reviewerInitials('Matt Ryan')).toBe('MR')
    expect(reviewerInitials('Sarah Jane Lee')).toBe('SJ')
  })

  it('uses two letters from a single word', () => {
    expect(reviewerInitials('Vault')).toBe('VA')
    expect(reviewerInitials('A')).toBe('A')
  })

  it('never invents a face when the name is empty', () => {
    expect(reviewerInitials('')).toBe('?')
    expect(reviewerInitials('   ')).toBe('?')
  })
})

describe('uniqueReviewerInitials', () => {
  it('disambiguates a collision with the last letter of the surname', () => {
    const taken = new Set(['CM'])
    expect(uniqueReviewerInitials('Charise Millard', taken)).toBe('CD')
  })
})

