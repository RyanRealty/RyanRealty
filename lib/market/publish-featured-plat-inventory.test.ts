import { describe, expect, it } from 'vitest'
import {
  featuredPlatCount,
  publishFeaturedPlats,
  type FeaturedPlatSeed,
} from './publish-featured-plat-inventory'

function plat(
  parentSlug: string,
  slug: string,
  name = slug,
): FeaturedPlatSeed {
  return {
    slug,
    name,
    parent: parentSlug,
    parentSlug,
    city: 'Bend',
    citySlug: 'bend',
  }
}

function counts(rows: Array<[FeaturedPlatSeed, number]>): Map<string, number> {
  return new Map(rows.map(([p, n]) => [`${p.citySlug}:${p.slug}`, n]))
}

describe('publishFeaturedPlats', () => {
  it('picks the sibling with inventory, not the empty first alias', () => {
    const empty = plat('tetherow', 'sunrise-village', 'Sunrise Village')
    const live = plat('tetherow', 'tetherow', 'Tetherow')
    const other = plat('broken-top', 'broken-top', 'Broken Top')
    const dead = plat('vandevert-ranch', 'vandevert-ranch', 'Vandevert Ranch')
    const picked = publishFeaturedPlats(
      [empty, live, other, dead],
      counts([
        [empty, 0],
        [live, 34],
        [other, 8],
        [dead, 0],
      ]),
      { inventoryOk: true, cap: 12 },
    )
    expect(picked.map((p) => p.slug)).toEqual(['tetherow', 'broken-top'])
  })

  it('does not pad the strip with zero-inventory plats', () => {
    const live = plat('tetherow', 'tetherow', 'Tetherow')
    const empty = plat('caldera-springs', 'caldera-springs', 'Caldera Springs')
    const picked = publishFeaturedPlats(
      [empty, live],
      counts([
        [live, 12],
        [empty, 0],
      ]),
      { inventoryOk: true, cap: 12 },
    )
    expect(picked).toHaveLength(1)
    expect(featuredPlatCount(picked[0]!, counts([[live, 12]]))).toBe(12)
  })

  it('fills leftover slots with other live plats from the same parent', () => {
    const village = plat('tetherow', 'tetherow', 'Tetherow')
    const phase = plat('tetherow', 'braeburn', 'Braeburn')
    const other = plat('broken-top', 'broken-top', 'Broken Top')
    const picked = publishFeaturedPlats(
      [phase, village, other],
      counts([
        [village, 34],
        [phase, 3],
        [other, 8],
      ]),
      { inventoryOk: true, cap: 12 },
    )
    expect(picked.map((p) => p.slug)).toEqual(['tetherow', 'broken-top', 'braeburn'])
  })

  it('falls back to one plat per parent when inventory is missing', () => {
    const first = plat('tetherow', 'sunrise-village', 'Sunrise Village')
    const second = plat('tetherow', 'tetherow', 'Tetherow')
    const other = plat('broken-top', 'broken-top', 'Broken Top')
    const picked = publishFeaturedPlats([first, second, other], new Map(), {
      inventoryOk: false,
      cap: 12,
    })
    expect(picked.map((p) => p.slug)).toEqual(['sunrise-village', 'broken-top'])
  })
})
