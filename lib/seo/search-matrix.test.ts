import { describe, expect, it } from 'vitest'
import type { SearchMatrixInventoryRow } from '@/lib/data/listings/getSearchMatrixInventory'
import { SEARCH_PRESETS, getPresetBySlug, type SearchPreset } from '@/lib/search-presets'
import {
  SEARCH_MATRIX_MIN_ACTIVE,
  buildSearchMatrix,
  cityLowerToSlug,
  cityPresetPath,
  citySlugToLowerName,
  matrixEmittablePresets,
  matrixPath,
  presetMatrixMatcher,
  searchMatrixSitemapUrls,
  shouldNoIndexMatrixCombo,
  type MatrixGeo,
} from './search-matrix'

const NOW = new Date('2026-07-22T12:00:00Z')

function row(overrides: Partial<SearchMatrixInventoryRow> = {}): SearchMatrixInventoryRow {
  return {
    standard_status: 'Active',
    list_price: 500_000,
    city_lower: 'bend',
    subdivision_lower: null,
    boundary_neighborhood: null,
    property_type: 'A',
    property_sub_type: 'Single Family Residence',
    year_built: 2005,
    lot_size_acres: 0.2,
    pool_yn: false,
    fireplace_yn: false,
    waterfront_yn: false,
    view_types: null,
    hoa_amenities: null,
    parking_features: null,
    ...overrides,
  }
}

function preset(slug: string): SearchPreset {
  const p = getPresetBySlug(slug)
  if (!p) throw new Error(`missing preset fixture: ${slug}`)
  return p
}

function geo(overrides: Partial<MatrixGeo> = {}): MatrixGeo {
  return {
    kind: 'subdivision',
    citySlug: 'bend',
    areaSlug: 'test-acres',
    cityLower: 'bend',
    subdivisionNamesLower: ['test acres'],
    hasDepthContent: true,
    ...overrides,
  }
}

describe('citySlugToLowerName', () => {
  it('maps canonical slugs to lowercase MLS spellings', () => {
    expect(citySlugToLowerName('bend')).toBe('bend')
    expect(citySlugToLowerName('la-pine')).toBe('la pine')
    expect(citySlugToLowerName('crooked-river-ranch')).toBe('crooked river ranch')
  })
})

describe('presetMatrixMatcher — derivability rule', () => {
  it('pins the exact matrix-emittable preset set (a new preset must be classified here)', () => {
    const emittable = matrixEmittablePresets(SEARCH_PRESETS, NOW).map((p) => p.slug)
    expect(emittable).toEqual([
      'under-300k',
      'under-400k',
      'under-500k',
      'under-600k',
      'under-750k',
      'under-1m',
      'under-1-5m',
      'luxury',
      'over-1-5m',
      'over-2m',
      'pending',
      'new-construction',
      'acreage',
      'acreage-5',
      'lots-and-land',
      'gated-community',
      'condos',
      'townhomes',
      'multi-family',
      'manufactured',
      'with-pool',
      'with-view',
      'with-fireplace',
      'mountain-view',
      'water-view',
      'river-view',
      'golf-course-view',
      'lake-view',
    ])
  })

  it('excludes partially-evaluable and sort-only presets', () => {
    for (const slug of [
      'new-listings', // needs on_market_date
      'new-listings-30',
      'open-house', // needs has_open_house
      'on-golf-course', // needs lot_features_arr
      'single-level', // keywords
      'with-shop',
      'rv-parking',
      'price-low-to-high', // sort-only
      'price-high-to-low',
    ]) {
      expect(presetMatrixMatcher(preset(slug), NOW), slug).toBeNull()
    }
  })

  it('refuses sold/closed status presets at matrix scope (ODS G54)', () => {
    const sold: SearchPreset = {
      slug: 'recently-sold',
      label: 'Recently Sold',
      shortLabel: 'Sold',
      params: { statusFilter: 'closed', sort: 'newest' },
    }
    const all: SearchPreset = {
      slug: 'everything',
      label: 'Everything',
      shortLabel: 'All',
      params: { statusFilter: 'all', sort: 'newest' },
    }
    expect(presetMatrixMatcher(sold, NOW)).toBeNull()
    expect(presetMatrixMatcher(all, NOW)).toBeNull()
    expect(matrixEmittablePresets([sold, all], NOW)).toEqual([])
  })

  it('no registered preset carries a sold/closed statusFilter (ODS invariant)', () => {
    for (const p of SEARCH_PRESETS) {
      expect(p.params.statusFilter, p.slug).not.toBe('closed')
      expect(p.params.statusFilter, p.slug).not.toBe('all')
    }
  })
})

