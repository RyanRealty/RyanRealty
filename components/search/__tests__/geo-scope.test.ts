import { describe, expect, it } from 'vitest'
import { GEO_SCOPE_KEYS, geoScopeLabel, stripGeoScope } from '@/components/search/geo-scope'

describe('stripGeoScope', () => {
  it('removes every geo key while preserving non-geo filters', () => {
    const filters = {
      city: 'Bend',
      subdivision: 'Awbrey Butte',
      postalCode: '97703',
      minPrice: 500_000,
      beds: 3,
      status: 'Active',
      sort: 'newest',
      hasPool: true,
      keywords: 'shop',
    }
    const stripped = stripGeoScope(filters)
    expect(stripped.city).toBeUndefined()
    expect(stripped.subdivision).toBeUndefined()
    expect(stripped.postalCode).toBeUndefined()
    expect(stripped.minPrice).toBe(500_000)
    expect(stripped.beds).toBe(3)
    expect(stripped.status).toBe('Active')
    expect(stripped.sort).toBe('newest')
    expect(stripped.hasPool).toBe(true)
    expect(stripped.keywords).toBe('shop')
  })

  it('does not mutate the input object', () => {
    const filters = { city: 'Bend', minPrice: 100 }
    stripGeoScope(filters)
    expect(filters.city).toBe('Bend')
  })

  it('GEO_SCOPE_KEYS covers exactly the keys stripGeoScope clears', () => {
    const filters = Object.fromEntries(GEO_SCOPE_KEYS.map((k) => [k, 'x']))
    const stripped = stripGeoScope(filters)
    for (const key of GEO_SCOPE_KEYS) expect(stripped[key]).toBeUndefined()
  })
})

describe('geoScopeLabel', () => {
  it('returns null when no geo scope is active', () => {
    expect(geoScopeLabel({})).toBeNull()
    expect(geoScopeLabel({ city: '', subdivision: '  ', postalCode: '' })).toBeNull()
  })

  it('labels a city-only scope', () => {
    expect(geoScopeLabel({ city: 'Bend' })).toBe('Bend')
  })

  it('joins subdivision, city, and zip with a middle dot', () => {
    expect(geoScopeLabel({ city: 'Bend', subdivision: 'Awbrey Butte', postalCode: '97703' })).toBe(
      'Awbrey Butte · Bend · 97703'
    )
  })

  it('drops MLS "no subdivision" sentinels from the label', () => {
    expect(geoScopeLabel({ city: 'Redmond', subdivision: 'N/A' })).toBe('Redmond')
    expect(geoScopeLabel({ subdivision: '***masked' })).toBeNull()
  })
})
