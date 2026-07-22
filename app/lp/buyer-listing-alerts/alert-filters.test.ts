import { describe, it, expect } from 'vitest'
import {
  buildBuyerAlertFilterSets,
  BUYER_LP_SEARCH_AREAS,
  MAX_LP_ALERTS_PER_SUBMISSION,
} from './alert-filters'
import { getSavedSearchHash, hasNarrowingFilter } from '@/lib/search-filters'

describe('BUYER_LP_SEARCH_AREAS', () => {
  it('maps every geographic area to exactly one canonical predicate', () => {
    for (const area of BUYER_LP_SEARCH_AREAS) {
      if (area.slug === 'other') {
        expect(area.filter).toBeNull()
        continue
      }
      const keys = Object.keys(area.filter ?? {})
      expect(keys).toHaveLength(1)
      expect(['neighborhoodSlug', 'city']).toContain(keys[0])
    }
  })

  it('uses MLS city spellings for the outlying towns', () => {
    const laPine = BUYER_LP_SEARCH_AREAS.find((a) => a.slug === 'la-pine')
    expect(laPine?.filter).toEqual({ city: 'La Pine' })
  })
})

describe('buildBuyerAlertFilterSets', () => {
  it('creates one set per selected area, each carrying the shared budget and beds', () => {
    const sets = buildBuyerAlertFilterSets({
      budgetMin: 400_000,
      budgetMax: 600_000,
      bedsMin: 3,
      searchAreas: ['tetherow', 'redmond'],
    })
    expect(sets).toHaveLength(2)
    expect(sets[0].filters).toEqual({
      neighborhoodSlug: 'tetherow',
      minPrice: 400_000,
      maxPrice: 600_000,
      beds: 3,
    })
    expect(sets[1].filters).toEqual({
      city: 'Redmond',
      minPrice: 400_000,
      maxPrice: 600_000,
      beds: 3,
    })
    for (const set of sets) {
      expect(hasNarrowingFilter(set.filters)).toBe(true)
      expect(set.filtersHash).toMatch(/^s_/)
      expect(set.name.length).toBeGreaterThan(0)
    }
  })

  it('hashes identically to the guest /search capture path for the same filters', () => {
    const [set] = buildBuyerAlertFilterSets({ budgetMax: 900_000, searchAreas: ['sunriver'] })
    expect(set.filtersHash).toBe(
      getSavedSearchHash({ neighborhoodSlug: 'sunriver', maxPrice: 900_000 }),
    )
  })

  it('falls back to one geography-free set when only "other" or unknown areas are picked', () => {
    const sets = buildBuyerAlertFilterSets({
      budgetMin: 500_000,
      searchAreas: ['other', 'not-a-real-slug'],
    })
    expect(sets).toHaveLength(1)
    expect(sets[0].filters).toEqual({ minPrice: 500_000 })
  })

  it('creates geography-only sets when no budget or beds were given', () => {
    const sets = buildBuyerAlertFilterSets({ searchAreas: ['bend-river-west'] })
    expect(sets).toHaveLength(1)
    expect(sets[0].filters).toEqual({ neighborhoodSlug: 'bend-river-west' })
    expect(sets[0].name).toBe('River West homes')
  })

  it('returns [] when nothing narrows the feed (never a whole-MLS alert)', () => {
    expect(buildBuyerAlertFilterSets({})).toEqual([])
    expect(buildBuyerAlertFilterSets({ searchAreas: ['other'] })).toEqual([])
    expect(buildBuyerAlertFilterSets({ budgetMin: -5, bedsMin: 0 })).toEqual([])
  })

  it('drops non-finite and non-positive numbers', () => {
    const sets = buildBuyerAlertFilterSets({
      budgetMin: Number.NaN,
      budgetMax: 0,
      bedsMin: 2.9,
      searchAreas: ['sisters'],
    })
    expect(sets).toHaveLength(1)
    expect(sets[0].filters).toEqual({ city: 'Sisters', beds: 2 })
  })

  it('dedupes repeated areas', () => {
    const sets = buildBuyerAlertFilterSets({
      budgetMax: 700_000,
      searchAreas: ['tetherow', 'tetherow', ' TETHEROW '],
    })
    expect(sets).toHaveLength(1)
  })

  it('caps the number of alerts per submission', () => {
    const allGeos = BUYER_LP_SEARCH_AREAS.filter((a) => a.filter).map((a) => a.slug)
    expect(allGeos.length).toBeGreaterThan(MAX_LP_ALERTS_PER_SUBMISSION)
    const sets = buildBuyerAlertFilterSets({ budgetMax: 800_000, searchAreas: allGeos })
    expect(sets).toHaveLength(MAX_LP_ALERTS_PER_SUBMISSION)
  })
})
