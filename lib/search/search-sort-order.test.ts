import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEARCH_SORT_KEYS,
  SEARCH_SORT_LABELS,
  SEARCH_SORT_SPECS,
  applySearchSortOrder,
  compareTilesForSearchSort,
  isSearchSortKey,
  type SearchSortableTile,
} from './search-sort-order'

const ROOT = join(__dirname, '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** Records every .order() call a sort makes on a PostgREST builder. */
function recordOrder(sort: Parameters<typeof applySearchSortOrder>[1]) {
  const calls: [string, { ascending: boolean; nullsFirst: boolean }][] = []
  const builder = {
    order(column: string, opts: { ascending: boolean; nullsFirst: boolean }) {
      calls.push([column, opts])
      return builder
    },
  }
  applySearchSortOrder(builder, sort)
  return calls
}

const tile = (listingKey: string, onMarketDate: string | null, extra: Partial<SearchSortableTile> = {}): SearchSortableTile => ({
  listingKey,
  onMarketDate,
  listPrice: null,
  pricePerSqft: null,
  yearBuilt: null,
  ...extra,
})

describe('search sort order: newest means newest LISTED (Matt 2026-09-23)', () => {
  it('newest orders by the on-market date, descending; oldest is its mirror', () => {
    expect(SEARCH_SORT_SPECS.newest).toEqual({ column: 'on_market_date', ascending: false })
    expect(SEARCH_SORT_SPECS.oldest).toEqual({ column: 'on_market_date', ascending: true })
    // No sort reads the MLS modification timestamp.
    for (const key of SEARCH_SORT_KEYS) expect(SEARCH_SORT_SPECS[key].column).not.toBe('modified_at')
  })

  it('the MV read sinks nulls and breaks ties on listing_key, so paging is stable', () => {
    expect(recordOrder('newest')).toEqual([
      ['on_market_date', { ascending: false, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
    expect(recordOrder('oldest')).toEqual([
      ['on_market_date', { ascending: true, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
    for (const key of SEARCH_SORT_KEYS) {
      const calls = recordOrder(key)
      expect(calls).toHaveLength(2)
      expect(calls[1][0]).toBe('listing_key')
    }
  })

  it('the Node comparator (chunked shape reads) orders exactly as the MV read does', () => {
    const rows = [
      tile('K-EDITED-TODAY', '2026-07-10T16:45:21+00:00'),
      tile('K-NO-DATE', null),
      tile('K-LISTED-TODAY', '2026-09-23T15:00:00+00:00'),
      tile('K-TIE-B', '2026-08-01T12:00:00+00:00'),
      tile('K-TIE-A', '2026-08-01T12:00:00+00:00'),
    ]
    expect([...rows].sort(compareTilesForSearchSort('newest')).map((r) => r.listingKey)).toEqual([
      'K-LISTED-TODAY',
      'K-TIE-A',
      'K-TIE-B',
      'K-EDITED-TODAY',
      'K-NO-DATE',
    ])
    expect([...rows].sort(compareTilesForSearchSort('oldest')).map((r) => r.listingKey)).toEqual([
      'K-EDITED-TODAY',
      'K-TIE-A',
      'K-TIE-B',
      'K-LISTED-TODAY',
      'K-NO-DATE',
    ])
    const priced = [tile('B', null, { listPrice: 500_000 }), tile('A', null, { listPrice: 500_000 }), tile('C', null)]
    expect(priced.sort(compareTilesForSearchSort('price_desc')).map((r) => r.listingKey)).toEqual(['A', 'B', 'C'])
  })

  it('the control says "Newest listed", never a bare "Newest"', () => {
    expect(SEARCH_SORT_LABELS.newest).toBe('Newest listed')
    expect(SEARCH_SORT_LABELS.oldest).toBe('Oldest listed')
    for (const label of Object.values(SEARCH_SORT_LABELS)) expect(label).not.toMatch(/—/)
    expect(isSearchSortKey('newest')).toBe(true)
    expect(isSearchSortKey('modified')).toBe(false)
  })
})

describe('every search path reads the one sort table', () => {
  it('listing_search_mv (searchListingsAll + drawn shapes) never orders by modified_at', () => {
    const all = read('lib/data/listings/searchListingsAll.ts')
    const shapes = read('lib/data/listings/searchShapes.ts')
    expect(all).toMatch(/applySearchSortOrder\(builder, sort\)/)
    expect(shapes).toMatch(/compareTilesForSearchSort\(sort\)/)
    for (const src of [all, shapes]) expect(src).not.toMatch(/order\(\s*'modified_at'/)
  })

  it('the listing_tile_mv search reads (list fast path, map pins, Sold viewport) ask for listed-newest', () => {
    const actions = read('app/actions/listings.ts')
    // getListings (list fast path): newest -> listed-newest, oldest -> listed-oldest.
    expect(actions).toMatch(/newest: 'listed-newest',\s*\n\s*oldest: 'listed-oldest',/)
    // getListingsForMap (?view=map pins).
    expect(actions).toMatch(/sort: 'listed-newest',\s*\n\s*limit: Math\.min\(mapLimit, 5000\)/)
    // getViewportListings (the Sold scope of the split view).
    expect(actions).toMatch(/\? 'listed-oldest'\s*\n\s*: 'listed-newest'/)
    const tiles = read('lib/data/listings/getListingTiles.ts')
    expect(tiles).toMatch(/\.order\('on_market_date', \{ ascending: parsed\.sort === 'listed-oldest', nullsFirst: false \}\)/)
  })

  it('the live definition of each search RPC orders newest by "OnMarketDate"', () => {
    // Append-only migrations: the LAST file that CREATEs a function is its
    // live definition. A later migration that reverts to the modification
    // timestamp fails here.
    const dir = join(ROOT, 'supabase', 'migrations')
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    const lastDefining = (fn: string) =>
      files.filter((f) => readFileSync(join(dir, f), 'utf8').includes(`CREATE OR REPLACE FUNCTION public.${fn}(`)).at(-1)!
    const adv = readFileSync(join(dir, lastDefining('search_listings_advanced')), 'utf8')
    const advBody = adv.slice(adv.indexOf('CREATE OR REPLACE FUNCTION public.search_listings_advanced('))
    expect(advBody).toMatch(/l\."OnMarketDate" AS s_omd/)
    expect(advBody).toMatch(/p_sort = 'newest' OR p_sort IS NULL THEN base\.s_omd END DESC NULLS LAST/)
    expect(advBody).toMatch(/p_sort = 'newest' OR p_sort IS NULL THEN l2\."OnMarketDate" END DESC NULLS LAST/)
    expect(advBody).not.toMatch(/THEN [a-z0-9_.]*"?ModificationTimestamp"? END/)
    const kw = readFileSync(join(dir, lastDefining('search_keyword_listings')), 'utf8')
    const kwBody = kw.slice(kw.indexOf('CREATE OR REPLACE FUNCTION public.search_keyword_listings('))
    expect(kwBody).toMatch(/ORDER BY b\.s_omd DESC NULLS LAST, b\."ListNumber" ASC/)
  })
})
