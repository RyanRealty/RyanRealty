import { describe, expect, it } from 'vitest'
import { listingHubLinkList, listingHubLinks } from './listing-hub-links'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'

describe('listingHubLinks', () => {
  it('pairs a Bend city inventory door with the Tetherow community door', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      subdivisionName: 'Tetherow',
      subdivisionSlug: 'tetherow',
    })
    const links = listingHubLinks({
      city: { slug: 'bend', label: 'Bend' },
      community: ctx.curatedCommunity,
    })
    expect(links).toEqual({
      city: { href: '/homes-for-sale/bend', name: 'Bend', anchor: 'Bend homes for sale' },
      community: {
        href: '/communities/tetherow',
        name: 'Tetherow',
        anchor: 'Tetherow homes for sale',
      },
    })
    expect(listingHubLinkList(links).map((d) => d.anchor)).toEqual([
      'Bend homes for sale',
      'Tetherow homes for sale',
    ])
  })

  it('keeps a city door when the plat is not a registry community', () => {
    const links = listingHubLinks({
      city: { slug: 'redmond', label: 'Redmond' },
      community: { slug: 'some-plat', label: 'Some Plat', href: '/subdivisions/some-plat' },
    })
    expect(links).toEqual({
      city: { href: '/homes-for-sale/redmond', name: 'Redmond', anchor: 'Redmond homes for sale' },
      community: null,
    })
  })

  it('drops the city door when it would repeat the community exact-match (Sunriver)', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Sunriver',
      citySlug: 'sunriver',
      subdivisionName: 'Sunriver',
      subdivisionSlug: 'sunriver',
    })
    const links = listingHubLinks({
      city: { slug: 'sunriver', label: 'Sunriver' },
      community: ctx.curatedCommunity,
    })
    expect(links?.city).toBeNull()
    expect(links?.community).toEqual({
      href: '/communities/sunriver',
      name: 'Sunriver',
      anchor: 'Sunriver homes for sale',
    })
  })

  it('returns null for an out-of-area city with no community hub', () => {
    expect(
      listingHubLinks({
        city: { slug: 'medford', label: 'Medford' },
        community: null,
      }),
    ).toBeNull()
  })
})
