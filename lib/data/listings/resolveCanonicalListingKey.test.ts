import { describe, it, expect, vi, beforeEach } from 'vitest'

// DAL critical path (audit p3.2). Pretty URLs carry the MLS ListNumber but every
// related table is keyed by RETS ListingKey; resolving wrong silently returns
// nothing (broken photos/videos/history). Lock the ListNumber-first -> ListingKey
// -> input-unchanged resolution. Supabase + cache mocked.
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))
vi.mock('@/lib/data/cache/unstable-cache', () => ({
  CACHE_WINDOWS: { listingTile: 60 },
  cacheTag: { listings: 'listings' },
}))

import { resolveCanonicalListingKey } from './resolveCanonicalListingKey'
import { supabaseAnon } from '@/lib/data/client'

const mockSb = (opts: { byListNumber?: unknown; byListingKey?: unknown }) => ({
  from: () => ({
    select: () => ({
      eq: (col: string) => ({
        maybeSingle: async () => ({
          data:
            col === 'ListNumber'
              ? (opts.byListNumber ?? null)
              : col === 'ListingKey'
                ? (opts.byListingKey ?? null)
                : null,
        }),
      }),
    }),
  }),
})

const setSb = (v: unknown) => (supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v)

describe('resolveCanonicalListingKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves a ListNumber (pretty-URL case) to its ListingKey', async () => {
    setSb(mockSb({ byListNumber: { ListingKey: 'RK-999' } }))
    expect(await resolveCanonicalListingKey('220189422')).toBe('RK-999')
  })

  it('falls back to a direct ListingKey match when the ListNumber misses', async () => {
    setSb(mockSb({ byListNumber: null, byListingKey: { ListingKey: 'RK-555' } }))
    expect(await resolveCanonicalListingKey('RK-555')).toBe('RK-555')
  })

  it('returns the trimmed input unchanged when neither matches (a genuine key still works)', async () => {
    setSb(mockSb({}))
    expect(await resolveCanonicalListingKey('  RK-NEW  ')).toBe('RK-NEW')
  })

  it('returns the trimmed input when the client is unavailable', async () => {
    setSb(null)
    expect(await resolveCanonicalListingKey('  220189422  ')).toBe('220189422')
  })
})
