import { describe, it, expect } from 'vitest'
import type { SearchPreset } from '@/lib/search-presets'
import { SEARCH_PRESETS, getPresetBySlug } from '@/lib/search-presets'
import {
  presetTileMatcher,
  deriveCityPresetLinks,
  deriveCityLinks,
  deriveCommunityLinks,
  deriveSubdivisionLinks,
  titleCaseWords,
  type ActiveTileLite,
  type GeoCountLite,
} from './derive-search-links'

const NOW = new Date('2026-07-22T12:00:00Z')

function tile(overrides: Partial<ActiveTileLite> = {}): ActiveTileLite {
  return {
    city: 'Bend',
    listPrice: 800_000,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    lotAcres: 0.25,
    yearBuilt: 2005,
    hasPool: false,
    onMarketDate: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

function preset(slug: string): SearchPreset {
  const p = getPresetBySlug(slug)
  if (!p) throw new Error(`fixture preset missing: ${slug}`)
  return p
}

describe('presetTileMatcher', () => {
  it('evaluates price-tier presets against listPrice', () => {
    const match = presetTileMatcher(preset('under-750k'), NOW)
    expect(match).not.toBeNull()
    expect(match!(tile({ listPrice: 700_000 }))).toBe(true)
    expect(match!(tile({ listPrice: 750_000 }))).toBe(true)
    expect(match!(tile({ listPrice: 800_000 }))).toBe(false)
    // Null price never matches (conservative null-guard).
    expect(match!(tile({ listPrice: null }))).toBe(false)
  })

  it('evaluates luxury (minPrice) presets', () => {
    const match = presetTileMatcher(preset('luxury'), NOW)
    expect(match!(tile({ listPrice: 1_200_000 }))).toBe(true)
    expect(match!(tile({ listPrice: 950_000 }))).toBe(false)
  })

  it('resolves the new-construction rolling year floor from `now`', () => {
    const match = presetTileMatcher(preset('new-construction'), NOW)
    // offset 2 from 2026 ⇒ floor 2024
    expect(match!(tile({ yearBuilt: 2024 }))).toBe(true)
    expect(match!(tile({ yearBuilt: 2023 }))).toBe(false)
    expect(match!(tile({ yearBuilt: null }))).toBe(false)
  })

  it('evaluates acreage via lotAcres and subtype via contains', () => {
    const acreage = presetTileMatcher(preset('acreage-5'), NOW)
    expect(acreage!(tile({ lotAcres: 6 }))).toBe(true)
    expect(acreage!(tile({ lotAcres: 4.9 }))).toBe(false)

    const condos = presetTileMatcher(preset('condos'), NOW)
    expect(condos!(tile({ propertySubType: 'Condominium' }))).toBe(true)
    expect(condos!(tile({ propertySubType: 'Townhouse' }))).toBe(false)
  })

  it('maps lots-and-land to MLS PropertyType code D', () => {
    const match = presetTileMatcher(preset('lots-and-land'), NOW)
    expect(match!(tile({ propertyType: 'D' }))).toBe(true)
    expect(match!(tile({ propertyType: 'A' }))).toBe(false)
    expect(match!(tile({ propertyType: null }))).toBe(false)
  })

  it('evaluates new-listings against onMarketDate within the window', () => {
    const match = presetTileMatcher(preset('new-listings'), NOW)
    expect(match!(tile({ onMarketDate: '2026-07-20T00:00:00Z' }))).toBe(true)
    expect(match!(tile({ onMarketDate: '2026-07-01T00:00:00Z' }))).toBe(false)
    expect(match!(tile({ onMarketDate: null }))).toBe(false)
  })

  it('returns null for presets whose filters are NOT tile-derivable', () => {
    // Partial evaluation would over-count — these must be excluded entirely.
    for (const slug of [
      'mountain-view',
      'with-shop',
      'rv-parking',
      'on-golf-course',
      'gated-community',
      'open-house',
      'pending',
      'single-level',
      'with-fireplace',
    ]) {
      expect(presetTileMatcher(preset(slug), NOW), slug).toBeNull()
    }
  })

  it('returns null for sort-only presets (duplicate content rule)', () => {
    expect(presetTileMatcher(preset('price-low-to-high'), NOW)).toBeNull()
    expect(presetTileMatcher(preset('price-high-to-low'), NOW)).toBeNull()
  })
})

describe('deriveCityPresetLinks', () => {
  const cities = [
    { slug: 'bend', name: 'Bend' },
    { slug: 'la-pine', name: 'La Pine' },
  ]

  it('ranks presets by live match count, descending', () => {
    const tiles: ActiveTileLite[] = [
      // Bend: 4 under-750k (of which 3 also under-500k), 3 luxury
      tile({ listPrice: 400_000 }),
      tile({ listPrice: 450_000 }),
      tile({ listPrice: 480_000 }),
      tile({ listPrice: 700_000 }),
      tile({ listPrice: 1_100_000 }),
      tile({ listPrice: 1_500_000 }),
      tile({ listPrice: 2_500_000 }),
    ]
    const result = deriveCityPresetLinks(tiles, cities, { minCount: 3, now: NOW })
    const bend = result.get('bend')!
    const slugs = bend.map((l) => l.presetSlug)
    // under-1m (4) and under-750k (4) outrank under-500k/600k (3) and luxury (3)
    expect(slugs.indexOf('under-750k')).toBeLessThan(slugs.indexOf('under-500k'))
    expect(slugs).toContain('luxury')
    const luxury = bend.find((l) => l.presetSlug === 'luxury')!
    expect(luxury.count).toBe(3)
    expect(luxury.href).toBe('/homes-for-sale/bend/luxury')
    expect(luxury.label).toBe('Luxury')
  })

  it('drops combos below minCount — no links to near-empty results', () => {
    const tiles = [tile({ listPrice: 250_000 }), tile({ listPrice: 260_000 })]
    const result = deriveCityPresetLinks(tiles, cities, { minCount: 3, now: NOW })
    expect(result.get('bend')).toEqual([])
  })

  it('caps at perCity', () => {
    const tiles = Array.from({ length: 30 }, (_, i) =>
      tile({ listPrice: 200_000 + i * 10_000 }),
    )
    const result = deriveCityPresetLinks(tiles, cities, {
      minCount: 3,
      perCity: 4,
      now: NOW,
    })
    expect(result.get('bend')!.length).toBe(4)
  })

  it('buckets multi-word cities by scope slug (La Pine → la-pine)', () => {
    const tiles = [
      tile({ city: 'La Pine', listPrice: 300_000 }),
      tile({ city: 'La Pine', listPrice: 310_000 }),
      tile({ city: 'La Pine', listPrice: 320_000 }),
    ]
    const result = deriveCityPresetLinks(tiles, cities, { minCount: 3, now: NOW })
    const laPine = result.get('la-pine')!
    expect(laPine.length).toBeGreaterThan(0)
    expect(laPine[0].href.startsWith('/homes-for-sale/la-pine/')).toBe(true)
    // Bend saw none of these tiles.
    expect(result.get('bend')).toEqual([])
  })

  it('uses the real SEARCH_PRESETS pool by default without throwing', () => {
    const result = deriveCityPresetLinks([tile()], cities, { now: NOW })
    expect(result.size).toBe(2)
    expect(SEARCH_PRESETS.length).toBeGreaterThan(0)
  })
})

describe('deriveCityLinks', () => {
  const snaps: GeoCountLite[] = [
    { geoKey: 'bend', geoLabel: 'Bend', activeSfrCount: 500 },
    { geoKey: 'la pine', geoLabel: 'la pine', activeSfrCount: 120 },
    { geoKey: 'redmond', geoLabel: 'Redmond', activeSfrCount: 200 },
    // out-of-allowlist snapshot must not leak in
    { geoKey: 'medford', geoLabel: 'Medford', activeSfrCount: 999 },
  ]

  it('ranks allowed cities by active count and keeps page-less counts out', () => {
    const links = deriveCityLinks(snaps, ['bend', 'redmond', 'la-pine', 'sisters'])
    expect(links.map((l) => l.slug)).toEqual(['bend', 'redmond', 'la-pine', 'sisters'])
    expect(links.find((l) => l.slug === 'medford' as string)).toBeUndefined()
    // Sisters has no snapshot — still present (its page exists), count 0, last.
    const sisters = links[3]
    expect(sisters.slug).toBe('sisters')
    expect(sisters.count).toBe(0)
    expect(sisters.name).toBe('Sisters')
    expect(sisters.browseHref).toBe('/homes-for-sale/sisters')
    expect(sisters.hubHref).toBe('/cities/sisters')
  })

  it('title-cases lowercase MV labels for display', () => {
    const links = deriveCityLinks(snaps, ['la-pine'])
    expect(links[0].name).toBe('La Pine')
  })
})

describe('deriveCommunityLinks', () => {
  it('ranks registry entries by community snapshot count, keeps zero-count pages', () => {
    const counts = new Map<string, number>([
      ['bend:tetherow', 40],
      ['sunriver:sunriver', 90],
    ])
    const links = deriveCommunityLinks(
      [
        { slug: 'tetherow', label: 'Tetherow', city: 'Bend' },
        { slug: 'sunriver', label: 'Sunriver', city: 'Sunriver' },
        { slug: 'brasada-ranch', label: 'Brasada Ranch', city: 'Powell Butte' },
      ],
      counts,
    )
    expect(links.map((l) => l.href)).toEqual([
      '/communities/sunriver',
      '/communities/tetherow',
      '/communities/brasada-ranch',
    ])
    expect(links[0].label).toBe('Sunriver · Sunriver')
    expect(links[2].count).toBe(0)
  })
})

describe('deriveSubdivisionLinks', () => {
  const snaps: GeoCountLite[] = [
    { geoKey: 'bend:awbrey butte', geoLabel: 'Awbrey Butte', activeSfrCount: 12 },
    { geoKey: 'redmond:eagle crest', geoLabel: 'eagle crest', activeSfrCount: 9 },
    { geoKey: 'bend:nw crossing', geoLabel: 'NW Crossing', activeSfrCount: 5 },
    // below threshold
    { geoKey: 'bend:tiny plat', geoLabel: 'Tiny Plat', activeSfrCount: 2 },
    // junk name
    { geoKey: 'bend:unknown', geoLabel: 'Unknown', activeSfrCount: 20 },
    { geoKey: 'bend:n/a', geoLabel: 'N/A', activeSfrCount: 20 },
    // out of service area
    { geoKey: 'medford:east side', geoLabel: 'East Side', activeSfrCount: 50 },
    // malformed key
    { geoKey: 'bend', geoLabel: 'Bend', activeSfrCount: 99 },
  ]

  it('ranks, thresholds, scopes, and drops junk slugs', () => {
    const links = deriveSubdivisionLinks(snaps, { minCount: 3 })
    expect(links.map((l) => l.href)).toEqual([
      '/homes-for-sale/bend/awbrey-butte',
      '/homes-for-sale/redmond/eagle-crest',
      '/homes-for-sale/bend/nw-crossing',
    ])
    expect(links[0].label).toBe('Awbrey Butte · Bend')
    // Lowercase MV label gets display casing.
    expect(links[1].label).toBe('Eagle Crest · Redmond')
  })

  it('caps the list', () => {
    const many: GeoCountLite[] = Array.from({ length: 80 }, (_, i) => ({
      geoKey: `bend:plat ${i}`,
      geoLabel: `Plat ${i}`,
      activeSfrCount: 100 - i,
    }))
    const links = deriveSubdivisionLinks(many, { cap: 50, minCount: 3 })
    expect(links.length).toBe(50)
    expect(links[0].count).toBe(100)
  })

  it('dedupes by href keeping the max count', () => {
    const dupes: GeoCountLite[] = [
      { geoKey: 'bend:shevlin commons', geoLabel: 'Shevlin Commons', activeSfrCount: 4 },
      { geoKey: 'bend:shevlin  commons', geoLabel: 'Shevlin Commons', activeSfrCount: 7 },
    ]
    const links = deriveSubdivisionLinks(dupes, { minCount: 3 })
    expect(links.length).toBe(1)
    expect(links[0].count).toBe(7)
  })

  it('excludes resort sub-slugs already linked from the communities group', () => {
    const withResort: GeoCountLite[] = [
      { geoKey: 'bend:tetherow', geoLabel: 'Tetherow', activeSfrCount: 40 },
      { geoKey: 'bend:awbrey butte', geoLabel: 'Awbrey Butte', activeSfrCount: 12 },
    ]
    const links = deriveSubdivisionLinks(withResort, {
      minCount: 3,
      excludeSubSlugs: new Set(['tetherow']),
    })
    expect(links.map((l) => l.href)).toEqual(['/homes-for-sale/bend/awbrey-butte'])
  })
})

describe('titleCaseWords', () => {
  it('capitalizes each word', () => {
    expect(titleCaseWords('la pine')).toBe('La Pine')
    expect(titleCaseWords('awbrey  butte')).toBe('Awbrey Butte')
    expect(titleCaseWords('Bend')).toBe('Bend')
  })
})
