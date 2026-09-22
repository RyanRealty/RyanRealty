import { describe, expect, it } from 'vitest'
import { childSelectionId, childSelectionMatches } from './map-hierarchy'
import { cityChildRailId, cityChildStockSlug } from './city-rail'

describe('city map rail ids', () => {
  it('pairs a Bend neighborhood door with its boundary slug', () => {
    const region = {
      id: 'neighborhood:awbrey-butte',
      kind: 'neighborhood',
      href: '/cities/bend/awbrey-butte',
    }
    expect(cityChildRailId(region)).toBe('awbrey-butte')
    expect(cityChildStockSlug(region, 'bend')).toBe('bend-awbrey-butte')
    expect(childSelectionId(region.id)).toBe('awbrey-butte')
    expect(childSelectionMatches(region.id, 'awbrey-butte')).toBe(true)
  })

  it('keeps a subdivision slug as both the rail id and the stock slug', () => {
    const region = {
      id: 'subdivision:eagle-crest',
      kind: 'subdivision',
      href: '/subdivisions/eagle-crest',
    }
    expect(cityChildRailId(region)).toBe('eagle-crest')
    expect(cityChildStockSlug(region, 'redmond')).toBe('eagle-crest')
    expect(childSelectionMatches(region.id, 'eagle-crest')).toBe(true)
  })
})
