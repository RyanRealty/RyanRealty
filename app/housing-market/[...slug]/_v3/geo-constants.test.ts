import { describe, expect, it } from 'vitest'
import { resolveGeo } from './geo-constants'

describe('resolveGeo — city cache slug', () => {
  it('uses the space-form cache key for a multi-word city URL', () => {
    const geo = resolveGeo(['la-pine'])
    expect(geo.geoType).toBe('city')
    expect(geo.citySlug).toBe('la-pine')
    expect(geo.geoSlug).toBe('la pine')
    expect(geo.geoName).toBe('La Pine')
  })

  it('leaves a single-word city slug unchanged', () => {
    const geo = resolveGeo(['bend'])
    expect(geo.geoSlug).toBe('bend')
    expect(geo.citySlug).toBe('bend')
  })

  it('does not rewrite a community segment (resort / subdivision keys stay hyphenated)', () => {
    const geo = resolveGeo(['bend', 'northwest-crossing'])
    expect(geo.geoType).not.toBe('city')
    expect(geo.geoSlug).toBe('northwest-crossing')
  })
})
