import { describe, expect, it } from 'vitest'
import {
  isZeroDollarText,
  listingPriceIsLeaseRate,
  publishMoneyText,
  publishPricePerSqft,
  publishSaleAskAmount,
} from './publish-listing-figure'

describe('listingPriceIsLeaseRate', () => {
  it('reads MLS PropertyType G as a lease rate', () => {
    // 4,310 rows carry PropertyTypeLabel "Commercial Lease"; 25 carry none;
    // no 'G' row is ever labelled anything else (listings, 2026-08-19).
    expect(listingPriceIsLeaseRate('G')).toBe(true)
    expect(listingPriceIsLeaseRate('g')).toBe(true)
    expect(listingPriceIsLeaseRate(' G ')).toBe(true)
  })

  it('leaves every sale property type alone', () => {
    for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'H']) {
      expect(listingPriceIsLeaseRate(code)).toBe(false)
    }
    expect(listingPriceIsLeaseRate(null)).toBe(false)
    expect(listingPriceIsLeaseRate('')).toBe(false)
  })
})

describe('publishMoneyText', () => {
  it('never publishes $0 for an amount that is not zero', () => {
    // 735 Purcell (MLS 220174840) published "Listed $0 / Price change $0 /
    // Back on market $0" from lease rates of $2.50-$2.75 thousand-rounded.
    expect(publishMoneyText(2.5)).toBeNull()
    expect(publishMoneyText(2.75)).toBeNull()
    expect(publishMoneyText(499)).toBeNull()
    expect(publishMoneyText(0.4, 'exact')).toBeNull()
    expect(publishMoneyText(0.4, 'compact')).toBeNull()
  })

  it('publishes the registers it can represent', () => {
    expect(publishMoneyText(895_000)).toBe('$895,000')
    expect(publishMoneyText(500)).toBe('$1,000')
    expect(publishMoneyText(771, 'exact')).toBe('$771')
    expect(publishMoneyText(2.5, 'exact')).toBe('$3')
    expect(publishMoneyText(260_000, 'compact')).toBe('$260k')
    expect(publishMoneyText(1_495_000, 'compact')).toBe('$1.5M')
  })

  it('withholds a missing or non-positive amount', () => {
    expect(publishMoneyText(null)).toBeNull()
    expect(publishMoneyText(undefined)).toBeNull()
    expect(publishMoneyText(0)).toBeNull()
    expect(publishMoneyText(-5)).toBeNull()
    expect(publishMoneyText(Number.NaN)).toBeNull()
  })
})

describe('isZeroDollarText', () => {
  it('catches every register that spells zero dollars', () => {
    expect(isZeroDollarText('$0')).toBe(true)
    expect(isZeroDollarText('$0k')).toBe(true)
    expect(isZeroDollarText('$0.0M')).toBe(true)
    expect(isZeroDollarText('$1,000')).toBe(false)
    expect(isZeroDollarText('$0.5M')).toBe(false)
  })
})

describe('publishPricePerSqft', () => {
  it('withholds a lease rate dressed as a sale figure', () => {
    expect(publishPricePerSqft({ propertyType: 'G', pricePerSqft: 3.26 })).toBeNull()
    expect(publishPricePerSqft({ propertyType: 'G', pricePerSqft: 500 })).toBeNull()
  })

  it('withholds a figure that would publish as $0', () => {
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 0.36 })).toBeNull()
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 0 })).toBeNull()
  })

  it('publishes a verified figure at whole-dollar precision, however low', () => {
    expect(publishPricePerSqft({ propertyType: 'A', pricePerSqft: 656.47 })).toBe(656)
    expect(publishPricePerSqft({ propertyType: 'B', pricePerSqft: 10.84 })).toBe(11)
    expect(publishPricePerSqft({ propertyType: 'F', pricePerSqft: 7.45 })).toBe(7)
  })
})

describe('publishSaleAskAmount', () => {
  it('withholds the ask on a lease listing', () => {
    // 735 Purcell published an H1 of "$3" from ListPrice 2.5.
    expect(publishSaleAskAmount({ price: 2.5, propertyType: 'G' })).toBeNull()
    expect(publishSaleAskAmount({ price: 4200, propertyType: 'G' })).toBeNull()
  })

  it('publishes the exact whole-dollar ask on a sale listing', () => {
    expect(publishSaleAskAmount({ price: 1_695_000, propertyType: 'A' })).toBe(1_695_000)
    expect(publishSaleAskAmount({ price: 6_500_000, propertyType: 'D' })).toBe(6_500_000)
    expect(publishSaleAskAmount({ price: 424_990, propertyType: 'A' })).toBe(424_990)
  })

  it('withholds a missing or non-positive price', () => {
    expect(publishSaleAskAmount({ price: null, propertyType: 'A' })).toBeNull()
    expect(publishSaleAskAmount({ price: 0, propertyType: 'A' })).toBeNull()
  })
})
