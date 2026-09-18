import { describe, expect, it } from 'vitest'
import {
  LISTING_ATLAS_RELATED_PLAT_CAP_NO_FRAME,
  LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME,
  LISTING_KEEP_EXPLORING_CHIP_FOLD_AT,
  isListingAtlasVisitorPlat,
  listingKeepExploringDoor,
  pickListingAtlasRelatedPlats,
} from './listing-keep-exploring'

function plat(over: { slug: string; label: string; activeHomes?: number }) {
  return { activeHomes: 0, ...over }
}

describe('listingKeepExploringDoor', () => {
  it('routes View more to the recorded subdivision, not city search', () => {
    const door = listingKeepExploringDoor({
      subdivision: {
        label: 'Parkside Place Phase 1',
        slug: 'parkside-place-phase-1',
        href: '/subdivisions/parkside-place-phase-1',
      },
      curatedCommunity: { label: 'Bend', slug: 'bend', href: '/cities/bend' },
      city: { label: 'Bend', slug: 'bend', href: '/cities/bend' },
    })
    expect(door.name).toBe('Parkside Place Phase 1')
    expect(door.href).toBe('/subdivisions/parkside-place-phase-1')
    expect(door.href).not.toMatch(/^\/homes-for-sale\/?$/)
    expect(door.href).not.toMatch(/^\/homes-for-sale\/[^/]+\/?$/)
  })

  it('prefers the alias plat over a curated community', () => {
    const door = listingKeepExploringDoor({
      aliasPlat: { label: 'Stevens Ranch Phase RS-1', slug: 'stevens-ranch-phase-rs-1' },
      aliasParent: { label: 'Stevens Ranch', slug: 'stevens-ranch' },
      curatedCommunity: {
        label: 'Stevens Ranch',
        slug: 'stevens-ranch',
        href: '/communities/stevens-ranch',
      },
      city: { label: 'Bend', slug: 'bend', href: '/cities/bend' },
    })
    expect(door.href).toBe('/subdivisions/stevens-ranch-phase-rs-1')
  })

  it('does not fall back to generic /homes-for-sale search', () => {
    const door = listingKeepExploringDoor({
      city: { label: 'Bend', slug: 'bend', href: '/cities/bend' },
    })
    expect(door.href).toBe('/cities/bend')
  })

  it('skips a permit-glued plat and uses the visitor subdivision', () => {
    const door = listingKeepExploringDoor({
      aliasPlat: { label: 'Stevens Ranch PLLD', slug: 'stevens-ranch-plld20211070' },
      subdivision: {
        label: 'Stevens Ranch',
        slug: 'stevens-ranch',
        href: '/subdivisions/stevens-ranch',
      },
      city: { label: 'Bend', slug: 'bend', href: '/cities/bend' },
    })
    expect(door.href).toBe('/subdivisions/stevens-ranch')
  })
})

describe('pickListingAtlasRelatedPlats', () => {
  it('keeps chip fold at 8 so 375 cannot print +52 more', () => {
    expect(LISTING_KEEP_EXPLORING_CHIP_FOLD_AT).toBe(8)
    expect(LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME).toBe(7)
    expect(LISTING_ATLAS_RELATED_PLAT_CAP_NO_FRAME).toBe(8)
  })

  it('kills the city-frame legal-plat dump — subject plat only', () => {
    const plats = Array.from({ length: 60 }, (_, i) =>
      plat({ slug: `plat-${i}`, label: `Legal Plat ${i}`, activeHomes: 60 - i }),
    )
    const subject = plats[12]
    const picked = pickListingAtlasRelatedPlats({ plats, subject, hasLocalFrame: false })
    expect(picked).toEqual([subject])
    expect(picked).toHaveLength(1)
  })

  it('caps a local frame so frame + plats stay at the 375 fold', () => {
    const plats = Array.from({ length: 40 }, (_, i) =>
      plat({ slug: `awbrey-glen-phase-${i + 1}`, label: `Awbrey Glen Phase ${i + 1}`, activeHomes: 40 - i }),
    )
    const subject = plats[0]
    const picked = pickListingAtlasRelatedPlats({ plats, subject, hasLocalFrame: true })
    expect(picked[0]).toEqual(subject)
    expect(picked.length).toBeLessThanOrEqual(LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME)
    expect(picked.length + 1).toBeLessThanOrEqual(LISTING_KEEP_EXPLORING_CHIP_FOLD_AT)
  })

  it('drops permit-glued and withheld MLS tokens from sibling chips', () => {
    expect(
      isListingAtlasVisitorPlat({ slug: 'stevens-ranch-plld20211070', label: 'Stevens Ranch' }),
    ).toBe(false)
    expect(isListingAtlasVisitorPlat({ slug: 'oww', label: 'Oww' })).toBe(false)
    expect(
      isListingAtlasVisitorPlat({ slug: 'parkside-place-phase-1', label: 'Parkside Place Phase 1' }),
    ).toBe(true)
  })
})
