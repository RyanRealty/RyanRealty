import { describe, expect, it } from 'vitest'
import { formSigningProfile, principalFirst } from './form-signing-profile'
import { signingGroupForRole } from './signing'

describe('formSigningProfile', () => {
  it('020: the seller answers pages 2 to 7 and signs page 7, the buyer acknowledges on page 8', () => {
    const p = formSigningProfile('020', 'Sellers Property Disclosure Statement - 020 OREF')
    expect(p).toEqual({
      signingPages: [7, 8],
      initialsPages: [2, 3, 4, 5, 6, 7, 8],
      completedBy: { role: 'seller', pages: [2, 3, 4, 5, 6, 7], below: 0.16 },
      answerEveryQuestion: true,
    })
  })

  it('020 for an exempt seller: page 1 only (the exclusion and its acknowledgment), no page initials', () => {
    const p = formSigningProfile('OREF 020', 'Sellers Property Disclosure Statement (Exempt Seller) - 020 OREF')
    expect(p).toEqual({ signingPages: [1], initialsPages: [], completedBy: { role: 'seller', pages: [1], below: 0.16 } })
  })

  it('has nothing to say about other forms', () => {
    expect(formSigningProfile('002', 'Addendum to Sale Agreement')).toBeNull()
    expect(formSigningProfile(null, null)).toBeNull()
  })
})

describe('who signs first', () => {
  it('sends a packet with the seller’s disclosure to the seller first; a buyer cannot acknowledge a blank form', () => {
    expect(principalFirst([{ formNumber: '002', name: 'Addendum to Sale Agreement' }, { formNumber: '020', name: 'Sellers Property Disclosure Statement - 020 OREF' }])).toBe('Seller')
    expect(signingGroupForRole('Seller', ['Buyer', 'Seller'], 'Seller')).toBe(1)
    expect(signingGroupForRole('Buyer', ['Buyer', 'Seller'], 'Seller')).toBe(2)
  })

  it('keeps buyers first otherwise (the SkySlope sequence for an offer)', () => {
    expect(principalFirst([{ formNumber: '001', name: 'Residential Real Estate Sale Agreement' }])).toBeUndefined()
    expect(signingGroupForRole('Buyer', ['Buyer', 'Seller'])).toBe(1)
    expect(signingGroupForRole('Seller', ['Buyer', 'Seller'])).toBe(2)
  })
})
