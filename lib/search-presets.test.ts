import { describe, it, expect } from 'vitest'
import {
  getPresetBySlug,
  isPresetSlug,
  getAllPresetSlugs,
  resolveViewContainsValues,
  viewContainsMatchesValues,
  __VIEW_TYPE_VOCABULARY_FOR_TESTS,
  SEARCH_PRESETS,
} from './search-presets'
import { searchFieldByKey } from './search/field-registry'

describe('search-presets', () => {
  describe('getPresetBySlug', () => {
    it('returns preset for valid slug', () => {
      const preset = getPresetBySlug('under-500k')
      expect(preset).not.toBeNull()
      expect(preset!.label).toBe('Homes Under $500,000')
      expect(preset!.params.maxPrice).toBe(500_000)
    })

    it('returns preset for luxury', () => {
      const preset = getPresetBySlug('luxury')
      expect(preset).not.toBeNull()
      expect(preset!.params.minPrice).toBe(1_000_000)
    })

    it('returns preset for pending', () => {
      const preset = getPresetBySlug('pending')
      expect(preset).not.toBeNull()
      expect(preset!.params.statusFilter).toBe('pending')
    })

    it('returns preset for new-listings', () => {
      const preset = getPresetBySlug('new-listings')
      expect(preset).not.toBeNull()
      expect(preset!.params.newListingsDays).toBe(7)
    })

    it('returns preset for with-pool', () => {
      const preset = getPresetBySlug('with-pool')
      expect(preset).not.toBeNull()
      expect(preset!.params.hasPool).toBe(true)
    })

    it('returns null for invalid slug', () => {
      expect(getPresetBySlug('not-a-preset')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(getPresetBySlug('')).toBeNull()
    })

    it('returns null for null-like input', () => {
      expect(getPresetBySlug(null as unknown as string)).toBeNull()
    })

    it('is case-insensitive', () => {
      const preset = getPresetBySlug('Under-500K')
      expect(preset).not.toBeNull()
    })
  })

  describe('isPresetSlug', () => {
    it('returns true for valid preset slugs', () => {
      expect(isPresetSlug('under-300k')).toBe(true)
      expect(isPresetSlug('luxury')).toBe(true)
      expect(isPresetSlug('pending')).toBe(true)
    })

    it('returns false for invalid slugs', () => {
      expect(isPresetSlug('not-a-preset')).toBe(false)
      expect(isPresetSlug('')).toBe(false)
    })
  })

  describe('getAllPresetSlugs', () => {
    it('returns all preset slugs', () => {
      const slugs = getAllPresetSlugs()
      expect(slugs.length).toBe(SEARCH_PRESETS.length)
      expect(slugs).toContain('under-500k')
      expect(slugs).toContain('luxury')
      expect(slugs).toContain('pending')
      expect(slugs).toContain('new-listings')
    })
  })

  describe('SEARCH_PRESETS', () => {
    it('has unique slugs', () => {
      const slugs = SEARCH_PRESETS.map((p) => p.slug)
      const unique = new Set(slugs)
      expect(unique.size).toBe(slugs.length)
    })

    it('has at least 15 presets', () => {
      expect(SEARCH_PRESETS.length).toBeGreaterThanOrEqual(15)
    })

    it('every preset has label, shortLabel, and params', () => {
      for (const preset of SEARCH_PRESETS) {
        expect(preset.label).toBeTruthy()
        expect(preset.shortLabel).toBeTruthy()
        expect(preset.params).toBeDefined()
      }
    })
  })

  describe('sub-type presets (plan §4.4 value-set contract, 2026-07-30)', () => {
    it('condos carries exactly {Condominium}', () => {
      expect(getPresetBySlug('condos')!.params.propertySubTypes).toEqual(['Condominium'])
    })

    it('townhomes carries exactly {Townhouse}', () => {
      expect(getPresetBySlug('townhomes')!.params.propertySubTypes).toEqual(['Townhouse'])
    })

    it('manufactured carries all three manufactured sub types (§4.3 defect-1 fix)', () => {
      // Pins the VALUE SET, not the result count (§4.8.3). The In Park /
      // On Leased Land values are the class-B inventory the old substring
      // param missed (308 of 895 listings).
      expect(getPresetBySlug('manufactured')!.params.propertySubTypes).toEqual([
        'Manufactured On Land',
        'In Park',
        'On Leased Land',
      ])
    })

    it('duplex carries exactly {Duplex}', () => {
      expect(getPresetBySlug('duplex')!.params.propertySubTypes).toEqual(['Duplex'])
    })

    it('triplex carries exactly {Triplex}', () => {
      expect(getPresetBySlug('triplex')!.params.propertySubTypes).toEqual(['Triplex'])
    })

    it('fourplex carries exactly {Quadruplex} (buyer slug, canonical feed value)', () => {
      expect(getPresetBySlug('fourplex')!.params.propertySubTypes).toEqual(['Quadruplex'])
    })

    it('residential-lots carries exactly {Residential Lots}', () => {
      expect(getPresetBySlug('residential-lots')!.params.propertySubTypes).toEqual(['Residential Lots'])
    })

    it('no preset carries the legacy substring-era propertySubType scalar', () => {
      for (const preset of SEARCH_PRESETS) {
        expect(preset.params.propertySubType, preset.slug).toBeUndefined()
      }
    })
  })
})

/**
 * viewContains resolution. Each expected value set was verified against live
 * inventory 2026-07-31 (listing_search_mv, standard_status IN
 * ('Active','Active Under Contract'), service-area cities) to return EXACTLY
 * the rows the legacy `view_text ILIKE '%term%'` predicate returns — 0 rows
 * matched by one test and not the other.
 *
 * If a vocabulary edit changes one of these sets, the equivalence is no longer
 * the measured one and these tests fail on purpose. Re-measure before updating.
 *
 * `activeRows` is the count at measurement time, recorded for provenance —
 * live inventory moves (mountain went 1,086 -> 1,087 within the hour), so it is
 * documentation. Only `values` is asserted.
 */
const MEASURED_VIEW_TERMS = {
  Mountain: { values: ['Mountain(s)', 'Cascade Mountains'], activeRows: 1086 },
  River: { values: ['River'], activeRows: 124 },
  Golf: { values: ['Golf Course'], activeRows: 207 },
  Lake: { values: ['Lake'], activeRows: 51 },
  Water: { values: ['Lake', 'River', 'Pond', 'Creek/Stream', 'Ocean', 'Bay', 'Beach'], activeRows: 332 },
} as const

describe('resolveViewContainsValues', () => {
  for (const [term, expected] of Object.entries(MEASURED_VIEW_TERMS)) {
    it(`resolves '${term}' to the measured value set (${expected.activeRows} active rows at measurement)`, () => {
      const resolved = resolveViewContainsValues(term)
      expect(resolved).not.toBeNull()
      expect([...resolved!].sort()).toEqual([...expected.values].sort())
    })
  }

  it('is case-insensitive and trims', () => {
    expect(resolveViewContainsValues('  mOuNtAiN ')).toEqual(resolveViewContainsValues('Mountain'))
  })

  it('returns null for an unknown term so the caller keeps legacy routing', () => {
    // null is load-bearing: advancedNeedsLegacyPath reads it as "the MV cannot
    // serve this", the only thing standing between an unknown term and a
    // silently unfiltered search.
    expect(resolveViewContainsValues('zzz-not-a-view')).toBeNull()
    expect(resolveViewContainsValues('')).toBeNull()
    expect(resolveViewContainsValues(null)).toBeNull()
    expect(resolveViewContainsValues(undefined)).toBeNull()
  })

  it('resolves a partial vocabulary term a URL can carry', () => {
    expect(resolveViewContainsValues('Cascade')).toEqual(['Cascade Mountains'])
  })

  it('resolves every viewContains term shipped by a preset', () => {
    // An unresolvable preset term is the defect this vocabulary fixes: it routes
    // the page back to the RPC that cannot serve a no-city search.
    const terms = SEARCH_PRESETS.map((p) => p.params.viewContains).filter(
      (t): t is string => typeof t === 'string' && t.trim() !== '',
    )
    expect(terms.length).toBe(5)
    for (const term of terms) {
      expect(resolveViewContainsValues(term), `preset term '${term}'`).not.toBeNull()
    }
  })

  it('covers every registry viewTypes option (vocabulary drift guard)', () => {
    // The vocabulary is a superset of the UI facet list by design. A registry
    // option missing here would make the resolver under-report that value.
    const vocabulary = new Set(__VIEW_TYPE_VOCABULARY_FOR_TESTS)
    for (const option of searchFieldByKey('viewTypes')?.options ?? []) {
      expect(vocabulary.has(option), `registry option '${option}'`).toBe(true)
    }
  })

  it('never resolves to a value outside the vocabulary', () => {
    const vocabulary = new Set(__VIEW_TYPE_VOCABULARY_FOR_TESTS)
    for (const term of Object.keys(MEASURED_VIEW_TERMS)) {
      for (const value of resolveViewContainsValues(term) ?? []) {
        expect(vocabulary.has(value), `${term} -> ${value}`).toBe(true)
      }
    }
  })
})

describe('viewContainsMatchesValues', () => {
  it('matches a row through the resolved vocabulary', () => {
    expect(viewContainsMatchesValues('Mountain', ['Cascade Mountains', 'Territorial'])).toBe(true)
    expect(viewContainsMatchesValues('Water', ['Pond'])).toBe(true)
    expect(viewContainsMatchesValues('Lake', ['River'])).toBe(false)
  })

  it('still matches a feed value the vocabulary has not caught up to', () => {
    // Union semantics: never NARROWER than the legacy substring test, so a new
    // feed spelling cannot silently drop a row out of the sitemap matcher.
    expect(viewContainsMatchesValues('Mountain', ['Mountain Ridge'])).toBe(true)
  })

  it('is false for empty/absent view arrays', () => {
    expect(viewContainsMatchesValues('Mountain', [])).toBe(false)
    expect(viewContainsMatchesValues('Mountain', null)).toBe(false)
    expect(viewContainsMatchesValues('', ['Mountain(s)'])).toBe(false)
  })
})
