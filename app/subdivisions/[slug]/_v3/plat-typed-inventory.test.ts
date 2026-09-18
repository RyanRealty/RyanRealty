import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  platAtlasListingKeys,
  platFoldAtlasView,
  platFoldHasMixedTypes,
  platFoldListedCount,
} from './plat-typed-inventory'

const PAGE = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')

describe('platFoldHasMixedTypes', () => {
  it('is true when live marks include more than one type', () => {
    expect(
      platFoldHasMixedTypes([
        { k: 'a', t: 'house', s: 'active' },
        { k: 'b', t: 'land', s: 'active' },
        { k: 'c', t: 'condo', s: 'sold' },
      ]),
    ).toBe(true)
  })

  it('ignores sold-only extra types so an SFR plat stays house-locked', () => {
    expect(
      platFoldHasMixedTypes([
        { k: 'a', t: 'house', s: 'active' },
        { k: 'b', t: 'land', s: 'sold' },
      ]),
    ).toBe(false)
  })
})

describe('platFoldAtlasView', () => {
  const types = [
    { key: 'house', label: 'House' },
    { key: 'land', label: 'Land' },
    { key: 'condo', label: 'Condo' },
  ]

  it('keeps every live type on a mixed plat', () => {
    const dots = [
      { k: 'h', t: 'house', s: 'active' },
      { k: 'c', t: 'condo', s: 'active' },
      { k: 'l', t: 'land', s: 'pending' },
    ]
    const view = platFoldAtlasView({ dots, types })
    expect(view.dots).toHaveLength(3)
    expect(view.types.map((t) => t.key)).toEqual(['house', 'land', 'condo'])
    expect(platFoldListedCount(view.dots)).toBe(3)
    expect(platAtlasListingKeys(view.dots)).toEqual(['h', 'c', 'l'])
  })

  it('filters the fold to house marks when the plat is SFR-only', () => {
    const dots = [
      { k: 'h', t: 'house', s: 'active' },
      { k: 's', t: 'house', s: 'sold' },
    ]
    const view = platFoldAtlasView({ dots, types })
    expect(view.dots.every((d) => d.t === 'house')).toBe(true)
    expect(view.types).toEqual([{ key: 'house', label: 'House' }])
  })
})

describe('SITE-129 subdivision typed inventory wiring', () => {
  it('feeds atlas keys into stock tiles and unfilters mixed types', () => {
    expect(PAGE).toMatch(/platAtlasListingKeys/)
    expect(PAGE).toMatch(/platFoldAtlasView/)
    expect(PAGE).toMatch(/getPlaceOpeningListings/)
    expect(PAGE).toMatch(/placeStockSectionsFromTiles/)
    expect(PAGE).toMatch(/<V3PlaceInventory/)
    expect(PAGE).not.toMatch(/foldAtlasTypes = atlasView\.types\.filter\(\(t\) => t\.key === 'house'\)/)
  })
})