describe('presetMatrixMatcher — row semantics', () => {
  it('price bands are null-guarded (missing price never matches)', () => {
    const under = presetMatrixMatcher(preset('under-500k'), NOW)!
    expect(under(row({ list_price: 499_000 }))).toBe(true)
    expect(under(row({ list_price: 500_000 }))).toBe(true)
    expect(under(row({ list_price: 500_001 }))).toBe(false)
    expect(under(row({ list_price: null }))).toBe(false)
    const luxury = presetMatrixMatcher(preset('luxury'), NOW)!
    expect(luxury(row({ list_price: 1_200_000 }))).toBe(true)
    expect(luxury(row({ list_price: 900_000 }))).toBe(false)
  })

  it('multi-family matches MLS PropertyType code C only', () => {
    const match = presetMatrixMatcher(preset('multi-family'), NOW)!
    expect(match(row({ property_type: 'C' }))).toBe(true)
    expect(match(row({ property_type: 'A' }))).toBe(false)
    expect(match(row({ property_type: null }))).toBe(false)
  })

  it('manufactured matches the property_sub_type substring, both feed spellings', () => {
    const match = presetMatrixMatcher(preset('manufactured'), NOW)!
    expect(match(row({ property_sub_type: 'Manufactured On Land' }))).toBe(true)
    expect(match(row({ property_sub_type: 'Manufactured Home' }))).toBe(true)
    expect(match(row({ property_sub_type: 'Single Family Residence' }))).toBe(false)
    expect(match(row({ property_sub_type: null }))).toBe(false)
  })

  it('condos matches Condominium via substring (the searchListingsAll ilike contract)', () => {
    const match = presetMatrixMatcher(preset('condos'), NOW)!
    expect(match(row({ property_sub_type: 'Condominium' }))).toBe(true)
    expect(match(row({ property_sub_type: 'Townhouse' }))).toBe(false)
  })

  it('pending preset matches Pending status only; active presets exclude Pending', () => {
    const pending = presetMatrixMatcher(preset('pending'), NOW)!
    expect(pending(row({ standard_status: 'Pending' }))).toBe(true)
    expect(pending(row({ standard_status: 'Active' }))).toBe(false)
    const under = presetMatrixMatcher(preset('under-1m'), NOW)!
    expect(under(row({ standard_status: 'Pending' }))).toBe(false)
    expect(under(row({ standard_status: 'Active Under Contract' }))).toBe(true)
    expect(under(row({ standard_status: null }))).toBe(false)
  })

  it('gated-community matches Gated in hoa_amenities OR parking_features', () => {
    const match = presetMatrixMatcher(preset('gated-community'), NOW)!
    expect(match(row({ hoa_amenities: ['Gated', 'Pool'] }))).toBe(true)
    expect(match(row({ parking_features: ['Gated'] }))).toBe(true)
    expect(match(row({ hoa_amenities: ['Pool'], parking_features: ['Garage'] }))).toBe(false)
    expect(match(row())).toBe(false)
  })

  it('with-view requires a real view beyond bare Neighborhood', () => {
    const match = presetMatrixMatcher(preset('with-view'), NOW)!
    expect(match(row({ view_types: ['Cascade Mountains'] }))).toBe(true)
    expect(match(row({ view_types: ['Neighborhood'] }))).toBe(false)
    expect(match(row({ view_types: ['Neighborhood', 'River'] }))).toBe(true)
    expect(match(row({ view_types: [] }))).toBe(false)
    expect(match(row({ view_types: null }))).toBe(false)
  })

  it('view-type presets substring-match view_types entries', () => {
    const mountain = presetMatrixMatcher(preset('mountain-view'), NOW)!
    expect(mountain(row({ view_types: ['Mountain(s)'] }))).toBe(true)
    expect(mountain(row({ view_types: ['Cascade Mountains'] }))).toBe(true)
    expect(mountain(row({ view_types: ['River'] }))).toBe(false)
  })

  it('new-construction derives the year floor from now', () => {
    const match = presetMatrixMatcher(preset('new-construction'), NOW)!
    expect(match(row({ year_built: 2026 }))).toBe(true)
    expect(match(row({ year_built: 2024 }))).toBe(true)
    expect(match(row({ year_built: 2023 }))).toBe(false)
    expect(match(row({ year_built: null }))).toBe(false)
  })

  it('acreage presets are null-guarded on lot size', () => {
    const match = presetMatrixMatcher(preset('acreage-5'), NOW)!
    expect(match(row({ lot_size_acres: 5 }))).toBe(true)
    expect(match(row({ lot_size_acres: 4.9 }))).toBe(false)
    expect(match(row({ lot_size_acres: null }))).toBe(false)
  })

  it('feature booleans require the promoted *_yn to be true', () => {
    expect(presetMatrixMatcher(preset('with-pool'), NOW)!(row({ pool_yn: true }))).toBe(true)
    expect(presetMatrixMatcher(preset('with-pool'), NOW)!(row({ pool_yn: null }))).toBe(false)
    expect(presetMatrixMatcher(preset('with-fireplace'), NOW)!(row({ fireplace_yn: true }))).toBe(true)
    expect(presetMatrixMatcher(preset('with-fireplace'), NOW)!(row())).toBe(false)
  })
})

