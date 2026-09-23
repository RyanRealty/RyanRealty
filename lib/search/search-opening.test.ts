import { describe, expect, it } from 'vitest'
import { BEND_DEFAULT_BOUNDS, CENTRAL_OREGON_BOUNDS, PRIMARY_CITY_PINS } from '@/lib/map-constants'
import { GEO_SCOPE_KEYS } from '@/components/search/geo-scope'
import {
  DEFAULT_SEARCH_VIEW,
  PLACE_PARAM_KEYS,
  REGIONAL_FRAME_LABEL,
  SPLIT_CARD_PAGE,
  isRegionalSearchFrame,
  phoneOpeningPane,
  resolveSearchCamera,
  resolveSearchView,
} from './search-opening'

describe('how /homes-for-sale opens (Matt 2026-09-23)', () => {
  it('the bare URL resolves to the split view', () => {
    expect(DEFAULT_SEARCH_VIEW).toBe('split')
    expect(resolveSearchView(undefined)).toEqual({ view: 'split', explicit: false })
    expect(resolveSearchView('')).toEqual({ view: 'split', explicit: false })
    expect(resolveSearchView('grid')).toEqual({ view: 'split', explicit: false })
  })

  it('an explicit ?view= is honored', () => {
    expect(resolveSearchView('list')).toEqual({ view: 'list', explicit: true })
    expect(resolveSearchView('map')).toEqual({ view: 'map', explicit: true })
    expect(resolveSearchView('split')).toEqual({ view: 'split', explicit: true })
  })

  it('phones open the bare URL on the list, and keep the map first when the URL asked for it', () => {
    expect(phoneOpeningPane(resolveSearchView(undefined))).toBe('list')
    expect(phoneOpeningPane(resolveSearchView('split'))).toBe('map')
    expect(phoneOpeningPane(resolveSearchView('map'))).toBe('map')
    expect(phoneOpeningPane(resolveSearchView('list'))).toBe('list')
  })

  it('seeds one card page into the served HTML', () => {
    expect(SPLIT_CARD_PAGE).toBe(48)
  })
})

describe('the regional frame', () => {
  const split = (params: Record<string, string | undefined>) =>
    isRegionalSearchFrame({ view: 'split', params })

  it('is the bare URL, and one narrowed only by non-place filters', () => {
    expect(split({})).toBe(true)
    expect(split({ minPrice: '500000', beds: '3', sort: 'price_asc' })).toBe(true)
    expect(split({ status: 'Active' })).toBe(true)
    expect(split({ status: '' })).toBe(true)
  })

  it('is not a place search: every geography param keeps its own camera and population', () => {
    for (const key of PLACE_PARAM_KEYS) {
      expect(split({ [key]: 'x' }), key).toBe(false)
    }
    expect(split({ city: '   ' })).toBe(true)
  })

  it('names every geo-scope key the split view knows about', () => {
    for (const key of GEO_SCOPE_KEYS) expect(PLACE_PARAM_KEYS as readonly string[]).toContain(key)
  })

  it('ends at a camera, a drawn area, or the Sold scope', () => {
    expect(split({ bbox: '-121.5,43.9,-121.1,44.3' })).toBe(false)
    expect(split({ bbox: 'junk' })).toBe(true)
    expect(split({ shapes: 'abc' })).toBe(false)
    expect(split({ poly: 'abc' })).toBe(false)
    expect(split({ status: 'Sold' })).toBe(false)
  })

  it('applies to the split view only', () => {
    expect(isRegionalSearchFrame({ view: 'list', params: {} })).toBe(false)
    expect(isRegionalSearchFrame({ view: 'map', params: {} })).toBe(false)
  })

  it('names the place the H1 names', () => {
    expect(REGIONAL_FRAME_LABEL).toBe('Central Oregon')
  })
})

describe('the opening camera', () => {
  it('is all of Central Oregon when the URL names no place and no camera', () => {
    const cam = resolveSearchCamera({ bboxParam: undefined, placeBoundaryBbox: null })
    expect(cam.source).toBe('central-oregon')
    expect(cam.bounds).toEqual({ ...CENTRAL_OREGON_BOUNDS })
  })

  it('keeps a place search on the place boundary, and a moved map on its own bbox', () => {
    const redmond = { west: -121.2347, south: 44.2186, east: -121.1335, north: 44.3109 }
    expect(resolveSearchCamera({ bboxParam: undefined, placeBoundaryBbox: redmond })).toEqual({
      bounds: redmond,
      source: 'place-boundary',
    })
    const moved = resolveSearchCamera({ bboxParam: '-121.4,44.0,-121.2,44.2', placeBoundaryBbox: redmond })
    expect(moved.source).toBe('url-bbox')
    expect(moved.bounds).toEqual({ west: -121.4, south: 44.0, east: -121.2, north: 44.2 })
  })

  it('never falls back to one city (the UXLIVE-4 cause)', () => {
    const cam = resolveSearchCamera({ bboxParam: 'not-a-bbox', placeBoundaryBbox: null })
    expect(cam.bounds).not.toEqual({ ...BEND_DEFAULT_BOUNDS })
  })

  it('frames every primary city the site pins, not only Bend', () => {
    const b = CENTRAL_OREGON_BOUNDS
    for (const city of PRIMARY_CITY_PINS) {
      expect(city.lat, city.name).toBeGreaterThan(b.south)
      expect(city.lat, city.name).toBeLessThan(b.north)
      expect(city.lng, city.name).toBeGreaterThan(b.west)
      expect(city.lng, city.name).toBeLessThan(b.east)
    }
  })

  it('is the recorded-boundary union (2026-09-23) padded by 0.10 degrees', () => {
    // Union of the 25 served-place polygons; see the derivation in map-constants.
    const union = { west: -121.6758, south: 43.6597, east: -120.8019, north: 44.6828 }
    expect(CENTRAL_OREGON_BOUNDS.west).toBeCloseTo(union.west - 0.1, 4)
    expect(CENTRAL_OREGON_BOUNDS.south).toBeCloseTo(union.south - 0.1, 4)
    expect(CENTRAL_OREGON_BOUNDS.east).toBeCloseTo(union.east + 0.1, 4)
    expect(CENTRAL_OREGON_BOUNDS.north).toBeCloseTo(union.north + 0.1, 4)
  })
})
