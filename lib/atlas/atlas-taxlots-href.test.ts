import { describe, expect, it } from 'vitest'
import { atlasTaxlotsHref, parseAtlasTaxlotsScope } from './atlas-taxlots-href'

describe('atlas taxlots URL (Matt 2026-09-23: lots inside a selected district)', () => {
  it('round-trips a scoped boundary', () => {
    const scope = { geoType: 'neighborhood' as const, geoSlug: 'bend-awbrey-butte' }
    const href = atlasTaxlotsHref(scope)!
    expect(href.startsWith('/api/atlas/taxlots?')).toBe(true)
    expect(parseAtlasTaxlotsScope(new URL(href, 'https://x.test').searchParams)).toEqual(scope)
  })

  it('round-trips a boundary with no geo type', () => {
    const scope = { geoType: null, geoSlug: 'diamond-bar-ranch' }
    const href = atlasTaxlotsHref(scope)!
    expect(parseAtlasTaxlotsScope(new URL(href, 'https://x.test').searchParams)).toEqual(scope)
  })

  it('refuses an empty slug or an unknown geo type', () => {
    expect(atlasTaxlotsHref(null)).toBeNull()
    expect(atlasTaxlotsHref({ geoType: null, geoSlug: '' })).toBeNull()
    expect(atlasTaxlotsHref({ geoType: 'zip' as never, geoSlug: 'bend' })).toBeNull()
    expect(parseAtlasTaxlotsScope(new URLSearchParams('t=zip&s=bend'))).toBeNull()
    expect(parseAtlasTaxlotsScope(new URLSearchParams('t=city'))).toBeNull()
  })
})
