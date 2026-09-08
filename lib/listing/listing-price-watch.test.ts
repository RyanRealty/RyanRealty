import { describe, expect, it } from 'vitest'
import {
  buildSearchUrlFromFilters,
  getFilterNameFallback,
  getFiltersSummary,
  getSavedSearchHash,
  hasNarrowingFilter,
  normalizeSavedSearchFilters,
  savedFiltersToAdvanced,
  watchedListingKey,
} from '@/lib/search-filters'

/**
 * SITE-06 — the single-home price watch, at the level where it is dangerous.
 *
 * The mechanism stores a listing key in the SAME jsonb column as saved-search
 * criteria. That is only safe because two things hold together: the key
 * survives normalization (or the row would be an empty filter set), and it
 * never reaches the search matcher (which has no exact-key predicate and would
 * therefore match the whole feed). The second half is a short-circuit in
 * `runListingAlerts`; this file pins the first half and proves the matcher
 * never sees the key even if the short-circuit were removed.
 */

const KEY = '20260117205712788271000000'

describe('listingKey as a saved filter', () => {
  it('survives normalization', () => {
    expect(normalizeSavedSearchFilters({ listingKey: KEY })).toEqual({ listingKey: KEY })
  })

  it('is read back by exactly one accessor', () => {
    expect(watchedListingKey({ listingKey: KEY })).toBe(KEY)
    expect(watchedListingKey({ city: 'Bend' })).toBeNull()
    expect(watchedListingKey({})).toBeNull()
  })

  it('COUNTS as a narrowing filter — one home is the narrowest filter there is', () => {
    // Without this the capture is refused with "Add a filter", and the engine's
    // empty-filter guard would skip the row on every run.
    expect(hasNarrowingFilter({ listingKey: KEY })).toBe(true)
  })

  it('hashes to its own row, distinct from any search', () => {
    const watch = getSavedSearchHash({ listingKey: KEY })
    expect(watch).not.toBe(getSavedSearchHash({ city: 'Bend' }))
    expect(watch).not.toBe(getSavedSearchHash({ listingKey: 'ANOTHERKEY1234' }))
    expect(getSavedSearchHash({ listingKey: KEY })).toBe(watch)
  })

  it('is NEVER handed to the search matcher', () => {
    // savedFiltersToAdvanced is what getCachedSearchListings consumes. It has no
    // exact-key predicate, so if the key leaked through as some other field the
    // match would silently widen. Nothing in the advanced shape carries it.
    const advanced = savedFiltersToAdvanced({ listingKey: KEY }) as Record<string, unknown>
    expect(JSON.stringify(advanced)).not.toContain(KEY)
    expect(Object.entries(advanced).filter(([, v]) => v != null)).toEqual([['sort', 'newest']])
  })

  it('links to the home, not to a search carrying a param no page reads', () => {
    expect(buildSearchUrlFromFilters({ listingKey: KEY })).toBe(
      `/homes-for-sale/listing/${KEY}`,
    )
  })

  it('describes itself in English on the row and in the email', () => {
    expect(getFiltersSummary({ listingKey: KEY })).toBe('One home you asked us to watch')
    expect(getFilterNameFallback({ listingKey: KEY })).toBe('One home you asked us to watch')
  })

  it('leaves ordinary saved searches exactly as they were', () => {
    const filters = { city: 'Bend', minPrice: 500000, maxPrice: 900000, beds: 3 }
    expect(normalizeSavedSearchFilters(filters)).toEqual(filters)
    expect(getFiltersSummary(filters)).toContain('Bend')
    expect(buildSearchUrlFromFilters(filters)).toContain('/homes-for-sale/bend')
    expect(watchedListingKey(filters)).toBeNull()
  })
})
