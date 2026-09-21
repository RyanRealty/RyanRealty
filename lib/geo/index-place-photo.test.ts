import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { communityImage } from '@/lib/geo-images'
import {
  indexImagineStill,
  indexPlaceGeoTags,
  preferIndexPlaceHero,
  resolveIndexPlacePhoto,
} from './index-place-photo'
import type { SurfaceImage } from '@/lib/data/media/getSurfaceImages'

const BBR_STILL =
  'https://cdn.example/asset-library/photos/grok-imagine/imagine-place-community-black-butte-ranch.png'
const RIVERS_STILL =
  'https://cdn.example/asset-library/photos/grok-imagine/imagine-place-community-rivers-edge.png'
const VANDEVERT_STILL =
  'https://cdn.example/asset-library/photos/grok-imagine/imagine-place-community-vandevert-ranch.png'
const SEVENTH_STILL =
  'https://cdn.example/asset-library/photos/grok-imagine/imagine-place-community-inn-of-the-7th-mountain.png'
const SISTERS_CITY = 'https://cdn.example/sisters-downtown.jpg'
const BEND_CITY = 'https://cdn.example/bend-old-mill.jpg'

const pool: SurfaceImage[] = [
  { url: BBR_STILL, geoTags: ['black-butte-ranch', 'central-oregon'], subjectTags: ['aerial'] },
  { url: RIVERS_STILL, geoTags: ['rivers-edge', 'central-oregon'], subjectTags: ['golf'] },
  { url: VANDEVERT_STILL, geoTags: ['vandevert-ranch', 'central-oregon'], subjectTags: ['landscape'] },
  { url: SEVENTH_STILL, geoTags: ['inn-of-the-7th-mountain', 'central-oregon'], subjectTags: ['resort'] },
  { url: SISTERS_CITY, geoTags: ['sisters', 'central-oregon'], subjectTags: ['downtown'] },
  { url: BEND_CITY, geoTags: ['bend', 'central-oregon'], subjectTags: ['river'] },
]

describe('indexPlaceGeoTags', () => {
  it('collects the community slug and its recorded aliases, never the city', () => {
    const tags = indexPlaceGeoTags(['black-butte-ranch'])
    expect(tags).toContain('black-butte-ranch')
    expect(tags).toContain('glaze-meadow-homesite-section')
    expect(tags).not.toContain('sisters')
    expect(tags).not.toContain('central-oregon')
  })

  it('keeps a plat slug that is not itself a registry community', () => {
    const tags = indexPlaceGeoTags(['7th-mtn-golf-village', 'inn-of-the-7th-mountain'])
    expect(tags).toContain('7th-mtn-golf-village')
    expect(tags).toContain('inn-of-the-7th-mountain')
    expect(tags).not.toContain('bend')
  })
})

describe('resolveIndexPlacePhoto', () => {
  it('gives Black Butte Ranch, Rivers Edge, and Vandevert their library stills', () => {
    expect(resolveIndexPlacePhoto({ slug: 'black-butte-ranch', pool })).toBe(BBR_STILL)
    expect(resolveIndexPlacePhoto({ slug: 'rivers-edge', pool })).toBe(RIVERS_STILL)
    expect(resolveIndexPlacePhoto({ slug: 'vandevert-ranch', pool })).toBe(VANDEVERT_STILL)
  })

  it('gives Glaze Meadow and 7th Mtn Golf Village the parent still', () => {
    expect(
      resolveIndexPlacePhoto({
        slug: 'glaze-meadow-homesite-section',
        parentSlug: 'black-butte-ranch',
        pool,
      }),
    ).toBe(BBR_STILL)
    expect(
      resolveIndexPlacePhoto({
        slug: '7th-mtn-golf-village',
        parentSlug: 'inn-of-the-7th-mountain',
        pool,
      }),
    ).toBe(SEVENTH_STILL)
  })

  it('does not clone a city photo when the place has no still', () => {
    expect(resolveIndexPlacePhoto({ slug: 'no-such-place', pool })).toBeNull()
  })

  it('falls back to communityImage when the pool is empty', () => {
    expect(resolveIndexPlacePhoto({ slug: 'vandevert-ranch', pool: [] })).toBe(
      communityImage('vandevert-ranch'),
    )
    expect(resolveIndexPlacePhoto({ slug: 'black-butte-ranch', pool: [] })).toBeNull()
  })
})

describe('preferIndexPlaceHero', () => {
  it('lets an Imagine still outrank a leftover live crop', () => {
    expect(preferIndexPlaceHero('/images/communities/vandevert-ranch.jpg', VANDEVERT_STILL)).toBe(
      VANDEVERT_STILL,
    )
  })

  it('keeps a live hero when there is no Imagine still', () => {
    expect(preferIndexPlaceHero('https://cdn.example/live.jpg', '/images/communities/vandevert-ranch.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
  })

  it('is honest empty when nothing is owned', () => {
    expect(preferIndexPlaceHero('  ', null)).toBeNull()
    expect(indexImagineStill(null, '/images/communities/vandevert-ranch.jpg')).toBeNull()
  })
})

describe('index pages wire the resolver', () => {
  it('communities and subdivisions indexes drop city clones', () => {
    const communities = readFileSync(join(process.cwd(), 'app/communities/page.tsx'), 'utf8')
    const subdivisions = readFileSync(join(process.cwd(), 'app/subdivisions/page.tsx'), 'utf8')
    for (const src of [communities, subdivisions]) {
      expect(src).toMatch(/resolveIndexPlacePhoto/)
      expect(src).toMatch(/preferPlaceHeroOrNull/)
      expect(src).not.toMatch(/\bcityHero\b/)
      expect(src).not.toMatch(/geoTags: \[.*city/)
    }
    expect(subdivisions).not.toMatch(/photoIsPlat/)
    expect(communities).not.toMatch(/photoIsCommunity/)
  })
})
