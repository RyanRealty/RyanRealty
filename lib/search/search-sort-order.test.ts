import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEARCH_SORT_KEYS,
  SEARCH_SORT_LABELS,
  SEARCH_SORT_SPECS,
  SOLD_SEARCH_SORT_LABELS,
  applySearchSortOrder,
  compareTilesForSearchSort,
  isSearchSortKey,
  isSoldSearchScope,
  resolveSearchSortKey,
  searchSortLabel,
  searchTileSort,
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

describe('the Sold scope: newest means most recently SOLD (Matt 2026-09-23)', () => {
  it('names the Sold scope the way each data path decides it', () => {
    // /homes-for-sale (split, list, map views) says status=Sold; the browse
    // bar and the RPC say statusFilter=closed.
    expect(isSoldSearchScope('Sold')).toBe(true)
    expect(isSoldSearchScope('closed')).toBe(true)
    expect(isSoldSearchScope(' Sold ')).toBe(true)
    for (const status of ['Active', 'Pending', 'active', 'active_and_pending', 'pending', 'all', '', null, undefined]) {
      expect(isSoldSearchScope(status)).toBe(false)
    }
    // 'all' mixes on-market and sold rows: it keeps the on-market date.
    expect(isSoldSearchScope('all')).toBe(false)
  })

  it('the date sorts read "Recently sold" / "Oldest sold" on the Sold scope; everything else is unchanged', () => {
    expect(SOLD_SEARCH_SORT_LABELS).toEqual({ newest: 'Recently sold', oldest: 'Oldest sold' })
    expect(searchSortLabel('newest', { sold: true })).toBe('Recently sold')
    expect(searchSortLabel('oldest', { sold: true })).toBe('Oldest sold')
    // The default (no sort param) is newest, so a bare Sold view reads "Recently sold".
    expect(searchSortLabel(undefined, { sold: true })).toBe('Recently sold')
    expect(searchSortLabel('', { sold: true })).toBe('Recently sold')
    expect(searchSortLabel('bogus', { sold: true })).toBe('Recently sold')
    // Price and the other sorts keep their names on the Sold scope.
    for (const key of SEARCH_SORT_KEYS) {
      if (key === 'newest' || key === 'oldest') continue
      expect(searchSortLabel(key, { sold: true })).toBe(SEARCH_SORT_LABELS[key])
    }
    // For-sale scopes are unchanged: "Newest listed".
    for (const key of SEARCH_SORT_KEYS) {
      expect(searchSortLabel(key)).toBe(SEARCH_SORT_LABELS[key])
      expect(searchSortLabel(key, { sold: false })).toBe(SEARCH_SORT_LABELS[key])
    }
    expect(searchSortLabel(undefined)).toBe('Newest listed')
    for (const label of Object.values(SOLD_SEARCH_SORT_LABELS)) expect(label).not.toMatch(/—/)
  })

  it('resolves the legacy sort spellings the way the data paths do', () => {
    expect(resolveSearchSortKey('priceAsc')).toBe('price_asc')
    expect(resolveSearchSortKey('priceDesc')).toBe('price_desc')
    expect(resolveSearchSortKey(' oldest ')).toBe('oldest')
    expect(resolveSearchSortKey('modified')).toBe('newest')
    expect(resolveSearchSortKey(null)).toBe('newest')
    expect(searchSortLabel('priceAsc', { sold: true })).toBe('Price: low to high')
  })

  it('the tile read orders the Sold scope by the close date and every other scope by the list date', () => {
    expect(searchTileSort('newest', { sold: true })).toBe('close-newest')
    expect(searchTileSort(undefined, { sold: true })).toBe('close-newest')
    expect(searchTileSort('oldest', { sold: true })).toBe('close-oldest')
    expect(searchTileSort('price_asc', { sold: true })).toBe('price-asc')
    expect(searchTileSort('priceDesc', { sold: true })).toBe('price-desc')
    // The tile MV cannot order by $/sq ft or year built: the scope's newest.
    expect(searchTileSort('price_per_sqft_asc', { sold: true })).toBe('close-newest')
    expect(searchTileSort('newest')).toBe('listed-newest')
    expect(searchTileSort('oldest')).toBe('listed-oldest')
    expect(searchTileSort('price_asc')).toBe('price-asc')
    expect(searchTileSort('price_desc', { sold: false })).toBe('price-desc')
    expect(searchTileSort('year_newest')).toBe('listed-newest')
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

  it('the listing_tile_mv search reads (list fast path, map pins, Sold viewport) read the scope-aware sort', () => {
    const actions = read('app/actions/listings.ts')
    // getListings (list fast path, never the Sold scope): newest -> listed-newest, oldest -> listed-oldest.
    expect(actions).toMatch(/newest: 'listed-newest',\s*\n\s*oldest: 'listed-oldest',/)
    // getListingsForMap (?view=map pins): newest listed, or most recently sold on the Sold scope.
    expect(actions).toMatch(
      /sort: searchTileSort\('newest', \{ sold: dalStatus === 'closed' \}\),\s*\n\s*limit: Math\.min\(mapLimit, 5000\)/,
    )
    // getViewportListings (the Sold scope of the split view).
    expect(actions).toMatch(/const dalSort = searchTileSort\(options\.sort, \{ sold: dalStatus === 'closed' \}\)/)
    const tiles = read('lib/data/listings/getListingTiles.ts')
    expect(tiles).toMatch(/\.order\('on_market_date', \{ ascending: parsed\.sort === 'listed-oldest', nullsFirst: false \}\)/)
    expect(tiles).toMatch(/\.order\('close_date', \{ ascending: parsed\.sort === 'close-oldest', nullsFirst: false \}\)/)
  })

  it('the live definition of each search RPC orders newest by "OnMarketDate" ("CloseDate" on the Sold scope) and reads new listings by "OnMarketDate"', () => {
    // Append-only migrations: the LAST file that CREATEs a function is its
    // live definition. A later migration that reverts to the modification
    // timestamp fails here.
    const dir = join(ROOT, 'supabase', 'migrations')
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    const lastDefining = (fn: string) =>
      files.filter((f) => readFileSync(join(dir, f), 'utf8').includes(`CREATE OR REPLACE FUNCTION public.${fn}(`)).at(-1)!
    const adv = readFileSync(join(dir, lastDefining('search_listings_advanced')), 'utf8')
    const advBody = adv.slice(adv.indexOf('CREATE OR REPLACE FUNCTION public.search_listings_advanced('))
    // One sort date: the close date on the Sold scope, the on-market date elsewhere.
    const sortDate = (alias: string) =>
      `CASE WHEN p_status_filter = 'closed' THEN ${alias}."CloseDate" ELSE ${alias}."OnMarketDate" END`
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(advBody).toContain(`${sortDate('l')} AS s_sort_date`)
    expect(advBody).toMatch(/p_sort = 'oldest' THEN base\.s_sort_date END ASC NULLS LAST/)
    expect(advBody).toMatch(/p_sort = 'newest' OR p_sort IS NULL THEN base\.s_sort_date END DESC NULLS LAST/)
    expect(advBody).toMatch(new RegExp(`p_sort = 'oldest' THEN \\(${esc(sortDate('l2'))}\\) END ASC NULLS LAST`))
    expect(advBody).toMatch(
      new RegExp(`p_sort = 'newest' OR p_sort IS NULL THEN \\(${esc(sortDate('l2'))}\\) END DESC NULLS LAST`),
    )
    // Deterministic tie-break on both ORDER BYs.
    expect(advBody).toMatch(/base\.k ASC\s*\n\s*LIMIT p_limit/)
    expect(advBody).toMatch(/l2\."ListNumber" ASC;\s*\nEND;/)
    expect(advBody).not.toMatch(/THEN [a-z0-9_.]*"?ModificationTimestamp"? END/)
    // "New in the last N days" means newly LISTED: the on-market date, not the
    // MLS edit time. No predicate reads the modification timestamp at all.
    expect(advBody).toContain(
      `AND (p_new_listings_days IS NULL OR (l."OnMarketDate" IS NOT NULL AND l."OnMarketDate" >= (now() - (p_new_listings_days || ' days')::interval)))`,
    )
    const bodyOnly = advBody.slice(advBody.indexOf('AS $function$'), advBody.indexOf('$function$;'))
    expect(bodyOnly.replace(/--[^\n]*/g, '')).not.toMatch(/l2?\."ModificationTimestamp" (>=|<=|>|<|IS)/)
    const kw = readFileSync(join(dir, lastDefining('search_keyword_listings')), 'utf8')
    const kwBody = kw.slice(kw.indexOf('CREATE OR REPLACE FUNCTION public.search_keyword_listings('))
    expect(kwBody).toMatch(/ORDER BY b\.s_omd DESC NULLS LAST, b\."ListNumber" ASC/)
  })
})
