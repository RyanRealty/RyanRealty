/**
 * The static-safe URL query store (SITE-29): normalization, publish-on-change,
 * subscription lifecycle, and the navigate helper's two modes. No DOM: the
 * hook and the bridge are React and run in the browser; the store under them
 * is plain state and is what these tests pin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  navigateQuery,
  normalizeSearch,
  publishUrlSearchParams,
  readUrlSearchParams,
  resetUrlSearchParamsForTests,
  subscribeUrlSearchParams,
} from './url-search-params.client'

describe('normalizeSearch', () => {
  it('drops a leading ? and treats empty as empty', () => {
    expect(normalizeSearch('?a=1&b=2')).toBe('a=1&b=2')
    expect(normalizeSearch('a=1')).toBe('a=1')
    expect(normalizeSearch('')).toBe('')
    expect(normalizeSearch(null)).toBe('')
    expect(normalizeSearch(undefined)).toBe('')
  })
})

describe('store', () => {
  beforeEach(() => resetUrlSearchParamsForTests())
  afterEach(() => resetUrlSearchParamsForTests())

  it('reads empty on the server (no window)', () => {
    expect(readUrlSearchParams()).toBe('')
  })

  it('publishes to subscribers only when the query changes', () => {
    const seen: string[] = []
    const off = subscribeUrlSearchParams(() => seen.push(readUrlSearchParams()))
    publishUrlSearchParams('?minPrice=500000')
    publishUrlSearchParams('minPrice=500000') // same value, different spelling
    publishUrlSearchParams('?minPrice=600000')
    off()
    publishUrlSearchParams('?minPrice=700000') // unsubscribed
    expect(seen).toEqual(['minPrice=500000', 'minPrice=600000'])
    expect(readUrlSearchParams()).toBe('minPrice=700000')
  })
})

describe('navigateQuery', () => {
  it('uses the router on a dynamic page', () => {
    const router = { push: vi.fn(), replace: vi.fn() }
    navigateQuery(router, '/search?beds=3')
    navigateQuery(router, '/search?beds=4', { replace: true })
    expect(router.push).toHaveBeenCalledWith('/search?beds=3', { scroll: false })
    expect(router.replace).toHaveBeenCalledWith('/search?beds=4', { scroll: false })
  })

  it('falls back to the router when staticShell is set but there is no window', () => {
    // Server-side call on a static shell never happens in practice; the
    // helper still must not throw and must not touch history.
    const router = { push: vi.fn(), replace: vi.fn() }
    navigateQuery(router, '/cities/bend?beds=3', { staticShell: true })
    expect(router.push).toHaveBeenCalledWith('/cities/bend?beds=3', { scroll: false })
  })
})
