import { describe, expect, it } from 'vitest'
import {
  appendIndexableSearchParams,
  shouldNoIndexBlogIndex,
  shouldNoIndexSearchVariant,
  SEARCH_CANONICAL_STRIP_KEYS,
} from './seo-routing'
import { ALL_SEARCH_URL_PARAMS } from './search/field-registry'

describe('shouldNoIndexSearchVariant', () => {
  it('returns false for canonical search page', () => {
    expect(shouldNoIndexSearchVariant({})).toBe(false)
  })

  it('returns true for paginated search pages', () => {
    expect(shouldNoIndexSearchVariant({ page: '2' })).toBe(true)
  })

  it('returns true when any filter is present', () => {
    expect(shouldNoIndexSearchVariant({ minPrice: '800000' })).toBe(true)
    expect(shouldNoIndexSearchVariant({ statusFilter: 'pending' })).toBe(true)
    expect(shouldNoIndexSearchVariant({ view: 'map', minPrice: '800000' })).toBe(true)
  })

  // gsc-trend-5 (2026-09-23): the map writes ?bbox= on its first settle via
  // router.replace, which re-runs metadata. A camera key that noindexed turned
  // /homes-for-sale/bend into "Excluded by 'noindex' tag" in Search Console.
  // The canonical strips both keys; that is the consolidation signal.
  it('does NOT noindex camera-only variants (view, bbox)', () => {
    expect(shouldNoIndexSearchVariant({ view: 'map' })).toBe(false)
    expect(shouldNoIndexSearchVariant({ view: 'split' })).toBe(false)
    expect(shouldNoIndexSearchVariant({ bbox: '-121.4,44.0,-121.2,44.1' })).toBe(false)
    expect(shouldNoIndexSearchVariant({ view: 'list', bbox: '-121.4,44.0,-121.2,44.1' })).toBe(false)
  })

  it('ignores empty filter values', () => {
    expect(shouldNoIndexSearchVariant({ minPrice: '' })).toBe(false)
  })

  // SITE-215 (2026-10-13): /homes-for-sale/bend?newConstruction=1 (172 GSC
  // impressions at position 68, 09-28..10-09) and
  // /homes-for-sale/<city>?propertySubTypes=<type> (173 of the class's 292
  // impressions 08-15..09-11) were indexed as pages of their own because the
  // keys the slug route reads were not on the noindex list.
  it('noindexes every result-set key the slug route reads', () => {
    for (const key of [
      'newConstruction',
      'propertySubTypes',
      'gatedCommunity',
      'hasGolfCourse',
      'hasFireplace',
      'daysOnMarket',
      'poly',
      'shapes',
    ]) {
      expect(shouldNoIndexSearchVariant({ [key]: '1' }), key).toBe(true)
    }
  })

  it('noindexes every URL param the search field registry can write', () => {
    expect(ALL_SEARCH_URL_PARAMS.length).toBeGreaterThan(50)
    for (const key of ALL_SEARCH_URL_PARAMS) {
      expect(shouldNoIndexSearchVariant({ [key]: '1' }), key).toBe(true)
    }
  })

  it('keeps the camera keys out of the registry and off the list', () => {
    for (const key of SEARCH_CANONICAL_STRIP_KEYS) {
      expect(ALL_SEARCH_URL_PARAMS).not.toContain(key)
      expect(shouldNoIndexSearchVariant({ [key]: 'list' })).toBe(false)
    }
  })
})

describe('appendIndexableSearchParams', () => {
  it('drops view and bbox from the canonical URL', () => {
    const url = new URL('https://ryan-realty.com/homes-for-sale')
    appendIndexableSearchParams(url, {
      view: 'list',
      bbox: '-121.4,44.0,-121.2,44.1',
      city: 'Bend',
      minPrice: '500000',
    })
    expect(url.searchParams.get('view')).toBeNull()
    expect(url.searchParams.get('bbox')).toBeNull()
    expect(url.searchParams.get('city')).toBe('Bend')
    expect(url.searchParams.get('minPrice')).toBe('500000')
  })

  it('leaves a clean /homes-for-sale when only view or bbox are present', () => {
    const url = new URL('https://ryan-realty.com/homes-for-sale')
    appendIndexableSearchParams(url, { view: 'split', bbox: '1,2,3,4' })
    expect(url.search).toBe('')
  })
})

describe('shouldNoIndexBlogIndex', () => {
  it('returns false for canonical blog index', () => {
    expect(shouldNoIndexBlogIndex({})).toBe(false)
  })

  it('returns true for paginated blog index', () => {
    expect(shouldNoIndexBlogIndex({ page: '3' })).toBe(true)
  })

  it('returns true for category-filtered blog index', () => {
    expect(shouldNoIndexBlogIndex({ category: 'Market Updates' })).toBe(true)
  })

  it('keeps All category indexable', () => {
    expect(shouldNoIndexBlogIndex({ category: 'All' })).toBe(false)
  })
})
