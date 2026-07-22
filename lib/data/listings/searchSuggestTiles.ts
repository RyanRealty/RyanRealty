/**
 * searchListingSuggestTiles — typeahead suggestion rows from listing_tile_mv
 * via the tsvector GIN index (`listing_tile_mv_search` on `search_vector`,
 * built in 20260522144509_listing_tile_mv.sql and carried through every MV
 * rebuild since).
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
 * Coming Soon is excluded (never public — CLAUDE.md locked rule); the MV
 * itself already excludes internet-display opt-outs and non-IDX listings
 * (20260627150000_idx_internet_display_optout.sql), so ODS/IDX compliance is
 * inherited from the same read path every listing card uses.
 *
 * Fail-soft: returns [] on any Supabase error — suggestions are a progressive
 * enhancement, never worth a 500.
 */

import { createServiceClient } from '@/lib/data/client'
import { COMING_SOON_STATUS, MV_NOT_COMING_SOON_OR_PREDICATE } from '@/lib/listing-status-public'

export type SuggestTileRow = {
  listNumber: string | null
  listingKey: string | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  city: string | null
  postalCode: string | null
  subdivisionName: string | null
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
  // indexes; the view's exact predicate is mirrored inline below.
  const sb = createServiceClient()
  if (!sb) return null
  const trimmed = (query ?? '').trim()
  const cappedLimit = Math.min(Math.max(limit, 1), 500)
  const cols =
    'list_number, listing_key, street_number, street_name, street_suffix, city, postal_code, subdivision_name'
  // Lockdown-view predicate mirror — central policy constant, kept in lockstep
  // with migration 20260721164833 (G-COMINGSOON).
  const comingSoonMirror = MV_NOT_COMING_SOON_OR_PREDICATE

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
      .neq('standard_status', COMING_SOON_STATUS)
      .or(comingSoonMirror)
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
    // Pre-marketing listings never render publicly (central policy constant
    // plus the lockdown-view predicate mirror — belt-and-suspenders).
    .neq('standard_status', COMING_SOON_STATUS)
    .or(comingSoonMirror)
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
  }))
}
