import { describe, expect, it } from 'vitest'
import { placeCityRealEstateHeading, placeHomesForSaleHeading } from './place-homes-heading'

describe('placeHomesForSaleHeading', () => {
  it('names the place first, Redfin-like', () => {
    expect(placeHomesForSaleHeading('Lazy River South')).toBe('Lazy River South homes for sale')
    expect(placeHomesForSaleHeading('Bend')).toBe('Bend homes for sale')
    expect(placeHomesForSaleHeading('Awbrey Butte')).toBe('Awbrey Butte homes for sale')
    expect(placeHomesForSaleHeading('97702')).toBe('97702 homes for sale')
  })

  it('does not double the head term', () => {
    expect(placeHomesForSaleHeading('Tetherow homes for sale')).toBe('Tetherow homes for sale')
  })

  it('falls back when the place is empty', () => {
    expect(placeHomesForSaleHeading('')).toBe('Homes for sale')
    expect(placeHomesForSaleHeading('   ')).toBe('Homes for sale')
  })
})

describe('placeCityRealEstateHeading', () => {
  it('bids real estate, not homes for sale', () => {
    expect(placeCityRealEstateHeading('Bend')).toBe('Bend real estate')
    expect(placeCityRealEstateHeading('Redmond')).toBe('Redmond real estate')
  })
})
