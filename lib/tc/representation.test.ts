import { describe, expect, it } from 'vitest'
import {
  isOtherSideParty,
  isOtherSideRecipientRole,
  needsOtherSideReturn,
  otherPrincipalOnFile,
  ourRoleForEnvelope,
  ourRoleFromCycleKind,
  ourRoleFromCycles,
  ourRoleFromSignableRoles,
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

  it('listing packet with 020 completes when no buyer is on the file', () => {
    expect(
      otherPrincipalOnFile({
        ourRole: 'listing',
        peopleRoles: ['seller'],
        cycleBuyers: [],
        envelopeRoles: ['Seller', 'SellerAgent'],
      }),
    ).toBe(false)
    expect(
      needsOtherSideReturn('listing', ['Buyer', 'Seller', 'SellerAgent'], {
        otherPrincipalOnFile: false,
      }),
    ).toBe(false)
  })

  it('sale on a listing waits when a buyer is on the file', () => {
    expect(
      otherPrincipalOnFile({
        ourRole: 'listing',
        peopleRoles: ['seller', 'buyer'],
        envelopeRoles: ['Seller', 'SellerAgent'],
      }),
    ).toBe(true)
    expect(
      needsOtherSideReturn('listing', ['Buyer', 'Seller'], { otherPrincipalOnFile: true }),
    ).toBe(true)
  })
})

describe('dual representation', () => {
  it('a pending sale on a listing file with our seller and our buyer is dual', () => {
    expect(ourRoleForEnvelope({ cycleKind: 'sale', ourPeopleRoles: ['seller', 'buyer'] })).toBe('dual')
  })
  it('a pending sale with only our seller stays listing-side', () => {
    expect(ourRoleForEnvelope({ cycleKind: 'sale', ourPeopleRoles: ['seller'] })).toBe('listing')
  })

  it('both of our principals sign in Vault; no other-side PDF wait', () => {
    expect(ourRoleForEnvelope({ cycleKind: 'listing', ourPeopleRoles: ['buyer', 'seller'] })).toBe('dual')
    expect(isOtherSideRecipientRole('dual', 'Buyer')).toBe(false)
    expect(needsOtherSideReturn('dual', ['Buyer', 'Seller'])).toBe(false)
    expect(ourRoleFromSignableRoles('listing', ['Buyer', 'Seller'])).toBe('dual')
  })
})
