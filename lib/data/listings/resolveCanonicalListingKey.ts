/**
 * resolveCanonicalListingKey — THE one way to turn any listing identifier into
 * the canonical RETS ListingKey.
 *
 * Why this exists: canonical /homes-for-sale/<...>/<addr>-<listnum> pretty URLs
 * (every internal link + paid ad lands here) carry the MLS **ListNumber**. But
 * every related table — listing_photos, listing_videos, listing_agents,
 * listing_history, open_houses, engagement_metrics, similar_listings_mv — is
 * keyed by the RETS **ListingKey**. A lookup that does `.eq('listing_key', key)`
 * with a ListNumber silently returns NOTHING. That single mismatch has broken
 * the photo gallery, the video hero, the history timeline, and the similar-
 * listings rail — repeatedly.
 *
 * So: EVERY listing-data read funnels its key through here first. The
 * check-listing-key-lookup CI gate enforces it — a new `.eq('listing_key' /
 * 'ListingKey', <raw arg>)` on a listing table that does not resolve through
 * this helper fails the build.
 *
 * Resolves ListNumber first (the common pretty-URL case) then ListingKey, and
 * returns the input unchanged if neither matches (so a genuine ListingKey still
 * works even when the resolve query fails). Cached so a detail page that resolves
 * the same key across photos/videos/history/agents/etc. pays one DB round-trip.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

// @canonical-key — this IS the resolver; its dual-column lookup is the allowed
// exception the gate keys off of.
async function fetchCanonicalKey(key: string): Promise<string> {
  const sb = supabaseAnon()
  const k = String(key ?? '').trim()
  if (!sb || !k) return k
  let row = (await sb.from('listings').select('ListingKey').eq('ListNumber', k).maybeSingle())
    .data as { ListingKey?: string | null } | null
  if (!row) {
    row = (await sb.from('listings').select('ListingKey').eq('ListingKey', k).maybeSingle())
      .data as { ListingKey?: string | null } | null
  }
  return String(row?.ListingKey ?? k).trim()
}

export const resolveCanonicalListingKey = (key: string): Promise<string> =>
  unstable_cache(
    () => fetchCanonicalKey(key),
    ['canonical-listing-key-v1', String(key ?? '')],
    { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  )()
