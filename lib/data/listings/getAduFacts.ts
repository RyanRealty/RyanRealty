/**
 * getAduFacts — the MLS accessory-dwelling-unit fields on given listings.
 *
 * The pricing facts pool (sale_pricing_facts) carries a sale's remarks, not
 * its ADU fields, so the ADU value read (lib/pricing/adu-value.ts) comes here
 * for the recorded area and the recorded yes-or-no on the closed sales it
 * pairs: `details->>"Accessory Dwelling Unit YN"`, `details->>"ADU SqFt"`,
 * `details->>"ADU Type"`. Three json paths, never the payload, keyed by
 * ListingKey and chunked under the URL cliff getListingTiles measured. The
 * keys have spaces, so PostgREST needs them double-quoted inside the path
 * (the form getLeaseRateOptions verified on 2026-09-23).
 *
 * On 2026-10-14 the field was filled on seven of forty-five ADU sales within
 * two miles of Midtown Bend (recent records); the rest state the area in the
 * remarks or not at all. A missing field reads null and the caller falls back
 * to the remarks. A recorded "No" reads false, and the caller drops the sale:
 * a remark that says ADU on a record whose field says No is not a reading.
 *
 * NEVER BLOCKS A BUILD. The fetch throws on a database error so a blip is
 * never cached as "no ADU"; the resilient wrapper retries once uncached and
 * then returns {}, and a sale with no facts falls back to its remarks.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type AduFacts = {
  /** MLS Accessory Dwelling Unit YN: true, false, or null when the field is blank. */
  aduYn: boolean | null
  /** MLS ADU SqFt, or null when blank or not a positive number. */
  aduSqft: number | null
  /** MLS ADU Type (Detached, Attached, ...), or null. */
  aduType: string | null
}

/** ListingKey → its ADU fields. A key with no row is absent. */
export type AduFactsByKey = Record<string, AduFacts>

/** Keys per keyed read: well under the ~530-key URL cliff (getListingTiles KEY_CHUNK). */
const KEY_CHUNK = 200
/** More than any ADU pairing reads: forty-five ADU sales within two miles of Midtown on 2026-10-14. */
const MAX_KEYS = 600

type AduRow = { ListingKey: string | null; adu_yn: unknown; adu_sqft: unknown; adu_type: unknown }

function ynOf(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  if (s === 'yes' || s === 'y' || s === 'true') return true
  if (s === 'no' || s === 'n' || s === 'false') return false
  return null
}

function numOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchAduFacts(keys: string[]): Promise<AduFactsByKey> {
  const sb = supabaseAnon()
  if (!sb) return {}
  const out: AduFactsByKey = {}
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK)
    const { data, error } = await sb
      .from('listings')
      .select('ListingKey, adu_yn:details->>"Accessory Dwelling Unit YN", adu_sqft:details->>"ADU SqFt", adu_type:details->>"ADU Type"')
      .in('ListingKey', chunk) // @canonical-key: callers pass sale_pricing_facts.listing_key, the MLS ListingKey
    if (error) {
      throw new Error(`[getAduFacts] supabase error: ${error.message}`)
    }
    for (const row of (data ?? []) as unknown as AduRow[]) {
      const key = row.ListingKey?.trim()
      if (!key) continue
      out[key] = {
        aduYn: ynOf(row.adu_yn),
        aduSqft: numOf(row.adu_sqft),
        aduType: typeof row.adu_type === 'string' && row.adu_type.trim() ? row.adu_type.trim() : null,
      }
    }
  }
  return out
}

const cachedAduFacts = makeResilientCached(
  fetchAduFacts,
  // The fields change with a listing edit, so they refresh on the tile window.
  ['adu-facts-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  {} as AduFactsByKey,
)

/**
 * The MLS ADU fields for each listing key given. Keys with no row are absent.
 * Never throws: a failure reads as {}.
 */
export async function getAduFacts(listingKeys: readonly string[]): Promise<AduFactsByKey> {
  const keys = [...new Set(listingKeys.map((key) => key?.trim()).filter(Boolean))]
    .sort()
    .slice(0, MAX_KEYS)
  if (keys.length === 0) return {}
  try {
    return await cachedAduFacts(keys)
  } catch {
    return {}
  }
}
