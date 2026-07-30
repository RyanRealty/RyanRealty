import { describe, expect, it } from 'vitest'
import {
  buildAlertCreatePayload,
  buildFilterApplyPayload,
  buildMapDrawPayload,
  buildSearchSavePayload,
  buildZeroResultsPayload,
  countActiveSearchParams,
  createSearchEventGuard,
} from './search-events'
import { decodeMapPolygon, encodeMapPolygon, type MapPolygonPoint } from '@/lib/map-polygon'

describe('countActiveSearchParams', () => {
  it('counts distinct non-empty filter params', () => {
    const params = new URLSearchParams('city=Bend&minPrice=500000&beds=3')
    expect(countActiveSearchParams(params)).toBe(3)
  })

  it('excludes presentation params (view, page, sort) and empty values', () => {
    const params = new URLSearchParams('view=split&page=2&sort=newest&city=Bend&maxPrice=')
    expect(countActiveSearchParams(params)).toBe(1)
  })

  it('counts poly as a filter', () => {
    const params = new URLSearchParams('poly=44.1,-121.3;44.2,-121.3;44.2,-121.2&view=split')
    expect(countActiveSearchParams(params)).toBe(1)
  })

  it('counts a repeated key once', () => {
    const params = new URLSearchParams('viewTypes=Mountains&viewTypes=River')
    expect(countActiveSearchParams(params)).toBe(1)
  })
})

describe('buildFilterApplyPayload', () => {
  it('records applied values and cleared filters as null', () => {
    const params = new URLSearchParams('city=Bend&beds=3&view=split')
    const payload = buildFilterApplyPayload({ beds: '3', minPrice: undefined }, params)
    expect(payload).toEqual({ changed: { beds: '3', minPrice: null }, active_count: 2 })
  })

  it('treats empty string as a clear', () => {
    const params = new URLSearchParams('city=Bend')
    const payload = buildFilterApplyPayload({ subdivision: '' }, params)
    expect(payload).toEqual({ changed: { subdivision: null }, active_count: 1 })
  })

  it('returns null for view/sort-only updates (not a filter apply)', () => {
    const params = new URLSearchParams('view=map&sort=price_asc')
    expect(buildFilterApplyPayload({ view: 'map' }, params)).toBeNull()
    expect(buildFilterApplyPayload({ sort: 'price_asc' }, params)).toBeNull()
    expect(buildFilterApplyPayload({}, params)).toBeNull()
  })

  it('keeps filter keys when mixed with presentation keys', () => {
    const params = new URLSearchParams('city=Redmond&view=split')
    const payload = buildFilterApplyPayload({ city: 'Redmond', view: 'split' }, params)
    expect(payload).toEqual({ changed: { city: 'Redmond' }, active_count: 1 })
  })
})

describe('buildMapDrawPayload', () => {
  it('carries the shape kind and point count', () => {
    expect(buildMapDrawPayload(7)).toEqual({ shape: 'polygon', points: 7 })
  })
})

describe('buildSearchSavePayload', () => {
  it('carries shape presence and filter count', () => {
    expect(buildSearchSavePayload(true, 4)).toEqual({ has_shape: true, filter_count: 4 })
    expect(buildSearchSavePayload(false, 0)).toEqual({ has_shape: false, filter_count: 0 })
  })
})

describe('buildAlertCreatePayload', () => {
  it('carries the cadence', () => {
    expect(buildAlertCreatePayload('daily')).toEqual({ frequency: 'daily' })
  })
})

describe('buildZeroResultsPayload', () => {
  it('captures the live query as a param map, accepting a raw search string', () => {
    expect(buildZeroResultsPayload('?city=Bend&minPrice=9000000&view=split')).toEqual({
      params: { city: 'Bend', minPrice: '9000000', view: 'split' },
    })
  })

  it('drops empty values and handles an empty query', () => {
    expect(buildZeroResultsPayload('?city=&view=split')).toEqual({ params: { view: 'split' } })
    expect(buildZeroResultsPayload('')).toEqual({ params: {} })
  })
})

describe('createSearchEventGuard', () => {
  it('refuses an identical fire inside the window, allows it after', () => {
    const guard = createSearchEventGuard(1500)
    const payload = { shape: 'polygon', points: 5 }
    expect(guard('search_map_draw', payload, 1000)).toBe(true)
    expect(guard('search_map_draw', payload, 1400)).toBe(false)
    expect(guard('search_map_draw', payload, 2600)).toBe(true)
  })

  it('allows a different payload or type immediately', () => {
    const guard = createSearchEventGuard(1500)
    expect(guard('search_map_draw', { shape: 'polygon', points: 5 }, 1000)).toBe(true)
    expect(guard('search_map_draw', { shape: 'polygon', points: 6 }, 1001)).toBe(true)
    expect(guard('search_save', { has_shape: false, filter_count: 1 }, 1002)).toBe(true)
  })
})

describe('?poly= round-trip (the exact helpers the split view + SEO route share)', () => {
  it('encode -> decode reproduces the drawn shape at 6-decimal precision', () => {
    const drawn: MapPolygonPoint[] = [
      { lat: 44.0581739, lng: -121.3153096 },
      { lat: 44.0721401, lng: -121.3010027 },
      { lat: 44.0489012, lng: -121.2897543 },
      { lat: 44.0402388, lng: -121.3120001 },
    ]
    const encoded = encodeMapPolygon(drawn)
    expect(encoded).toBeTruthy()
    const decoded = decodeMapPolygon(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded).toHaveLength(drawn.length)
    for (let i = 0; i < drawn.length; i++) {
      expect(decoded![i].lat).toBeCloseTo(drawn[i].lat, 6)
      expect(decoded![i].lng).toBeCloseTo(drawn[i].lng, 6)
    }
    // Re-encoding the decoded shape is stable — the URL cannot drift on repeat
    // draw/reload cycles.
    expect(encodeMapPolygon(decoded!)).toBe(encoded)
  })

  it('clearing the shape produces no param value (undefined) and decode of absence is null', () => {
    expect(encodeMapPolygon([])).toBeUndefined()
    expect(decodeMapPolygon(undefined)).toBeNull()
    expect(decodeMapPolygon('')).toBeNull()
  })
})
