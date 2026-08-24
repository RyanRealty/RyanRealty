import { describe, expect, it } from 'vitest'
import { signersFromHeldForm } from './library-signers-from-name'

describe('signersFromHeldForm', () => {
  it('covers listing, buyer-rep, sale, and one-party advisories by name', () => {
    expect(signersFromHeldForm({ formNumber: '015', name: 'Listing Agreement Exclusive' })).toEqual([
      'seller',
      'seller_broker',
    ])
    expect(signersFromHeldForm({ formNumber: '050', name: 'Buyer Representation Agreement Exclusive' })).toEqual([
      'buyer',
      'buyer_broker',
    ])
    expect(signersFromHeldForm({ formNumber: '008', name: 'Vacant Land SA' })).toEqual(['buyer', 'seller'])
    expect(signersFromHeldForm({ formNumber: '043', name: 'Advisory Regarding Electronic Funds' })).toEqual([
      'single_party',
    ])
    expect(signersFromHeldForm({ formNumber: '000', name: 'Guide to Using OREF Residential Library Forms' })).toEqual([
      'not_applicable',
    ])
  })
})