describe('buildSearchMatrix — emission threshold + depth gate', () => {
  const presets = [preset('under-1m'), preset('multi-family')]

  it('emits a combo only when count >= minActive AND depth content exists', () => {
    const rows = [
      row({ subdivision_lower: 'test acres', list_price: 800_000 }),
      row({ subdivision_lower: 'test acres', list_price: 800_000, property_type: 'C' }),
      row({ subdivision_lower: 'other place', list_price: 700_000 }),
    ]
    const geos = [
      geo(),
      geo({ areaSlug: 'other-place', subdivisionNamesLower: ['other place'], hasDepthContent: false }),
    ]
    const { entries, countByPath } = buildSearchMatrix(rows, geos, { presets, now: NOW })
    expect(entries.map((e) => e.path)).toEqual([
      '/homes-for-sale/bend/test-acres/multi-family',
      '/homes-for-sale/bend/test-acres/under-1m',
    ])
    expect(entries.find((e) => e.presetSlug === 'under-1m')?.count).toBe(2)
    expect(entries.find((e) => e.presetSlug === 'multi-family')?.count).toBe(1)
    // The depth-less geo is still verified (countByPath) — just not submitted.
    expect(countByPath.get('/homes-for-sale/bend/other-place/under-1m')).toBe(1)
    expect(countByPath.get('/homes-for-sale/bend/other-place/multi-family')).toBe(0)
  })

  it('records verified zeros in countByPath but never emits them', () => {
    const rows = [row({ subdivision_lower: 'test acres', list_price: 2_000_000 })]
    const { entries, countByPath } = buildSearchMatrix(rows, [geo()], { presets, now: NOW })
    expect(entries).toEqual([])
    expect(countByPath.get('/homes-for-sale/bend/test-acres/under-1m')).toBe(0)
  })

  it('honors a custom minActive threshold', () => {
    const rows = [
      row({ subdivision_lower: 'test acres' }),
      row({ subdivision_lower: 'test acres' }),
    ]
    const one = buildSearchMatrix(rows, [geo()], { presets: [preset('under-1m')], minActive: 3, now: NOW })
    expect(one.entries).toEqual([])
    const two = buildSearchMatrix(rows, [geo()], { presets: [preset('under-1m')], minActive: 2, now: NOW })
    expect(two.entries).toHaveLength(1)
    expect(SEARCH_MATRIX_MIN_ACTIVE).toBe(1)
  })

  it('buckets neighborhoods by exact boundary_neighborhood label + city', () => {
    const rows = [
      row({ boundary_neighborhood: 'Awbrey Butte' }),
      row({ boundary_neighborhood: 'Awbrey Butte', city_lower: 'redmond' }), // wrong city
      row({ boundary_neighborhood: 'Old Mill' }),
    ]
    const nbhd = geo({
      kind: 'neighborhood',
      areaSlug: 'awbrey-butte',
      neighborhoodName: 'Awbrey Butte',
      subdivisionNamesLower: undefined,
    })
    const { entries } = buildSearchMatrix(rows, [nbhd], { presets: [preset('under-1m')], now: NOW })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.count).toBe(1)
  })

  it('matches every subdivision alias spelling and scopes by city', () => {
    const rows = [
      row({ subdivision_lower: 'tetherow' }),
      row({ subdivision_lower: 'tetherow resort' }),
      row({ subdivision_lower: 'tetherow', city_lower: 'redmond' }), // wrong city
    ]
    const resort = geo({
      kind: 'resort',
      areaSlug: 'tetherow',
      subdivisionNamesLower: ['tetherow', 'tetherow resort'],
    })
    const { entries } = buildSearchMatrix(rows, [resort], { presets: [preset('under-1m')], now: NOW })
    expect(entries[0]!.count).toBe(2)
  })

  it('first geo wins a duplicate (city, area) pair — resolveSlug precedence', () => {
    const rows = [row({ boundary_neighborhood: 'Century West', subdivision_lower: 'century west' })]
    const nbhd = geo({
      kind: 'neighborhood',
      areaSlug: 'century-west',
      neighborhoodName: 'Century West',
      subdivisionNamesLower: undefined,
      hasDepthContent: true,
    })
    const sub = geo({
      kind: 'subdivision',
      areaSlug: 'century-west',
      subdivisionNamesLower: ['century west'],
      hasDepthContent: false,
    })
    const { entries } = buildSearchMatrix(rows, [nbhd, sub], { presets: [preset('under-1m')], now: NOW })
    // Neighborhood (listed first) wins, so the combo IS emitted despite the
    // duplicate subdivision geo carrying no depth.
    expect(entries).toHaveLength(1)
    expect(entries[0]!.path).toBe('/homes-for-sale/bend/century-west/under-1m')
  })

  it('emits stable path-sorted output and absolute sitemap URLs', () => {
    const rows = [
      row({ subdivision_lower: 'test acres' }),
      row({ subdivision_lower: 'alpha park' }),
    ]
    const geos = [
      geo(),
      geo({ areaSlug: 'alpha-park', subdivisionNamesLower: ['alpha park'] }),
    ]
    const { entries } = buildSearchMatrix(rows, geos, { presets: [preset('under-1m')], now: NOW })
    expect(entries.map((e) => e.path)).toEqual([
      '/homes-for-sale/bend/alpha-park/under-1m',
      '/homes-for-sale/bend/test-acres/under-1m',
    ])
    expect(searchMatrixSitemapUrls(entries, 'https://ryan-realty.com/')).toEqual([
      'https://ryan-realty.com/homes-for-sale/bend/alpha-park/under-1m',
      'https://ryan-realty.com/homes-for-sale/bend/test-acres/under-1m',
    ])
  })
})

