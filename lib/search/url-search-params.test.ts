/**
 * The static-safe URL query store (SITE-29): normalization, publish-on-change,
 * subscription lifecycle, and the navigate helper's two modes. No DOM: the
 * hook and the bridge are React and run in the browser; the store under them
 * is plain state and is what these tests pin.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  navigateQuery,
  normalizeSearch,
  publishFromRouter,
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

describe('the root bridge', () => {
  beforeEach(() => resetUrlSearchParamsForTests())
  afterEach(() => {
    resetUrlSearchParamsForTests()
    vi.unstubAllGlobals()
  })

  it('publishes the address bar, not a router copy still waiting on the server', () => {
    // A filter write put maxPrice in the address bar and the store; the
    // router's useSearchParams() still holds the old empty query.
    vi.stubGlobal('window', { location: { search: '?maxPrice=750000' } })
    publishUrlSearchParams('?maxPrice=750000')
    publishFromRouter('')
    expect(readUrlSearchParams()).toBe('maxPrice=750000')
  })

  it('carries a navigation the router made into the store', () => {
    vi.stubGlobal('window', { location: { search: '?beds=3' } })
    publishUrlSearchParams('?maxPrice=750000')
    publishFromRouter('beds=3')
    expect(readUrlSearchParams()).toBe('beds=3')
  })

  it("uses the router's query where there is no window", () => {
    publishFromRouter('beds=4')
    expect(readUrlSearchParams()).toBe('beds=4')
  })

  it('is what the bridge calls', () => {
    const src = readFileSync(resolve('lib/search/url-search-params.client.tsx'), 'utf8')
    const bridge = src.slice(src.indexOf('function Bridge()'), src.indexOf('export function UrlSearchParamsBridge'))
    expect(bridge).toMatch(/publishFromRouter\(search\)/)
    expect(bridge).not.toMatch(/publishUrlSearchParams\(/)
  })
})
