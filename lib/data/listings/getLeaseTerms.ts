/**
 * getLeaseTerms — a commercial lease's terms from its MLS payload: the lease
 * type flag, who pays which expenses, the zone and the parking count.
 *
 * THE READ. Keyed by ListingKey, restricted to PropertyType 'G', selecting
 * named json paths and never the payload (getLeaseRateOptions' pattern): the
 * flags `details->>NNN`, `->>NN`, `->>"Modified Gross"`, `->>Gross`, the
 * object `details->TenantPays`, `details->>Zoning` and
 * `details->>"# of Parking Spaces"`. Verified by row reads on 2026-09-25
 * (20260823210358661794000000: NNN true, TenantPays {Taxes, Insurance,
 * Repairs, Common Area Maintenance, ...}, Zoning "COMMERCIAL", 100 spaces).
 * The wording is publishLeaseTerms'; a page prints what comes back or nothing.
 *
 * NEVER BLOCKS A PAGE. A database error throws inside the cache so a blip is
 * never cached as "no terms"; the resilient wrapper retries once uncached and
 * then returns {}, and a lease with no terms prints its rent and size alone.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { publishLeaseTerms } from '@/lib/listing/publish-lease-terms'

/** ListingKey → the lease's terms, worded (possibly empty). */
export type LeaseTermsByKey = Record<string, string[]>

const KEY_CHUNK = 200
const MAX_KEYS = 1000

type LeaseTermsRow = {
  ListingKey: string | null
  nnn: unknown
  nn: unknown
  modgross: unknown
  gross: unknown
  tenant: unknown
  zoning: unknown
  parking: unknown
}

async function fetchLeaseTerms(keys: string[]): Promise<LeaseTermsByKey> {
  const sb = supabaseAnon()
  if (!sb) return {}
  const out: LeaseTermsByKey = {}
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK)
    const { data, error } = await sb
      .from('listings')
      .select(
        'ListingKey, nnn:details->>NNN, nn:details->>NN, modgross:details->>"Modified Gross", gross:details->>Gross, tenant:details->TenantPays, zoning:details->>Zoning, parking:details->>"# of Parking Spaces"',
      )
      .eq('PropertyType', 'G')
      .in('ListingKey', chunk) // @canonical-key: callers pass listing_tile_mv.listing_key, the MLS ListingKey
    if (error) {
      throw new Error(`[getLeaseTerms] supabase error: ${error.message}`)
    }
    for (const row of (data ?? []) as unknown as LeaseTermsRow[]) {
      const key = row.ListingKey?.trim()
      if (!key) continue
      out[key] = publishLeaseTerms({
        nnn: row.nnn,
        nn: row.nn,
        modifiedGross: row.modgross,
        gross: row.gross,
        tenantPays: row.tenant,
        zoning: row.zoning,
        parking: row.parking,
      })
    }
  }
  return out
}

const cachedLeaseTerms = makeResilientCached(
  fetchLeaseTerms,
  ['lease-terms-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  {} as LeaseTermsByKey,
)

/** The worded terms for each commercial-lease key given. Never throws: a failure reads as {}. */
export async function getLeaseTerms(listingKeys: readonly string[]): Promise<LeaseTermsByKey> {
  const keys = [...new Set(listingKeys.map((key) => key?.trim()).filter(Boolean))]
    .sort()
    .slice(0, MAX_KEYS)
  if (keys.length === 0) return {}
  try {
    return await cachedLeaseTerms(keys)
  } catch {
    return {}
  }
}
