import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { communityImage } from '@/lib/geo-images'
import {
  cityCommunityRailSlugs,
  isFragileBannerUrl,
  resolveCityCommunityRailPhoto,
} from './city-community-rail-photo'
import type { SurfaceImage } from '@/lib/data/media/getSurfaceImages'

const NWC_IMAGE = communityImage('northwest-crossing')
const NWC_IMAGINE =
  'https://cdn.example/asset-library/photos/grok-imagine/imagine-place-community-northwest-crossing.png'
const NWC_BANNER =
  'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/banners/subdivisions/bend/northwest-crossing.jpg'
const BEND_CITY = 'https://cdn.example/bend-old-mill.jpg'

const pool: SurfaceImage[] = [
  {
    url: NWC_IMAGINE,
    geoTags: ['northwest-crossing', 'central-oregon'],
    subjectTags: ['aerial'],
  },
  { url: BEND_CITY, geoTags: ['bend', 'central-oregon'], subjectTags: ['river'] },
]

describe('cityCommunityRailSlugs', () => {
  it('unwraps a city-prefixed NorthWest Crossing slug to the registry key', () => {
    const slugs = cityCommunityRailSlugs('bend-northwest-crossing', 'NorthWest Crossing', 'bend')
    expect(slugs).toContain('northwest-crossing')
    expect(slugs).toContain('bend-northwest-crossing')
  })
})

describe('resolveCityCommunityRailPhoto', () => {
  it('gives NorthWest Crossing the owned communityImage when the pool is empty', () => {
    expect(NWC_IMAGE).toBe('/images/communities/northwest-crossing.jpg')
    expect(
      resolveCityCommunityRailPhoto({
        slug: 'northwest-crossing',
        name: 'NorthWest Crossing',
        citySlug: 'bend',
        pool: [],
      }),
    ).toBe(NWC_IMAGE)
  })

  it('still finds NorthWest Crossing when the index slug is city-prefixed', () => {
    expect(
      resolveCityCommunityRailPhoto({
        slug: 'bend-northwest-crossing',
        name: 'NorthWest Crossing',
        citySlug: 'bend',
        liveHero: NWC_BANNER,
        pool: [],
      }),
    ).toBe(NWC_IMAGE)
  })

  it('does not let a 404 banners hero paint the gray hole over communityImage', () => {
    expect(isFragileBannerUrl(NWC_BANNER)).toBe(true)
    expect(
      resolveCityCommunityRailPhoto({
        slug: 'northwest-crossing',
        liveHero: NWC_BANNER,
        curated: '/images/kb/northwest-crossing.jpg',
        pool: [],
      }),
    ).toBe(NWC_IMAGE)
  })

  it('lets a named Imagine still outrank a leftover banner crop', () => {
    expect(
      resolveCityCommunityRailPhoto({
        slug: 'northwest-crossing',
        liveHero: NWC_BANNER,
        pool,
      }),
    ).toBe(NWC_IMAGINE)
  })

  it('does not clone a city photo when the community has no still', () => {
    expect(
      resolveCityCommunityRailPhoto({
        slug: 'no-such-community',
        liveHero: NWC_BANNER,
        pool,
      }),
    ).toBeNull()
  })
})

describe('city page wires the rail resolver', () => {
  it('Bend #communities cards resolve through resolveCityCommunityRailPhoto', () => {
    const src = readFileSync(join(process.cwd(), 'app/cities/[slug]/page.tsx'), 'utf8')
    expect(src).toMatch(/resolveCityCommunityRailPhoto/)
    expect(src).not.toMatch(/communityImage\(registrySlug\)/)
    expect(src).not.toMatch(/getSurfaceImages\(/)
  })
})
