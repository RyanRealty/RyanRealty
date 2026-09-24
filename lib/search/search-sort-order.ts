/**
 * What each search sort orders by: one definition for every on-market search
 * path, so the MV read, the Node-side merge of chunked reads, and the words on
 * the sort control cannot disagree.
 *
 * NEWEST MEANS NEWEST LISTED (Matt 2026-09-23). `newest`, the default sort of
 * every search, orders by the date the home came on the market
 * (listing_search_mv.on_market_date = listings."OnMarketDate"), newest first.
 * It used to order by the MLS modification timestamp (modified_at), so a July
 * listing edited today sat on top and a home that went live today sat lower.
 * `oldest` is its mirror, the longest-listed first. There is no "recently
 * updated" sort.
 *
 * Every sort sinks rows missing the sort value (nulls last) and breaks ties on
 * listing_key ascending, so two homes listed in the same second (a builder
 * listing a run of lots) keep one order from page to page.
 *
 * THE SOLD SCOPE ORDERS BY THE CLOSE DATE (Matt 2026-09-23). On a sold view
 * the useful default is the most recently SOLD home, not the most recently
 * listed one, so on that scope `newest` orders by the close date, newest
 * first ("Recently sold"), and `oldest` is its mirror ("Oldest sold"). Price
 * sorts are the same on every scope. The Sold scope is served by the tile MV
 * (split view and map pins: searchTileSort below) and by the
 * search_listings_advanced RPC (the list view, whose base CTE picks
 * listings."CloseDate" when p_status_filter = 'closed'); listing_search_mv
 * and the drawn-shape reads carry on-market rows only and never see it.
 *
 * Pure: imported by the DAL (lib/data/listings/searchListingsAll.ts,
 * searchShapes.ts), the server actions (app/actions/listings.ts) and by
 * client components (the sort labels).
 */

export const SEARCH_SORT_KEYS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'price_per_sqft_asc',
  'price_per_sqft_desc',
  'year_newest',
  'year_oldest',
] as const

export type SearchSortKey = (typeof SEARCH_SORT_KEYS)[number]

/** listing_search_mv / listing_tile_mv columns a search sort reads. */
export type SearchSortColumn = 'on_market_date' | 'list_price' | 'price_per_sqft' | 'year_built'

export type SearchSortSpec = { column: SearchSortColumn; ascending: boolean }

export const SEARCH_SORT_SPECS: Readonly<Record<SearchSortKey, SearchSortSpec>> = {
  newest: { column: 'on_market_date', ascending: false },
  oldest: { column: 'on_market_date', ascending: true },
  price_asc: { column: 'list_price', ascending: true },
  price_desc: { column: 'list_price', ascending: false },
  price_per_sqft_asc: { column: 'price_per_sqft', ascending: true },
  price_per_sqft_desc: { column: 'price_per_sqft', ascending: false },
  year_newest: { column: 'year_built', ascending: false },
  year_oldest: { column: 'year_built', ascending: true },
}

/** The deterministic last key of every sort (unique per MV row). */
export const SEARCH_SORT_TIEBREAK_COLUMN = 'listing_key'

/** The names the sort control shows. `newest` is the default. */
export const SEARCH_SORT_LABELS: Readonly<Record<SearchSortKey, string>> = {
  newest: 'Newest listed',
  oldest: 'Oldest listed',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  price_per_sqft_asc: 'Price per sq ft: low to high',
  price_per_sqft_desc: 'Price per sq ft: high to low',
  year_newest: 'Newest built',
  year_oldest: 'Oldest built',
}

/**
 * The names the Sold scope gives the two date sorts: they order by the close
 * date there. Every other key keeps its SEARCH_SORT_LABELS name.
 */
export const SOLD_SEARCH_SORT_LABELS: Readonly<Record<'newest' | 'oldest', string>> = {
  newest: 'Recently sold',
  oldest: 'Oldest sold',
}

export function isSearchSortKey(value: unknown): value is SearchSortKey {
  return typeof value === 'string' && (SEARCH_SORT_KEYS as readonly string[]).includes(value)
}

/**
 * True when a search's status names the Sold scope. Each surface spells it the
 * way its data path decides it: `status=Sold` on /homes-for-sale (split, list,
 * map views; app/actions/search.ts), `statusFilter=closed` on the browse bar
 * and the RPC (search_listings_advanced p_status_filter).
 */
export function isSoldSearchScope(status: string | null | undefined): boolean {
  const value = status?.trim()
  return value === 'Sold' || value === 'closed'
}

