import { describe, expect, it } from 'vitest'
import {
  hasBankOwnedOrShortSale,
  hasOwnerWillCarry,
  isLongDom,
  isRepeatCut,
  longDomThreshold,
  priceDropSignalFlags,
  sellerCreditPhrase,
} from './signals'

describe('price-drop signals', () => {
  it('counts two or more cuts as a repeat', () => {
    expect(isRepeatCut(2)).toBe(true)
    expect(isRepeatCut(1)).toBe(false)
    expect(isRepeatCut(null)).toBe(false)
  })

  it('marks long DOM only against a live city median', () => {
    expect(longDomThreshold(33)).toBe(66)
    expect(isLongDom(67, 33)).toBe(true)
    expect(isLongDom(66, 33)).toBe(false)
    expect(isLongDom(200, null)).toBe(false)
  })

  it('reads owner-will-carry and assumable from listing terms', () => {
    expect(hasOwnerWillCarry(['Cash', 'Owner Will Carry'])).toBe(true)
    expect(hasOwnerWillCarry(['Assumable'])).toBe(true)
    expect(hasOwnerWillCarry(['Conventional'])).toBe(false)
  })

  it('reads bank-owned and short sale from special conditions', () => {
    expect(hasBankOwnedOrShortSale(['Real Estate Owned'])).toBe(true)
    expect(hasBankOwnedOrShortSale(['Short Sale'])).toBe(true)
    expect(hasBankOwnedOrShortSale(['Standard'])).toBe(false)
  })

  it('returns the matched public phrase and never the remarks', () => {
    const remarks = 'Seller will give a $10,000 concession toward closing. Call Jane.'
    expect(sellerCreditPhrase(remarks)).toBe('concession')
    expect(sellerCreditPhrase(remarks)).not.toContain('Jane')
    expect(sellerCreditPhrase('Bring offers, motivated seller')).toBeNull()
  })

  it('keeps remarks and REO signals off unless those flags are on', () => {
    const flags = priceDropSignalFlags({
      cutCount: 3,
      dom: 80,
      medianDaysToOffer: 30,
      listingTerms: ['Owner Will Carry'],
      sellerCreditPhrase: 'concession',
      specialConditions: ['Short Sale'],
      remarksEnabled: false,
      reoEnabled: false,
    })
    expect(flags).toEqual({
      repeatCuts: true,
      longDom: true,
      ownerWillCarry: true,
      sellerCredit: false,
      bankOwned: false,
    })
  })
})
