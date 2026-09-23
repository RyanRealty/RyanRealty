/**
 * On-market homes near an amenity, and the one median the amenity pages print.
 *
 * WHY THIS EXISTS (audit DATA-3 / DATA-8, 2026-09-22). Six amenity detail DALs
 * (parks, trails, golf, events, venues, schools) each ran their own
 * request-time scan of the raw 597K-row `listings` table, re-run every 120 s
 * per visited slug, and each carried its own copy of `medianListPrice()`. Two
 * defects rode along:
 *   1. The scan returned the 60 MOST EXPENSIVE homes in the box
 *      (ORDER BY price DESC LIMIT 60) and the stats band computed "count" and
 *      "median list price" over that display slice. Any box holding more than
 *      60 homes printed 60 as the count and a median of the top 60 as the
 *      area's median, biased upward (CLAUDE.md section 0).
 *   2. The median had no sample floor: one home printed as "the median".
 *
 * NOW. One read of `listing_search_mv` (the on-market search projection,
 * about 9.7K rows, refreshed by pg_cron refresh_dal_mvs_15min; it carries
 * lat/lng AND the MLS school-name columns the school page filters on), paged
 * over the WHOLE matching set. Count and median come from that full set; the
 * display tiles are its top slice. The median is `percentile_cont(0.5)`
 * (medianCont, the Market Truth definition) and publishes only on at least
 * the Market Truth floor for a median (registry median_list_active, min_n 10).
 *
 * Population is unchanged from the six DALs it replaces: public active
 * statuses (PUBLIC_ACTIVE_STATUSES) and PropertyType 'A'.
 */

import { supabaseAnon } from '@/lib/data/client'
import { readOrThrow } from '@/lib/data/cache/resilient'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'
import { medianCont } from '@/lib/data/proof/outcomes'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { publishStreetLine } from '@/lib/listing/publish-street-line'

/** One nearby-home tile, the shape every amenity page renders. */
export type NearbyHomeTile = {
  listingKey: string
  href: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Single-line street address (e.g. "2732 NW Ordway Ave"). */
  addressLine: string
  /** City line (e.g. "Bend, OR 97703"). */
  cityLine: string
  lat: number | null
  lng: number | null
  photoUrl: string | null
}

export type NearbyHomeStats = {
  /** Every on-market home that matched, not the display slice. */
  count: number
  /** Median list price over that full set, rounded to $1k; null under the floor. */
  medianListPrice: number | null
}

/** Fewest priced homes a published median may rest on (Market Truth min_n for a median). */
export const NEARBY_MEDIAN_MIN_N: number = STAT_BY_ID.get('median_list_active')?.minN ?? 10

/**
 * The one median the amenity pages print: percentile_cont(0.5) over every
 * positive list price, rounded to the nearest $1k, withheld under the floor.
 */
export function publishNearbyMedianListPrice(prices: ReadonlyArray<number | null | undefined>): number | null {
  const valid = prices.filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0)
  if (valid.length < NEARBY_MEDIAN_MIN_N) return null
  const raw = medianCont(valid)
  return raw == null ? null : Math.round(raw / 1000) * 1000
}

type SearchMvRow = {
  listing_key: string | null
  list_price: number | string | null
  beds: number | null
  baths: number | string | null
  sqft: number | string | null
  street_number: string | null
  street_name: string | null
  street_suffix?: string | null
  city: string | null
  postal_code: string | null
  lat: number | string | null
  lng: number | string | null
  photo_url: string | null
}

const COLUMNS =
  'listing_key, list_price, beds, baths, sqft, street_number, street_name, street_suffix, city, postal_code, lat, lng, photo_url'

