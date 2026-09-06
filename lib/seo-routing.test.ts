import { describe, expect, it } from 'vitest'
import {
  appendIndexableSearchParams,
  shouldNoIndexBlogIndex,
  shouldNoIndexSearchVariant,
} from './seo-routing'

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
    expect(shouldNoIndexSearchVariant({ view: 'map' })).toBe(true)
    expect(shouldNoIndexSearchVariant({ bbox: '-121.4,44.0,-121.2,44.1' })).toBe(true)
  })

  it('ignores empty filter values', () => {
    expect(shouldNoIndexSearchVariant({ minPrice: '' })).toBe(false)
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
