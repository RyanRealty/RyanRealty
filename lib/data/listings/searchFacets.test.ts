import { describe, it, expect, vi, beforeEach } from 'vitest'

// Facet counts (plan §2.2 P5): the DAL must map search_facet_counts rows
// (keyed by MV column) onto registry field keys, drop non-canonical noise
// values, and page past the PostgREST 1000-row cap. Supabase + cache mocked
// per the DAL test pattern (resolveCanonicalListingKey.test.ts).
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))
vi.mock('@/lib/data/cache/unstable-cache', () => ({
  CACHE_WINDOWS: { listingTile: 60, marketPulse: 900 },
  cacheTag: { listings: 'listings' },
}))

import { getSearchFacetCounts } from './searchFacets'
import { supabaseAnon } from '@/lib/data/client'

type Row = { facet_key: string; class: string; value: string; n: number }

/** Thenable query-builder mock: records eq() calls, serves pages via range(). */
function mockSb(pages: Row[][], calls: { eq: [string, string][] } = { eq: [] }) {
  let pageIndex = 0
  const builder = {
    select: () => builder,
    eq: (col: string, value: string) => {
      calls.eq.push([col, value])
      return builder
    },
    order: () => builder,
    range: () => builder,
    then: (resolve: (v: { data: Row[]; error: null }) => void) => {
      const data = pages[Math.min(pageIndex, pages.length - 1)] ?? []
      pageIndex += 1
      resolve({ data, error: null })
    },
  }
  return { from: () => builder }
}

const setSb = (v: unknown) => (supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v)

describe('getSearchFacetCounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps MV-column facet rows onto registry field keys', async () => {
    setSb(
      mockSb([
        [
          { facet_key: 'property_sub_type', class: 'A', value: 'Condominium', n: 178 },
          { facet_key: 'view_types', class: 'A', value: 'Cascade Mountains', n: 795 },
          { facet_key: 'adu_yn', class: 'A', value: 'true', n: 304 },
          { facet_key: 'adu_type', class: 'A', value: 'Detached', n: 250 },
          { facet_key: 'zoning', class: 'D', value: 'EFU', n: 41 },
        ],
      ]),
    )
    const rows = await getSearchFacetCounts()
    expect(rows).toContainEqual({ field: 'propertySubTypes', value: 'Condominium', class: 'A', n: 178 })
    expect(rows).toContainEqual({ field: 'viewTypes', value: 'Cascade Mountains', class: 'A', n: 795 })
    expect(rows).toContainEqual({ field: 'adu', value: 'true', class: 'A', n: 304 })
    expect(rows).toContainEqual({ field: 'aduType', value: 'Detached', class: 'A', n: 250 })
    expect(rows).toContainEqual({ field: 'zoning', value: 'EFU', class: 'D', n: 41 })
  })

  it('drops values outside the registry option vocabulary (data noise never renders)', async () => {
    setSb(
      mockSb([
        [
          { facet_key: 'flooring', class: 'A', value: 'Hardwood', n: 500 },
          { facet_key: 'flooring', class: 'A', value: 'None', n: 12 },
          { facet_key: 'flooring', class: 'A', value: '********', n: 3 },
        ],
      ]),
    )
    const rows = await getSearchFacetCounts()
    expect(rows).toEqual([{ field: 'flooring', value: 'Hardwood', class: 'A', n: 500 }])
  })

  it('single-value boolean predicates over shared array columns get counts too', async () => {
    setSb(
      mockSb([
        [
          // ownerWillCarry = containsAll listing_terms ['Owner Will Carry'] —
          // the same row also serves the listingTerms multi option.
          { facet_key: 'listing_terms', class: 'A', value: 'Owner Will Carry', n: 44 },
          // singleLevel = eqValue levels 'One' — same row serves levelsOptions.
          { facet_key: 'levels', class: 'A', value: 'One', n: 2100 },
        ],
      ]),
    )
    const rows = await getSearchFacetCounts()
    expect(rows).toContainEqual({ field: 'listingTerms', value: 'Owner Will Carry', class: 'A', n: 44 })
    expect(rows).toContainEqual({ field: 'ownerWillCarry', value: 'true', class: 'A', n: 44 })
    expect(rows).toContainEqual({ field: 'levelsOptions', value: 'One', class: 'A', n: 2100 })
    expect(rows).toContainEqual({ field: 'singleLevel', value: 'true', class: 'A', n: 2100 })
  })

  it('scopes to one class via eq(class) when requested', async () => {
    const calls: { eq: [string, string][] } = { eq: [] }
    setSb(mockSb([[{ facet_key: 'county', class: 'A', value: 'Deschutes', n: 4000 }]], calls))
    const rows = await getSearchFacetCounts({ class: 'A' })
    expect(calls.eq).toContainEqual(['class', 'A'])
    expect(rows).toContainEqual({ field: 'county', value: 'Deschutes', class: 'A', n: 4000 })
  })

  it('pages past the 1000-row PostgREST cap until a short page', async () => {
    const fullPage: Row[] = Array.from({ length: 1000 }, (_, i) => ({
      facet_key: 'county',
      class: 'A',
      value: i === 0 ? 'Deschutes' : `Noise ${i}`, // only 1 canonical option per page
      n: 1,
    }))
    const shortPage: Row[] = [{ facet_key: 'county', class: 'D', value: 'Crook', n: 7 }]
    setSb(mockSb([fullPage, shortPage]))
    const rows = await getSearchFacetCounts()
    // Two pages fetched: canonical values from both survive.
    expect(rows).toContainEqual({ field: 'county', value: 'Deschutes', class: 'A', n: 1 })
    expect(rows).toContainEqual({ field: 'county', value: 'Crook', class: 'D', n: 7 })
  })

  it('returns [] when the client is unavailable', async () => {
    setSb(null)
    expect(await getSearchFacetCounts()).toEqual([])
  })
})
