/**
 * URL over defaults (SITE-29): the merge a static place page applies after
 * mount. Pins the key set, the place lock, identity on no-op, and trimming.
 */
import { describe, expect, it } from 'vitest'
import {
  BASE_SEARCH_URL_KEYS,
  mergeUrlSearchFilters,
  urlSearchFilterKeys,
} from '../merge-url-search-filters'
import { GEO_SCOPE_KEYS } from '../geo-scope'
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'

const defaults = {
  city: 'Bend',
  subdivision: '',
  neighborhood: '',
  status: 'Active',
  sort: 'newest',
  view: 'map',
  propertyType: 'all',
  propertySubTypes: '',
  minPrice: '',
  maxPrice: '',
  beds: '',
  baths: '',
}

describe('urlSearchFilterKeys', () => {
  it('is the base keys plus every registry param, plus geo unless the place is locked', () => {
    const open = urlSearchFilterKeys()
    const locked = urlSearchFilterKeys({ lockPlace: true })
    for (const key of BASE_SEARCH_URL_KEYS) expect(open).toContain(key)
    for (const key of ALL_SEARCH_URL_PARAMS) expect(open).toContain(key)
    for (const key of GEO_SCOPE_KEYS) {
      expect(open).toContain(key)
      expect(locked).not.toContain(key)
    }
  })
})

describe('mergeUrlSearchFilters', () => {
  it('returns the same object when the query changes nothing', () => {
    expect(mergeUrlSearchFilters(defaults, new URLSearchParams(''))).toBe(defaults)
    expect(mergeUrlSearchFilters(defaults, new URLSearchParams('status=Active&sort=newest'))).toBe(defaults)
    expect(mergeUrlSearchFilters(defaults, null)).toBe(defaults)
    expect(mergeUrlSearchFilters(defaults, new URLSearchParams('page=2&bbox=1,2,3,4'))).toBe(defaults)
  })

  it('lays the query over the defaults, trimmed, and leaves the input alone', () => {
    const out = mergeUrlSearchFilters(
      defaults,
      new URLSearchParams('minPrice= 500000 &beds=3&propertyType=Residential&propertySubTypes=Condominium,Townhouse&status=Sold&hasPool=1'),
    )
    expect(out).not.toBe(defaults)
    expect(out.minPrice).toBe('500000')
    expect(out.beds).toBe('3')
    expect(out.propertyType).toBe('Residential')
    expect(out.propertySubTypes).toBe('Condominium,Townhouse')
    expect(out.status).toBe('Sold')
    expect((out as Record<string, string | undefined>).hasPool).toBe('1')
    expect(out.city).toBe('Bend')
    expect(defaults.minPrice).toBe('')
  })

  it('ignores empty values so a blank param cannot erase a default', () => {
    const out = mergeUrlSearchFilters(defaults, new URLSearchParams('status=&sort=%20'))
    expect(out).toBe(defaults)
  })

  it('locks geo keys on a place page and honors them elsewhere', () => {
    const query = new URLSearchParams('city=Redmond&neighborhood=Old%20Mill&beds=2')
    const locked = mergeUrlSearchFilters(defaults, query, { lockPlace: true })
    expect(locked.city).toBe('Bend')
    expect(locked.neighborhood).toBe('')
    expect(locked.beds).toBe('2')
    const open = mergeUrlSearchFilters(defaults, query)
    expect(open.city).toBe('Redmond')
    expect(open.neighborhood).toBe('Old Mill')
  })
})
