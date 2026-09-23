import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { assemblePlatFamilies, reservedPlaceSlugs } from './getPlatFamilies'

const tree = {
  plats: [
    { slug: 'ridge-at-eagle-crest-5', label: 'Ridge At Eagle Crest 5', treeCitySlug: 'redmond' },
    { slug: 'ridge-at-eagle-crest-36', label: 'Ridge At Eagle Crest 36', treeCitySlug: '' },
    { slug: 'shevlin-bluffs-phase-1', label: 'Shevlin Bluffs Phase 1', treeCitySlug: 'bend' },
    { slug: 'shevlin-bluffs-phase-2', label: 'Shevlin Bluffs, Phase 2', treeCitySlug: 'bend' },
    { slug: 'bend', label: 'Bend', treeCitySlug: 'bend' },
    { slug: 'bend-block-4-subdivision', label: 'Bend Block 4 Subdivision', treeCitySlug: 'bend' },
  ],
  citySlugs: ['bend', 'redmond'],
  neighborhoodSlugs: ['bend-century-west', 'tetherow'],
}

describe('reservedPlaceSlugs', () => {
  it('holds every city, neighborhood and community slug, and every middleware redirect', () => {
    const reserved = reservedPlaceSlugs(tree)
    for (const slug of ['bend', 'sisters', 'la-pine', 'redmond', 'bend-century-west', 'tetherow', 'eagle-crest', 'broken-top']) {
      expect(reserved.has(slug)).toBe(true)
    }
    // the-farm 308s to /subdivisions/farm-the in middleware.
    expect(reserved.has('the-farm')).toBe(true)
    // A real plat family name is not reserved.
    expect(reserved.has('ridge-at-eagle-crest')).toBe(false)
    expect(reserved.has('shevlin-bluffs')).toBe(false)
  })
})

describe('assemblePlatFamilies', () => {
  const families = assemblePlatFamilies({
    tree,
    counts: [
      { slug: 'ridge-at-eagle-crest-5', closedCount: 31, topCityLower: 'redmond' },
      // No tree city: the filed-sales city places it.
      { slug: 'ridge-at-eagle-crest-36', closedCount: 207, topCityLower: 'redmond' },
      { slug: 'shevlin-bluffs-phase-1', closedCount: 40, topCityLower: 'bend' },
      { slug: 'shevlin-bluffs-phase-2', closedCount: 12, topCityLower: 'bend' },
    ],
    mlsInventory: [{ cityLower: 'bend', subdivisionName: 'Shevlin Bluffs' }],
  })

  it('groups a phase with no boundary-tree city through the city its sales were filed under', () => {
    const ridge = families.find((f) => f.slug === 'ridge-at-eagle-crest')
    expect(ridge?.members.map((m) => m.slug)).toEqual(['ridge-at-eagle-crest-5', 'ridge-at-eagle-crest-36'])
    expect(ridge?.closedCountSum).toBe(238)
  })

  it('gives Shevlin Bluffs a family page now that its redirect to the browse pair is gone', () => {
    const shevlin = families.find((f) => f.slug === 'shevlin-bluffs')
    expect(shevlin).toMatchObject({ name: 'Shevlin Bluffs', nameSource: 'mls', mainHref: '/subdivisions/shevlin-bluffs' })
  })

  it('never makes a family page out of the plats the county labels Bend', () => {
    expect(families.some((f) => f.slug === 'bend')).toBe(false)
  })
})
