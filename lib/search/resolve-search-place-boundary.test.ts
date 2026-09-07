import { describe, expect, it } from 'vitest'
import { resolveSearchPlaceBoundaryTarget } from './resolve-search-place-boundary'

describe('resolveSearchPlaceBoundaryTarget', () => {
  it('resolves Southern Crossing to the Bend district polygon slug', () => {
    const t = resolveSearchPlaceBoundaryTarget({
      city: 'Bend',
      neighborhood: 'Southern Crossing',
    })
    expect(t).toEqual({
      kind: 'neighborhood',
      geoType: 'neighborhood',
      geoSlug: 'bend-southern-crossing',
      label: 'Southern Crossing',
      placeQuery: 'Southern Crossing Bend Oregon',
    })
  })

  it('prefers neighborhood over city when both are set', () => {
    const t = resolveSearchPlaceBoundaryTarget({
      city: 'Bend,Redmond',
      neighborhood: 'River West',
    })
    expect(t?.geoSlug).toBe('bend-river-west')
    expect(t?.kind).toBe('neighborhood')
  })

  it('resolves a resort community via the registry (neighborhood geo_type storage)', () => {
    const t = resolveSearchPlaceBoundaryTarget({
      city: 'Bend',
      subdivision: 'Tetherow',
    })
    expect(t?.kind).toBe('community')
    expect(t?.geoType).toBe('neighborhood')
    expect(t?.geoSlug).toBe('tetherow')
    expect(t?.placeQuery).toMatch(/Tetherow/)
  })

  it('falls back to subdivision geo_type for a non-registry plat name', () => {
    const t = resolveSearchPlaceBoundaryTarget({
      city: 'Bend',
      subdivision: 'Some Plat Name',
    })
    expect(t).toEqual({
      kind: 'subdivision',
      geoType: 'subdivision',
      geoSlug: 'some-plat-name',
      label: 'Some Plat Name',
      placeQuery: 'Some Plat Name Bend Oregon',
    })
  })

  it('resolves a bare city', () => {
    const t = resolveSearchPlaceBoundaryTarget({ city: 'Redmond' })
    expect(t).toEqual({
      kind: 'city',
      geoType: 'city',
      geoSlug: 'redmond',
      label: 'Redmond',
      placeQuery: 'Redmond Oregon',
    })
  })

  it('returns null when no place is selected', () => {
    expect(resolveSearchPlaceBoundaryTarget({})).toBeNull()
  })

  it('uses the first CSV token as primary', () => {
    const t = resolveSearchPlaceBoundaryTarget({
      neighborhood: 'Southern Crossing,Awbrey Butte',
      city: 'Bend',
    })
    expect(t?.geoSlug).toBe('bend-southern-crossing')
  })
})
