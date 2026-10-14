import { describe, expect, it } from 'vitest'
import { listingCommunityDoor } from './listing-community-door'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'

const RESORTS = [
  { subdivision: 'Brasada Ranch', href: '/communities/brasada-ranch', name: 'Brasada Ranch' },
  { subdivision: 'Tetherow', href: '/communities/tetherow', name: 'Tetherow' },
  { subdivision: 'Broken Top', href: '/communities/broken-top', name: 'Broken Top' },
  { subdivision: 'Sunriver', href: '/communities/sunriver', name: 'Sunriver' },
  { subdivision: 'Eagle Crest', href: '/communities/eagle-crest', name: 'Eagle Crest' },
] as const

describe('listingCommunityDoor', () => {
  it('prints a descriptive Brasada Ranch homes-for-sale door', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Powell Butte',
      citySlug: 'powell-butte',
      subdivisionName: 'Brasada Ranch',
      subdivisionSlug: 'brasada-ranch',
    })
    const door = listingCommunityDoor(ctx.curatedCommunity)
    expect(door).toEqual({
      href: '/communities/brasada-ranch',
      name: 'Brasada Ranch',
      anchor: 'Brasada Ranch homes for sale',
    })
  })

  it('resolves the named resort communities to their live /communities pages', () => {
    for (const resort of RESORTS) {
      const ctx = resolvePlaceContextFromListing({
        city: 'Bend',
        citySlug: 'bend',
        subdivisionName: resort.subdivision,
        subdivisionSlug: resort.href.replace('/communities/', ''),
      })
      const door = listingCommunityDoor(ctx.curatedCommunity)
      expect(door?.href, resort.subdivision).toBe(resort.href)
      expect(door?.name, resort.subdivision).toBe(resort.name)
      expect(door?.anchor, resort.subdivision).toBe(`${resort.name} homes for sale`)
    }
  })

  it('uses the live Juniper Preserve URL, not the Pronghorn 308 hop', () => {
    const door = listingCommunityDoor({ slug: 'pronghorn', label: 'Juniper Preserve' })
    expect(door?.href).toBe('/communities/juniper-preserve')
    expect(door?.anchor).toBe('Juniper Preserve homes for sale')
  })

  it('returns null for an ordinary plat that is not a registry community', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      neighborhoodName: 'Old Bend',
      neighborhoodSlug: 'old-bend',
      subdivisionName: 'Some Ordinary Plat',
      subdivisionSlug: 'some-ordinary-plat',
    })
    expect(ctx.curatedCommunity).toBeNull()
    expect(listingCommunityDoor(ctx.curatedCommunity)).toBeNull()
    expect(
      listingCommunityDoor({
        slug: 'some-ordinary-plat',
        label: 'Some Ordinary Plat',
        href: '/subdivisions/some-ordinary-plat',
      }),
    ).toBeNull()
  })

  it('returns null for noise labels and missing input', () => {
    expect(listingCommunityDoor(null)).toBeNull()
    expect(listingCommunityDoor({ slug: 'na', label: 'N/A', href: '/communities/na' })).toBeNull()
  })
})
