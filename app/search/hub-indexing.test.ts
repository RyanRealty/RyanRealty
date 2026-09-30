import { describe, expect, it } from 'vitest'
import { isFilteredHubVariant, withoutTaggingParams } from './hub-indexing'

describe('hub-indexing (SITE-201)', () => {
  it('the bare hub, camera state and visit tagging are the hub itself', () => {
    expect(isFilteredHubVariant(undefined)).toBe(false)
    expect(isFilteredHubVariant({})).toBe(false)
    expect(isFilteredHubVariant({ view: 'list' })).toBe(false)
    expect(isFilteredHubVariant({ view: 'map', bbox: '-121.9,43.5,-120.8,44.7' })).toBe(false)
    expect(isFilteredHubVariant({ utm_source: 'gbp', utm_medium: 'organic', gclid: 'x', agent: 'matt' })).toBe(false)
    expect(isFilteredHubVariant({ page: '1' })).toBe(false)
    expect(isFilteredHubVariant({ city: '', keywords: '  ' })).toBe(false)
  })

  it('any place or filter key is a filtered search', () => {
    expect(isFilteredHubVariant({ city: 'Bend' })).toBe(true)
    expect(isFilteredHubVariant({ city: 'Bend', keywords: 'Caldera High' })).toBe(true)
    expect(isFilteredHubVariant({ subdivision: 'Brasada Ranch' })).toBe(true)
    expect(isFilteredHubVariant({ status: 'Sold' })).toBe(true)
    expect(isFilteredHubVariant({ priceMin: '500000', listingType: 'Land' })).toBe(true)
    expect(isFilteredHubVariant({ propertySubTypes: 'Townhouse' })).toBe(true)
    expect(isFilteredHubVariant({ page: '2' })).toBe(true)
    expect(isFilteredHubVariant({ city: ['Redmond', 'Bend'] })).toBe(true)
  })

  it('withoutTaggingParams keeps every search key and drops tagging', () => {
    expect(withoutTaggingParams({ city: 'Bend', utm_source: 'gbp', fbclid: 'y', view: 'list' })).toEqual({
      city: 'Bend',
      view: 'list',
    })
  })
})
