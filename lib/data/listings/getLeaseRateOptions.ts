/**
 * getLeaseRateOptions — the unit of each commercial lease's rent.
 *
 * On MLS PropertyType 'G' the ListPrice is rent, and its unit ("$/SF/Mo",
 * "$ Amt/Mo", ...) is not projected into listing_tile_mv or any RESO column:
 * LeaseAmountFrequency, RentOrLeasePriceFrequency and LeaseAmount are NULL on
 * these rows (verified 2026-09-23). It lives in the raw payload,
 * `listings.details`, under the key "Lease Rate Options". The publisher that
 * reads it is lib/listing/publish-lease-rate.ts.
 *
 * THE READ. Keyed by ListingKey, restricted to PropertyType 'G', and it selects
 * ONE json path, never the payload: `details->>"Lease Rate Options"`. The key has
 * spaces, so PostgREST needs it double-quoted inside the path; that form was run
 * against the live project on 2026-09-23 and returned "$/SF/Mo" for
 * 20260514121750306188000000 and "$ Amt/Mo" for 20260216185852526641000000 and
 * 20260603003252829675000000, while the unquoted form returned null for all
 * three. A place page has a handful of leases (Bend 13 of the 37 active in the
 * service area that day), so this is a few rows, chunked under the URL cliff
 * getListingTiles measured for keyed reads.
 *
 * NEVER BLOCKS A PAGE. The fetch throws on a database error so a blip is never
 * cached as "no unit"; the resilient wrapper retries once uncached and then
 * returns {}, and every lease with no unit prints "Lease rate not published".
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/** ListingKey → the row's "Lease Rate Options" value, verbatim, or null. */
export type LeaseRateOptionsByKey = Record<string, string | null>

/** Keys per keyed read: well under the ~530-key URL cliff (getListingTiles KEY_CHUNK). */
const KEY_CHUNK = 200
/** More leases than the whole feed carries on market (239 on 2026-09-23). */
const MAX_KEYS = 1000

type LeaseRateRow = { ListingKey: string | null; rate: unknown }

async function fetchLeaseRateOptions(keys: string[]): Promise<LeaseRateOptionsByKey> {
  const sb = supabaseAnon()
  if (!sb) return {}
  const out: LeaseRateOptionsByKey = {}
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK)
    const { data, error } = await sb
      .from('listings')
      .select('ListingKey, rate:details->>"Lease Rate Options"')
      .eq('PropertyType', 'G')
      .in('ListingKey', chunk) // @canonical-key: callers pass listing_tile_mv.listing_key, the MLS ListingKey
    if (error) {
      throw new Error(`[getLeaseRateOptions] supabase error: ${error.message}`)
    }
    for (const row of (data ?? []) as unknown as LeaseRateRow[]) {
      const key = row.ListingKey?.trim()
      if (!key) continue
      out[key] = typeof row.rate === 'string' && row.rate.trim() ? row.rate : null
    }
  }
  return out
}

const cachedLeaseRateOptions = makeResilientCached(
  fetchLeaseRateOptions,
  // The unit changes with a listing edit, so it refreshes on the tile window
  // that also refreshes the ListPrice it qualifies.
  ['lease-rate-options-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  {} as LeaseRateOptionsByKey,
)

/**
 * The "Lease Rate Options" value for each commercial-lease key given. Keys that
 * are not an MLS 'G' row, or that carry no unit, are absent or null. Never
 * throws: a failure reads as {}.
 */
export async function getLeaseRateOptions(
  listingKeys: readonly string[],
): Promise<LeaseRateOptionsByKey> {
  const keys = [...new Set(listingKeys.map((key) => key?.trim()).filter(Boolean))]
    .sort()
    .slice(0, MAX_KEYS)
  if (keys.length === 0) return {}
  try {
    return await cachedLeaseRateOptions(keys)
  } catch {
    return {}
  }
}
