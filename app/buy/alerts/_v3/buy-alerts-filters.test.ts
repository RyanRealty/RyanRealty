import { describe, expect, it } from 'vitest'
import { V3_PRICE_STOPS } from '@/components/site/v3/V3Range.logic'
import { CENTRAL_OREGON_ID } from './buy-alerts-constants'
import { BUY_ALERT_PROPERTY_TYPE, buildBuyAlertFilters, parseOptionalBound } from './buy-alerts-filters'

describe('buildBuyAlertFilters', () => {
  it('Central Oregon alone is the wide match: property type A, no city', () => {
    expect(buildBuyAlertFilters({ towns: [CENTRAL_OREGON_ID] })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
    })
  })

  it('Central Oregon with Bend is still the wide match', () => {
    expect(buildBuyAlertFilters({ towns: ['Bend', CENTRAL_OREGON_ID] })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
    })
  })

  it('one town writes city', () => {
    expect(buildBuyAlertFilters({ towns: ['Bend'] })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
      city: 'Bend',
    })
  })

  it('two towns write cities', () => {
    expect(buildBuyAlertFilters({ towns: ['Bend', 'Redmond'] })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
      cities: ['Bend', 'Redmond'],
    })
  })

  it('inverted min/max are omitted', () => {
    expect(buildBuyAlertFilters({ towns: ['Bend'], minPrice: 800_000, maxPrice: 500_000 })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
      city: 'Bend',
    })
  })

  it('beds 3 writes beds', () => {
    expect(buildBuyAlertFilters({ towns: ['Bend'], beds: 3 })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
      city: 'Bend',
      beds: 3,
    })
  })

  it('min 500k and max at the last stop writes min only', () => {
    const last = V3_PRICE_STOPS[V3_PRICE_STOPS.length - 1]
    expect(buildBuyAlertFilters({ towns: ['Bend'], minPrice: 500_000, maxPrice: last })).toEqual({
      propertyType: BUY_ALERT_PROPERTY_TYPE,
      city: 'Bend',
      minPrice: 500_000,
    })
  })
})

describe('parseOptionalBound', () => {
  it('treats empty, zero, and junk as null', () => {
    expect(parseOptionalBound('')).toBeNull()
    expect(parseOptionalBound('0')).toBeNull()
    expect(parseOptionalBound('nope')).toBeNull()
    expect(parseOptionalBound('500000')).toBe(500_000)
  })
})
