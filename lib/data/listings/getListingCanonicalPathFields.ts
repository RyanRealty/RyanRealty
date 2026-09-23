/**
 * Slim listings lookup for /listing/by-key → pretty-URL redirect.
 *
 * Selects ONLY the columns listingDetailPath needs. Do not use
 * getListingRawRowByKey / getListingDetail here — those pull photos,
 * agents, remarks, and the rest of the wide row for a hop that never
 * renders them.
 *
 * The column list, the display-permission refusal and the row → path mapping
 * live in ./listingCanonicalPathCore so the Edge twin
 * (./getListingCanonicalPathFieldsEdge, read by middleware.ts) cannot disagree
 * with this one about which row is a hit or where it points.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { resolveCanonicalListingKey } from './resolveCanonicalListingKey'
import {
  LISTING_CANONICAL_PATH_COLUMNS,
  mapListingCanonicalPathRow,
  mayDisplayListingPublicly,
  type ListingCanonicalPathFields,
} from './listingCanonicalPathCore'

export type { ListingCanonicalPathFields } from './listingCanonicalPathCore'

const PATH_SELECT = LISTING_CANONICAL_PATH_COLUMNS.join(', ')

/*
 * IDX compliance (ODS Rule B/G, NAR 7.58) — the same gate getListingDetail
 * applies, applied here too (2026-08-19).
 *
 * This lookup feeds /listing/by-key, whose generateMetadata published the
 * street address in the <title> and a self-canonical to the pretty URL. Without
 * the gate it did that for a listing whose seller opted out of internet
 * display: https://ryan-realty.com/homes-for-sale/listing/220215050 served
 * `<title>1801 Rosa Parks, Portland | …</title>` and a canonical to
 * /homes-for-sale/outside-boundaries/1801-rosa-parks-220215050 while the detail
 * page for that same row correctly refused. A hop that may not show the home
 * may not publish its address either. The predicate is
 * mayDisplayListingPublicly in ./listingCanonicalPathCore.
 *
 * Coming Soon needs no check here: the `Public read listings excludes coming
 * soon` RLS policy on `listings` already hides those rows from the anon client
 * this module uses.
 */

async function fetchPathFields(listingKey: string): Promise<ListingCanonicalPathFields | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  // @canonical-key — listingKey is already resolveCanonicalListingKey output.
  const { data, error } = await sb.from('listings').select(PATH_SELECT).eq('ListingKey', listingKey).maybeSingle()
  if (error) throw error
  if (!data || typeof data !== 'object') return null // poison-null-ok — genuine miss
  const row = data as Record<string, unknown>
  // A listing we may not display is a MISS for this hop, exactly as it is for
  // getListingDetail — the caller then renders the refusal instead of a
  // redirect that names the address. poison-null-ok — a permission flag is
  // durable, not transient.
  if (!mayDisplayListingPublicly(row)) return null
  return mapListingCanonicalPathRow(row)
}

/** Resolve ListNumber or ListingKey, then return path fields only. */
export async function getListingCanonicalPathFields(
  key: string
): Promise<ListingCanonicalPathFields | null> {
  const trimmed = String(key ?? '').trim()
  if (!trimmed) return null
  const listingKey = await resolveCanonicalListingKey(trimmed)
  if (!listingKey) return null
  return unstable_cache(
    () => fetchPathFields(listingKey),
    // v2 bump 2026-08-19 — evicts entries cached BEFORE the display-permission
    // gate above existed. unstable_cache survives a deploy (the Vercel Data
    // Cache is not per-build), so without the bump an already-cached
    // opted-out row keeps serving its street address in the by-key <title>
    // until the TTL expires. Reproduced locally: after adding the gate and
    // rebuilding, /homes-for-sale/listing/220221984 still served
    // "71 Graham, Portland" from the v1 entry while two uncached refused rows
    // correctly rendered the refusal.
    //
    // v3 bump 2026-09-23 (P14) — the selected columns changed (the boundary_*
    // columns left the row), so a v2 entry is a different shape.
    ['listing-canonical-path-fields-v3', listingKey],
    { revalidate: CACHE_WINDOWS.listingDetail, tags: [cacheTag.listings] }
  )()
}