/**
 * A raw sort param as the key the data paths read: the two legacy spellings
 * map the way app/actions/search.ts toDalSort maps them, and anything unknown
 * is `newest`, because every path falls back to it.
 */
export function resolveSearchSortKey(raw: string | null | undefined): SearchSortKey {
  const value = raw?.trim()
  if (value === 'priceAsc') return 'price_asc'
  if (value === 'priceDesc') return 'price_desc'
  return isSearchSortKey(value) ? value : 'newest'
}

/**
 * The name of a sort on a scope: "Recently sold" / "Oldest sold" for the date
 * sorts on the Sold scope, the SEARCH_SORT_LABELS name everywhere else. Every
 * place a search names its order reads this, so the words match the order.
 */
export function searchSortLabel(sort: string | null | undefined, scope: { sold?: boolean } = {}): string {
  const key = resolveSearchSortKey(sort)
  if (scope.sold && (key === 'newest' || key === 'oldest')) return SOLD_SEARCH_SORT_LABELS[key]
  return SEARCH_SORT_LABELS[key]
}

/** The getListingTiles (listing_tile_mv) sort keys a search asks for. */
export type SearchTileSort =
  | 'listed-newest'
  | 'listed-oldest'
  | 'close-newest'
  | 'close-oldest'
  | 'price-asc'
  | 'price-desc'

/**
 * The listing_tile_mv sort for a search sort on a scope. `newest` / `oldest`
 * order by the on-market date ('listed-*'), or by the close date on the Sold
 * scope ('close-*'); both sink nulls and break ties on listing_key. The tile
 * read cannot order by price per sq ft or year built, so those fall back to
 * the scope's `newest`, as the tile paths always have.
 */
export function searchTileSort(sort: string | null | undefined, scope: { sold?: boolean } = {}): SearchTileSort {
  const key = resolveSearchSortKey(sort)
  if (key === 'price_asc') return 'price-asc'
  if (key === 'price_desc') return 'price-desc'
  if (key === 'oldest') return scope.sold ? 'close-oldest' : 'listed-oldest'
  return scope.sold ? 'close-newest' : 'listed-newest'
}

type OrderableQuery = {
  order: (column: string, opts: { ascending: boolean; nullsFirst: boolean }) => OrderableQuery
}

/**
 * Apply a search sort to a PostgREST builder: the sort column (nulls last),
 * then listing_key ascending. The builder type is too deep for a generic
 * constraint, so it is cast in and back out (same pattern as the DAL).
 */
export function applySearchSortOrder<T>(builder: T, sort: SearchSortKey): T {
  const spec = SEARCH_SORT_SPECS[sort] ?? SEARCH_SORT_SPECS.newest
  const query = builder as unknown as OrderableQuery
  return query
    .order(spec.column, { ascending: spec.ascending, nullsFirst: false })
    .order(SEARCH_SORT_TIEBREAK_COLUMN, { ascending: true, nullsFirst: false }) as unknown as T
}

/** The ListingTile fields a search sort reads. */
export type SearchSortableTile = {
  listingKey: string
  onMarketDate: string | null
  listPrice: number | null
  pricePerSqft: number | null
  yearBuilt: number | null
}

function sortValue(tile: SearchSortableTile, column: SearchSortColumn): number | null {
  switch (column) {
    case 'on_market_date': {
      if (!tile.onMarketDate) return null
      const ms = Date.parse(tile.onMarketDate)
      return Number.isFinite(ms) ? ms : null
    }
    case 'list_price':
      return tile.listPrice
    case 'price_per_sqft':
      return tile.pricePerSqft
    case 'year_built':
      return tile.yearBuilt
  }
}

/**
 * Node-side comparator matching applySearchSortOrder exactly, for paths that
 * read in chunks and must order the union themselves (drawn shapes).
 */
export function compareTilesForSearchSort(
  sort: SearchSortKey,
): (a: SearchSortableTile, b: SearchSortableTile) => number {
  const spec = SEARCH_SORT_SPECS[sort] ?? SEARCH_SORT_SPECS.newest
  return (a, b) => {
    const av = sortValue(a, spec.column)
    const bv = sortValue(b, spec.column)
    if (av != null || bv != null) {
      if (av == null) return 1
      if (bv == null) return -1
      if (av !== bv) return spec.ascending ? av - bv : bv - av
    }
    return a.listingKey < b.listingKey ? -1 : a.listingKey > b.listingKey ? 1 : 0
  }
}
