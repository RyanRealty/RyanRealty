/**
 * searchListingSuggestTiles — typeahead suggestion rows from listing_tile_mv
 * via the tsvector GIN index (`listing_tile_mv_search` on `search_vector`,
 * built in 20260522144509_listing_tile_mv.sql and carried through every MV
 * rebuild since).
 *
 * Feed (Matt P0 / Cos 2026-09-19 — Delaware 2018 dead-stock):
 *   GET /api/search/suggestions?q=…
 *     → getSearchSuggestions (app/actions/listings.ts)
 *     → this function
 *   Table: public.listing_tile_mv_src (service-client read; the public
 *   listing_tile_mv name is the coming-soon-lockdown security_barrier view
 *   and blocks GIN pushdown).
 *   Index: listing_tile_mv_search GIN(search_vector). Numeric prefixes
 *   ("3480") use street_number / postal_code btree LIKE instead (see
 *   20260722223000) because '3480:*' is pathological on the GIN.
 *
 * WHY: the previous suggestions path ran a five-column ILIKE OR
 * (`street_number.ilike.%q% , street_name.ilike... , city... , subdivision... ,
 * postal_code...`) against the ~593K-row MV — a full scan per keystroke that
 * never touched the GIN index built for exactly this query. This function
 * compiles the query into a prefix tsquery (`3480:* & nw:*`) so Postgres
 * serves it from the index.
 *
 * Semantics: word-PREFIX match per token (standard typeahead behavior).
 * "Awbrey Bu" matches "Awbrey Butte"; "3480" matches street number 3480.
 * The `english` config stems both sides identically ("meadows" -> "meadow:*").
 *
 * On-market only. The MV holds one row per MLS listing ever seen, so an
 * unscoped GIN prefix on "delaware" returned Closed 2018 Avenue addresses as
 * if they were live. Typeahead address hits must be current inventory
 * (PUBLIC_ON_MARKET_STATUSES = Active / Active Under Contract / Pending).
 * Coming Soon is already outside that set (never public). IDX opt-outs stay
 * excluded by the MV definition (20260627150000).
 *
 * Fail-soft: returns [] on any Supabase error — suggestions are a progressive
 * enhancement, never worth a 500.
 */

import { createServiceClient } from '@/lib/data/client'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'

export type SuggestTileRow = {
  listNumber: string | null
  listingKey: string | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  city: string | null
  postalCode: string | null
  subdivisionName: string | null
  /** SITE-22 — the canonical URL's middle segments, so a typeahead address
   *  suggestion links to the URL that listing canonicalises to. */
  boundaryCity: string | null
  boundaryNeighborhood: string | null
}

const MAX_TOKENS = 6

/**
 * Compile free text into a safe prefix tsquery ("3480:* & nw:*").
 * Tokens are reduced to [a-z0-9]+ so the compiled string cannot carry tsquery
 * syntax or PostgREST reserved characters. Returns null when nothing usable
 * remains (e.g. punctuation-only input).
 */
export function toPrefixTsQuery(query: string): string | null {
  const tokens = (query ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
  if (tokens.length === 0) return null
  return tokens.map((t) => `${t}:*`).join(' & ')
}

type MvRow = {
  list_number: string | null
  listing_key: string | null
  street_number: string | null
  street_name: string | null
  street_suffix: string | null
  city: string | null
  postal_code: string | null
  subdivision_name: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
}

/**
 * Address/locality suggestion tiles. Returns `null` when the read FAILS
 * (degraded — the caller must not cache the response as "no matches") and `[]`
 * only on a genuine empty match. A transient DB timeout that returned [] here
 * used to get pinned by the route's s-maxage + the client suggestion cache,
 * serving an empty dropdown to every user for up to 12 minutes.
 */
export async function searchListingSuggestTiles(
  query: string,
  limit = 250
): Promise<SuggestTileRow[] | null> {
  // Service client reading listing_tile_mv_src DIRECTLY (server-only callers:
  // the suggestions route + server action). The public listing_tile_mv name is
  // the coming-soon-lockdown security_barrier view — and security_barrier
  // blocks pushdown of non-leakproof operators (LIKE, tsvector @@), so every
  // suggestion query through the view seq-scanned all ~594K rows (~1.2s,
  // EXPLAIN-verified 2026-07-22). Reading src engages the GIN + prefix btree
  // indexes; on-market status is applied here so the GIN cannot return
  // Closed 2018 stock as a live address hit.
  const sb = createServiceClient()
  if (!sb) return null
  const trimmed = (query ?? '').trim()
  const cappedLimit = Math.min(Math.max(limit, 1), 500)
  const cols =
    'list_number, listing_key, street_number, street_name, street_suffix, city, postal_code, subdivision_name, boundary_city, boundary_neighborhood'

  // Numeric fast path — a purely numeric prefix ("3480") is pathological for
  // the tsvector GIN index (every address number shares the token prefix;
  // measured 2026-07-22: '3480:*' 1.35–1.75s vs 'awbrey:*' 0.11s, transiently
  // past the anon 3s statement timeout). Street-number/postal-code btree
  // prefix LIKE serves the same intent in ms (indexes in migration
  // 20260722223000). Safe to interpolate: digits only by the regex.
  if (/^\d+$/.test(trimmed)) {
    const { data, error } = await sb
      .from('listing_tile_mv_src')
      .select(cols)
      .in('standard_status', PUBLIC_ON_MARKET_STATUSES)
      .or(`street_number.like.${trimmed}%,postal_code.like.${trimmed}%`)
      .limit(cappedLimit)
    if (error) {
      console.error(`[searchListingSuggestTiles] numeric path: ${error.message}`)
      return null
    }
    return mapRows((data ?? []) as MvRow[])
  }

  const tsquery = toPrefixTsQuery(trimmed)
  if (!tsquery) return []

  const { data, error } = await sb
    .from('listing_tile_mv_src')
    .select(cols)
    // Drop Closed / Expired / Withdrawn / Canceled / Coming Soon so a street
    // prefix cannot surface 2018 sold stock as a live address hit.
    .in('standard_status', PUBLIC_ON_MARKET_STATUSES)
    .textSearch('search_vector', tsquery, { config: 'english' })
    // NO order-by. ORDER BY modified_at + LIMIT flips the planner off the GIN
    // index onto a per-row fts recheck (measured 2026-07-22: ~1.9s extra, and
    // transiently past the anon statement timeout -> fail-soft [] -> an empty
    // dropdown). Unordered, the GIN plan serves this in ~250ms round-trip.
    // Suggestion ranking is count-based downstream, so row order is free.
    .limit(cappedLimit)

  if (error) {
    console.error(`[searchListingSuggestTiles] ${error.message}`)
    return null
  }

  return mapRows((data ?? []) as MvRow[])
}

function mapRows(rows: MvRow[]): SuggestTileRow[] {
  return rows.map((r) => ({
    listNumber: r.list_number,
    listingKey: r.listing_key,
    streetNumber: r.street_number,
    streetName: r.street_name,
    streetSuffix: r.street_suffix,
    city: r.city,
    postalCode: r.postal_code,
    subdivisionName: r.subdivision_name,
    boundaryCity: r.boundary_city,
    boundaryNeighborhood: r.boundary_neighborhood,
  }))
}