/** PostgREST caps a response at 1,000 rows. */
const PAGE = 1000
/** Safety ceiling: listing_search_mv holds about 9.7K on-market rows in total. */
const MAX_PAGES = 12

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function searchMvRowToNearbyTile(row: SearchMvRow): NearbyHomeTile {
  // listing_search_mv carries the suffix the raw StreetName lacked ("21283 Dove" -> "21283 Dove Lane").
  const street = publishStreetLine({
    streetNumber: row.street_number,
    streetName: row.street_name,
    streetSuffix: row.street_suffix ?? null,
  })
  const cityLine = [[row.city, 'OR'].filter(Boolean).join(', '), row.postal_code]
    .filter(Boolean)
    .join(' ')
    .trim()
  const key = row.listing_key ?? ''
  return {
    listingKey: key,
    href: `/listing/${key}`,
    price: num(row.list_price),
    beds: row.beds,
    baths: num(row.baths),
    sqft: num(row.sqft),
    addressLine: street || 'Address available on request',
    cityLine: cityLine || 'Central Oregon',
    lat: num(row.lat),
    lng: num(row.lng),
    photoUrl: row.photo_url,
  }
}

/** Pure: full set in, display slice + full-set stats out. */
export function summarizeNearbyHomes(
  rows: ReadonlyArray<SearchMvRow>,
  maxTiles: number,
): { homes: NearbyHomeTile[]; stats: NearbyHomeStats } {
  const tiles = rows.map(searchMvRowToNearbyTile)
  return {
    homes: tiles.slice(0, Math.max(0, maxTiles)),
    stats: {
      count: tiles.length,
      medianListPrice: publishNearbyMedianListPrice(tiles.map((t) => t.price)),
    },
  }
}

type Filter =
  | { kind: 'box'; lat: number; lng: number; latPad: number; lngPad: number }
  | {
      kind: 'school'
      column: 'elementary_school' | 'middle_school' | 'high_school'
      /** Exact, case-insensitive MLS school name (no wildcards). */
      name: string
      cities: string[]
    }

async function readAllMatching(label: string, filter: Filter): Promise<SearchMvRow[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  const out: SearchMvRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE
    // readOrThrow retries, then THROWS, so a transient error is never cached
    // as "0 homes near this place" for the full TTL; the pages catch it.
    const data = await readOrThrow(`${label} page ${page}`, () => {
      let q = supabase
        .from('listing_search_mv')
        .select(COLUMNS)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        .eq('property_type', 'A')
      if (filter.kind === 'box') {
        q = q
          .gte('lat', filter.lat - filter.latPad)
          .lte('lat', filter.lat + filter.latPad)
          .gte('lng', filter.lng - filter.lngPad)
          .lte('lng', filter.lng + filter.lngPad)
      } else {
        q = q.ilike(filter.column, filter.name.replace(/[%_]/g, '')).in('city', filter.cities)
      }
      return q
        .order('list_price', { ascending: false, nullsFirst: false })
        .order('listing_key', { ascending: true })
        .range(from, from + PAGE - 1)
    })
    const rows = (data ?? []) as unknown as SearchMvRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Every public on-market PropertyType 'A' home inside a lat/lng box, price-desc. */
export async function fetchOnMarketHomesInBox(input: {
  label: string
  lat: number
  lng: number
  latPad: number
  lngPad: number
  maxTiles: number
}): Promise<{ homes: NearbyHomeTile[]; stats: NearbyHomeStats }> {
  const rows = await readAllMatching(input.label, {
    kind: 'box',
    lat: input.lat,
    lng: input.lng,
    latPad: input.latPad,
    lngPad: input.lngPad,
  })
  return summarizeNearbyHomes(rows, input.maxTiles)
}

/** Every public on-market PropertyType 'A' home whose MLS school field names this school. */
export async function fetchOnMarketHomesForSchool(input: {
  label: string
  column: 'elementary_school' | 'middle_school' | 'high_school'
  name: string
  cities: string[]
  maxTiles: number
}): Promise<{ homes: NearbyHomeTile[]; stats: NearbyHomeStats }> {
  if (input.cities.length === 0) return summarizeNearbyHomes([], input.maxTiles)
  const rows = await readAllMatching(input.label, {
    kind: 'school',
    column: input.column,
    name: input.name,
    cities: input.cities,
  })
  return summarizeNearbyHomes(rows, input.maxTiles)
}
