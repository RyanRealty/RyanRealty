import { describe, expect, it } from 'vitest'
import {
  cityPresetTypeTwin,
  communityPresetTypeTwin,
  isPlaceTypePresetSlug,
  placeTypeSitemapPaths,
} from './place-type-twin'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import { resolvePlaceTypePage } from '@/lib/place/place-type-page'
import { getPresetBySlug } from '@/lib/search-presets'

describe('place-type twins (EXP-6)', () => {
  it('every type page slug is a real search preset and a resolvable type page', () => {
    for (const slug of PLACE_TYPE_PAGE_SLUGS) {
      expect(isPlaceTypePresetSlug(slug)).toBe(true)
      expect(getPresetBySlug(slug), slug).not.toBeNull()
      expect(resolvePlaceTypePage(slug)?.slug, slug).toBe(slug)
    }
    expect(isPlaceTypePresetSlug('under-500k')).toBe(false)
    expect(isPlaceTypePresetSlug('luxury')).toBe(false)
  })

  it('a city type preset with a verified-positive count canonicalizes to the city type page', () => {
    const positive = new Set(['/homes-for-sale/bend/single-family', '/homes-for-sale/bend/condos'])
    expect(cityPresetTypeTwin('bend', 'single-family', positive)).toBe('/cities/bend/types/single-family')
    expect(cityPresetTypeTwin('bend', 'condos', positive)).toBe('/cities/bend/types/condos')
    // Verified zero or never enumerated: no twin (the W3.1 noindex rule owns it).
    expect(cityPresetTypeTwin('bend', 'farms', positive)).toBeNull()
    // Not a type preset.
    expect(cityPresetTypeTwin('bend', 'under-500k', new Set(['/homes-for-sale/bend/under-500k']))).toBeNull()
    // Failed matrix read: never a twin.
    expect(cityPresetTypeTwin('bend', 'single-family', null)).toBeNull()
  })

  it('never points at a type page outside the ten site cities (those answered HTTP 500 live, 2026-09-23)', () => {
    const positive = new Set(['/homes-for-sale/metolius/single-family', '/homes-for-sale/culver/single-family'])
    expect(cityPresetTypeTwin('metolius', 'single-family', positive)).toBeNull()
    expect(cityPresetTypeTwin('culver', 'single-family', positive)).toBe('/cities/culver/types/single-family')
    expect(
      placeTypeSitemapPaths(['metolius', 'culver'], { positiveCityPresets: positive, positivePaths: new Set() }),
    ).toEqual(['/cities/culver/types/single-family'])
  })

  it('a community type combo canonicalizes to the community type page at the matrix resort key', () => {
    const positive = new Set([
      '/homes-for-sale/bend/tetherow/single-family',
      '/homes-for-sale/bend/juniper-preserve/single-family',
    ])
    expect(communityPresetTypeTwin('bend', 'tetherow', 'single-family', positive)).toBe(
      '/communities/tetherow/types/single-family',
    )
    // Registry slug 'pronghorn', label 'Juniper Preserve': the matrix keys the label slug.
    expect(communityPresetTypeTwin('bend', 'juniper-preserve', 'single-family', positive)).toBe(
      '/communities/juniper-preserve/types/single-family',
    )
    expect(communityPresetTypeTwin('bend', 'tetherow', 'condos', positive)).toBeNull()
    // A plat or neighborhood area is not a community: no type page at that grain.
    expect(communityPresetTypeTwin('bend', 'awbrey-butte', 'single-family', new Set(['/homes-for-sale/bend/awbrey-butte/single-family']))).toBeNull()
  })

  it('the sitemap types leg submits exactly the positive twins, sorted and deduped', () => {
    const paths = placeTypeSitemapPaths(['bend', 'bend', 'redmond'], {
      positiveCityPresets: new Set(['/homes-for-sale/bend/single-family', '/homes-for-sale/redmond/lots-and-land', '/homes-for-sale/bend/under-500k']),
      positivePaths: new Set(['/homes-for-sale/bend/tetherow/single-family']),
    })
    expect(paths).toEqual([
      '/cities/bend/types/single-family',
      '/cities/redmond/types/lots-and-land',
      '/communities/tetherow/types/single-family',
    ])
    expect(placeTypeSitemapPaths(['bend'], null)).toEqual([])
  })
})
