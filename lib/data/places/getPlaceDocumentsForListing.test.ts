import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))
vi.mock('@/lib/data/cache/unstable-cache', () => ({
  CACHE_WINDOWS: { marketStats: 60 },
  cacheTag: { market: 'market' },
}))

import { getPlaceDocumentsForListing } from './getPlaceDocumentsForListing'
import { supabaseAnon } from '@/lib/data/client'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'

type Filters = Record<string, string>
type Reply = { data: unknown; error: { code?: string; message: string } | null }

const calls: Filters[] = []

/**
 * One recorded declaration, as the join returns it. `id` is the instrument, so
 * two rows carrying the same id are the same document reached through two plats.
 */
function doc(id: string, ref: string) {
  return {
    id,
    source: 'deschutes_county_title',
    published_name: 'Evergreen Park',
    doc_kind: 'ccr',
    recording_ref: ref,
    recording_type: 'book-page',
    book: 182,
    page: 360,
    instrument_number: null,
    recording_year: null,
    publisher: null,
    document_date: null,
    county: 'Deschutes',
    storage_path: `deschutes/evergreen-park/${ref}.pdf`,
    file_bytes: 1024,
    page_count: 12,
  }
}

function setSb(reply: (filters: Filters) => Reply) {
  const from = vi.fn(() => ({
    select: vi.fn(() => {
      const filters: Filters = {}
      const chain: Record<string, unknown> = {
        eq: vi.fn((k: string, v: string) => {
          filters[k] = v
          return chain
        }),
        then: (ok: (r: Reply) => unknown, bad: (e: unknown) => unknown) => {
          calls.push({ ...filters })
          return Promise.resolve(reply(filters)).then(ok, bad)
        },
      }
      return chain
    }),
  }))
  ;(supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from })
  return from
}

describe('getPlaceDocumentsForListing', () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
  })

  it('returns nothing for a blank label without touching the client', async () => {
    setSb(() => ({ data: [], error: null }))
    expect(await getPlaceDocumentsForListing('   ')).toBeNull()
    expect(supabaseAnon).not.toHaveBeenCalled()
  })

  it('matches the plat by label, so a suffixed slug no longer has to be guessed', async () => {
    setSb((f) =>
      f.geo_label === 'Evergreen Park'
        ? { data: [{ geo_slug: 'evergreen-park-07114', match_method: 'exact', place_document: doc('d1', '182-360') }], error: null }
        : { data: [], error: null },
    )
    const out = await getPlaceDocumentsForListing('Evergreen Park')
    expect(out?.geoSlug).toBe('evergreen-park-07114')
    expect(out?.platName).toBe('Evergreen Park')
    expect(out?.documents.map((d) => d.id)).toEqual(['d1'])
    // The label answered; the slug read never ran.
    expect(calls).toHaveLength(1)
    expect(calls[0].geo_label).toBe('Evergreen Park')
    expect(calls[0].status).toBe('published')
  })

  it('shows one instrument once when a label names more than one plat', async () => {
    setSb(() => ({
      data: [
        { geo_slug: 'evergreen-park-07114', match_method: 'exact', place_document: doc('d1', '182-360') },
        { geo_slug: 'evergreen-park', match_method: 'exact', place_document: doc('d1', '182-360') },
      ],
      error: null,
    }))
    const out = await getPlaceDocumentsForListing('Evergreen Park')
    expect(out?.documents.map((d) => d.id)).toEqual(['d1'])
    // Deterministic destination for "see the plat" when the label is shared.
    expect(out?.geoSlug).toBe('evergreen-park')
  })

  it('falls back to the slug path while the geo_label column does not exist yet', async () => {
    setSb((f) => {
      if (f.geo_label !== undefined) return { data: null, error: { code: '42703', message: 'column place_document_link.geo_label does not exist' } }
      return f.geo_slug === '919-bond-condominiums'
        ? { data: [{ match_method: 'exact', place_document: doc('d9', '2007-36361') }], error: null }
        : { data: [], error: null }
    })
    const out = await getPlaceDocumentsForListing('919 Bond Condominiums')
    expect(out?.geoSlug).toBe('919-bond-condominiums')
    expect(out?.documents.map((d) => d.id)).toEqual(['d9'])
    expect(calls.map((c) => c.geo_label ?? c.geo_slug)).toEqual([
      '919 Bond Condominiums',
      '919-bond-condominiums',
    ])
  })

  it('falls back to the slug path for a link row the backfill has not stamped', async () => {
    setSb((f) =>
      f.geo_slug === '919-bond-condominiums'
        ? { data: [{ match_method: 'exact', place_document: doc('d9', '2007-36361') }], error: null }
        : { data: [], error: null },
    )
    const out = await getPlaceDocumentsForListing('919 Bond Condominiums')
    expect(out?.documents.map((d) => d.id)).toEqual(['d9'])
  })

  it('returns nothing when neither path finds a plat', async () => {
    setSb(() => ({ data: [], error: null }))
    expect(await getPlaceDocumentsForListing('Nowhere Estates')).toBeNull()
  })

  it('never turns a real read error into a confident absence — it retries uncached', async () => {
    setSb(() => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }))
    expect(await getPlaceDocumentsForListing('Evergreen Park')).toBeNull()
    // Both reads, each retried once outside the cache: an error is never stored.
    expect(calls.length).toBeGreaterThan(2)
  })
})
