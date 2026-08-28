import { describe, expect, it } from 'vitest'
import {
  CITY_TYPE_OPTIONS,
  cityNewConstructionYear,
  citySearchHref,
  cityTypeParams,
  isCityTypeKey,
  mergeSearchHref,
} from './city-search'

describe('city type control', () => {
  it('is one control with buyer labels, not nine warehouse types', () => {
    expect(CITY_TYPE_OPTIONS.map((o) => o.key)).toEqual([
      'any',
      'homes',
      'townhome',
      'condo',
      'land',
      'new',
    ])
    expect(isCityTypeKey('farm')).toBe(false)
    expect(isCityTypeKey('condo')).toBe(true)
  })

  it('maps type to search params without inventing a listing', () => {
    expect(cityTypeParams('any')).toEqual({})
    expect(cityTypeParams('homes')).toEqual({})
    expect(cityTypeParams('townhome')).toEqual({ propertySubTypes: 'Townhouse' })
    expect(cityTypeParams('condo')).toEqual({ propertySubTypes: 'Condominium' })
    expect(cityTypeParams('land')).toEqual({ propertyType: 'Land' })
    expect(cityTypeParams('new', new Date('2026-08-28T12:00:00Z'))).toEqual({
      yearBuiltMin: String(cityNewConstructionYear(new Date('2026-08-28T12:00:00Z'))),
    })
  })
})

describe('citySearchHref', () => {
  it('empty query stays on this city browse', () => {
    expect(citySearchHref({ query: '  ', cityName: 'Redmond', type: 'any' })).toBe(
      '/homes-for-sale/redmond',
    )
    expect(citySearchHref({ query: '', cityName: 'Redmond', type: 'townhome' })).toBe(
      '/homes-for-sale/redmond?propertySubTypes=Townhouse',
    )
  })

  it('keeps a query that already names a city', () => {
    const href = citySearchHref({ query: 'Bend', cityName: 'Redmond', type: 'any' })
    expect(href.toLowerCase()).toMatch(/bend/)
  })

  it('scopes a bare address query to this city', () => {
    const href = citySearchHref({ query: 'Highland', cityName: 'Redmond', type: 'any' })
    expect(href.startsWith('/homes-for-sale/redmond')).toBe(true)
  })
})

describe('mergeSearchHref', () => {
  it('adds params onto a clean path', () => {
    expect(mergeSearchHref('/homes-for-sale/redmond', { propertyType: 'Land' })).toBe(
      '/homes-for-sale/redmond?propertyType=Land',
    )
  })
})
