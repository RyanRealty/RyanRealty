import { describe, expect, it } from 'vitest'
import {
  isOtherSideParty,
  isOtherSideRecipientRole,
  needsOtherSideReturn,
  ourRoleFromCycleKind,
  ourRoleFromCycles,
} from './representation'

describe('isOtherSideParty', () => {
  it('on a listing file the buyer is the other broker\'s client', () => {
    expect(isOtherSideParty('listing', 'buyer')).toBe(true)
    expect(isOtherSideParty('listing', 'seller')).toBe(false)
  })
  it('on a buyer file the seller is the other side', () => {
    expect(isOtherSideParty('buyer', 'seller')).toBe(true)
    expect(isOtherSideParty('buyer', 'buyer')).toBe(false)
  })
})

describe('ourRoleFromCycles', () => {
  it('Beaumont: listing + sale with our seller is listing-side', () => {
    expect(ourRoleFromCycles(['listing', 'sale'], ['seller'])).toBe('listing')
  })
})

describe('one-sided envelopes', () => {
  it('listing file does not e-sign the buyer; sale agreement still needs their PDF back', () => {
    expect(ourRoleFromCycleKind('listing')).toBe('listing')
    expect(isOtherSideRecipientRole('listing', 'Buyer')).toBe(true)
    expect(isOtherSideRecipientRole('listing', 'Seller')).toBe(false)
    expect(needsOtherSideReturn('listing', ['Buyer', 'Seller'])).toBe(true)
    expect(needsOtherSideReturn('listing', ['Seller', 'SellerAgent'])).toBe(false)
  })
})