describe('shouldNoIndexMatrixCombo — render-time robots decision', () => {
  it('noindexes ONLY a verified zero', () => {
    expect(shouldNoIndexMatrixCombo(0)).toBe(true)
    expect(shouldNoIndexMatrixCombo(1)).toBe(false)
    expect(shouldNoIndexMatrixCombo(12)).toBe(false)
  })

  it('fails OPEN on an unknown inventory state', () => {
    expect(shouldNoIndexMatrixCombo(null)).toBe(false)
  })
})

describe('matrixPath', () => {
  it('builds the canonical 3-segment path', () => {
    expect(matrixPath('bend', 'awbrey-butte', 'under-1m')).toBe(
      '/homes-for-sale/bend/awbrey-butte/under-1m',
    )
  })
})

// ─────────────────── W3.1: city×preset (2-segment) counts ───────────────────

describe('buildSearchMatrix — city×preset counts (W3.1)', () => {
  const NOW_W31 = new Date('2026-07-23T00:00:00Z')
  const presets = [preset('under-1m'), preset('with-pool')]

  it('counts city-wide matches per (city, preset), independent of curated geos', () => {
    const rows = [
      // both under $1M — one in the curated sub, one in an uncurated subdivision;
      // BOTH count city-wide (2-segment is city-scoped, not area-scoped).
      row({ city_lower: 'bend', subdivision_lower: 'test acres', list_price: 500_000, pool_yn: false }),
      row({ city_lower: 'bend', subdivision_lower: 'random unlisted', list_price: 600_000, pool_yn: false }),
      row({ city_lower: 'bend', subdivision_lower: null, list_price: 700_000, pool_yn: true }),
    ]
    const { countByCityPreset } = buildSearchMatrix(rows, [geo()], { presets, now: NOW_W31 })
    expect(countByCityPreset.get(cityPresetPath('bend', 'under-1m'))).toBe(3)
    expect(countByCityPreset.get(cityPresetPath('bend', 'with-pool'))).toBe(1)
  })

  it('records a VERIFIED zero (0) for a city in inventory with no matching rows → noindex', () => {
    // Culver has an under-$1M home but NO pool home.
    const rows = [row({ city_lower: 'culver', list_price: 400_000, pool_yn: false })]
    const { countByCityPreset } = buildSearchMatrix(rows, [geo()], { presets, now: NOW_W31 })
    expect(countByCityPreset.get(cityPresetPath('culver', 'with-pool'))).toBe(0)
    expect(countByCityPreset.get(cityPresetPath('culver', 'under-1m'))).toBe(1)
    // The one source of truth for BOTH the render noindex and the sitemap omit:
    expect(shouldNoIndexMatrixCombo(countByCityPreset.get(cityPresetPath('culver', 'with-pool')) ?? null)).toBe(true)
    expect(shouldNoIndexMatrixCombo(countByCityPreset.get(cityPresetPath('culver', 'under-1m')) ?? null)).toBe(false)
  })

  it('maps MLS city_lower to the canonical URL slug (la pine → la-pine)', () => {
    expect(cityLowerToSlug('la pine')).toBe('la-pine')
    const rows = [row({ city_lower: 'la pine', list_price: 400_000 })]
    const { countByCityPreset } = buildSearchMatrix(rows, [geo()], { presets, now: NOW_W31 })
    expect(countByCityPreset.get(cityPresetPath('la-pine', 'under-1m'))).toBe(1)
  })

  it('a non-serviceable city / non-derivable preset is ABSENT (fail OPEN — never noindex a live page)', () => {
    const rows = [row({ city_lower: 'bend', list_price: 400_000 })]
    const { countByCityPreset } = buildSearchMatrix(rows, [geo()], { presets, now: NOW_W31 })
    // A city not present in the inventory read → absent → unverifiable → fail open.
    expect(countByCityPreset.get(cityPresetPath('portland', 'under-1m'))).toBeUndefined()
    expect(shouldNoIndexMatrixCombo(countByCityPreset.get(cityPresetPath('portland', 'under-1m')) ?? null)).toBe(false)
  })
})
