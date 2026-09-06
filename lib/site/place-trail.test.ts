import { describe, expect, it } from 'vitest'
import {
  cityPageTrail,
  communityHref,
  communityPageTrail,
  listingPlaceTrail,
  neighborhoodPageTrail,
  subdivisionPageTrail,
} from './place-trail'

function hrefs(trail: { href?: string }[]): string[] {
  return trail.map((c) => c.href).filter((h): h is string => Boolean(h))
}

describe('communityHref', () => {
  it('lands on the community page, not search', () => {
    expect(communityHref('tetherow')).toBe('/communities/tetherow')
    expect(communityHref('bend-tetherow')).toBe('/communities/tetherow')
    expect(communityHref(null)).toBeNull()
  })
})

describe('cityPageTrail', () => {
  it('is just the city name', () => {
    expect(cityPageTrail('Sunriver')).toEqual([{ label: 'Sunriver' }])
  })
})

describe('neighborhoodPageTrail', () => {
  it('is city landing then the neighborhood', () => {
    expect(
      neighborhoodPageTrail({ label: 'Bend', slug: 'bend' }, 'Awbrey Butte'),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Awbrey Butte' },
    ])
  })
})

describe('communityPageTrail', () => {
  it('is city landing then the community, with no index crumb', () => {
    expect(
      communityPageTrail({ label: 'Bend', slug: 'bend' }, 'Tetherow'),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Tetherow' },
    ])
  })
})

describe('subdivisionPageTrail', () => {
  it('is city landing, community when it has one, then the plat', () => {
    expect(
      subdivisionPageTrail(
        { label: 'Bend', slug: 'bend' },
        { label: 'Tetherow', slug: 'tetherow' },
        'Tetherow Phase 1',
      ),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Tetherow', href: '/communities/tetherow' },
      { label: 'Tetherow Phase 1' },
    ])
  })

  it('skips community when the plat has none', () => {
    expect(
      subdivisionPageTrail({ label: 'Bend', slug: 'bend' }, null, 'Bear Creek Estates'),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Bear Creek Estates' },
    ])
  })
})

describe('listingPlaceTrail', () => {
  it('is city → neighborhood → community → subdivision → address, address unlinked', () => {
    const trail = listingPlaceTrail({
      city: { label: 'Bend', slug: 'bend' },
      neighborhood: { label: 'Northwest Crossing', slug: 'northwest-crossing' },
      community: { label: 'Northwest Crossing', slug: 'northwest-crossing' },
      subdivision: { label: 'NWX Block 12', slug: 'nwx-block-12' },
      address: '123 NW Crossing Dr',
    })
    expect(trail).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Northwest Crossing', href: '/communities/northwest-crossing' },
      { label: 'NWX Block 12', href: '/subdivisions/nwx-block-12' },
      { label: '123 NW Crossing Dr' },
    ])
    expect(trail[trail.length - 1]?.href).toBeUndefined()
  })

  it('keeps a Bend district on its two-segment landing', () => {
    expect(
      listingPlaceTrail({
        city: { label: 'Bend', slug: 'bend' },
        neighborhood: { label: 'Awbrey Butte', slug: 'awbrey-butte' },
        community: null,
        subdivision: { label: 'Awbrey Glen Homesites Ph 1', slug: 'awbrey-glen-homesites-ph-1' },
        address: '10 Awbrey Glen',
      }),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Awbrey Butte', href: '/cities/bend/awbrey-butte' },
      { label: 'Awbrey Glen Homesites Ph 1', href: '/subdivisions/awbrey-glen-homesites-ph-1' },
      { label: '10 Awbrey Glen' },
    ])
  })


  it('sends an alias-only parent to the subdivision door, not a missing community page', () => {
    expect(
      listingPlaceTrail({
        city: { label: 'Bend', slug: 'bend' },
        neighborhood: null,
        community: { label: 'Stevens Ranch', slug: 'stevens-ranch' },
        subdivision: {
          label: 'Stevens Ranch Phase RS-1',
          slug: 'stevens-ranch-phase-rs-1-plld20211070',
        },
        address: '21812 SE Stromboli Court',
      }),
    ).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Stevens Ranch', href: '/subdivisions/stevens-ranch' },
      {
        label: 'Stevens Ranch Phase RS-1',
        href: '/subdivisions/stevens-ranch-phase-rs-1-plld20211070',
      },
      { label: '21812 SE Stromboli Court' },
    ])
  })

  it('never writes Home, Homes for sale, Cities, or a search door', () => {
    const trails = [
      cityPageTrail('Sunriver'),
      neighborhoodPageTrail({ label: 'Bend', slug: 'bend' }, 'Larkspur'),
      communityPageTrail({ label: 'Bend', slug: 'bend' }, 'Tetherow'),
      subdivisionPageTrail(
        { label: 'Bend', slug: 'bend' },
        { label: 'Tetherow', slug: 'tetherow' },
        'Valhalla',
      ),
      listingPlaceTrail({
        city: { label: 'Sunriver', slug: 'sunriver' },
        neighborhood: { label: 'Sunriver', slug: 'sunriver' },
        community: { label: 'Sunriver', slug: 'sunriver' },
        subdivision: { label: 'Meadow Village', slug: 'meadow-village' },
        address: '61475 Meeks Trail',
      }),
    ]
    for (const trail of trails) {
      expect(trail.map((c) => c.label)).not.toContain('Home')
      expect(trail.map((c) => c.label)).not.toContain('Homes for sale')
      expect(trail.map((c) => c.label)).not.toContain('Cities')
      expect(trail.map((c) => c.label)).not.toContain('Communities')
      for (const href of hrefs(trail)) {
        expect(href).not.toMatch(/homes-for-sale/)
        expect(href).not.toBe('/')
        expect(href).not.toBe('/cities')
        expect(href).not.toBe('/communities')
      }
    }
  })
})
