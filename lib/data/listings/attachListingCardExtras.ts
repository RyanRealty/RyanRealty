/**
 * Extra leftover fields on search cards that listing_tile_mv
 * does not project: original ask, virtual tour URL, office name,
 * extra photo URIs, and the latest *current* price-drop event.
 *
 * ⚠️ Do not use listings.last_price_change_* / price_drop_count for the
 * drop badge. Those columns went stale on 2026-04-07. Canonical live
 * signal is activity_events (event_type = 'price_drop'). See getPriceDrops.ts.
 */
import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { fetchPagedRows } from '@/lib/supabase/paginate'

const PHOTO_CAP = 8
const ROW_CAP = 60
const RECENT_DROP_DAYS = 30

type DetailsPhotoJson = {
  Uri1600?: string
  UriLarge?: string
  Uri1280?: string
  Uri1024?: string
  Uri800?: string
  Uri640?: string
  Uri300?: string
}

/** Same listing photograph; Spark size is rewritten to the card render. */
function bestUri(p: DetailsPhotoJson): string | null {
  const raw =
    p.Uri1600 ??
    p.UriLarge ??
    p.Uri1280 ??
    p.Uri1024 ??
    p.Uri800 ??
    p.Uri640 ??
    p.Uri300 ??
    null
  return raw ? listingRowPhotoSrc(raw) : null
}

export type ListingCardPriceDrop = {
  previousPrice: number
  newPrice: number
  at: string
}

export type ListingCardExtras = {
  originalListPrice: number | null
  tourUrl: string | null
  listOfficeName: string | null
  photoUrls: string[]
  priceDrop: ListingCardPriceDrop | null
}

type ActivityDropRow = {
  listing_key?: string | null
  event_at?: string | null
  payload?: unknown
}

export function parseActivityPriceDrop(
  payload: unknown,
  eventAt: string | null | undefined,
): ListingCardPriceDrop | null {
  const at = (eventAt ?? '').trim()
  if (!at) return null
  if (!payload || typeof payload !== 'object') return null
  const raw = payload as { previous_price?: unknown; new_price?: unknown }
  const previousPrice = Number(raw.previous_price)
  const newPrice = Number(raw.new_price)
  if (!Number.isFinite(previousPrice) || !Number.isFinite(newPrice)) return null
  if (previousPrice <= newPrice) return null
  return { previousPrice, newPrice, at }
}

async function latestPriceDropsForKeys(
  keys: string[],
): Promise<Map<string, ListingCardPriceDrop>> {
  const out = new Map<string, ListingCardPriceDrop>()
  const sb = supabaseAnon()
  if (!sb || keys.length === 0) return out
  const { data, error } = await sb
    .from('activity_events')
    .select('listing_key, event_at, payload')
    .eq('event_type', 'price_drop')
    .in('listing_key', keys) // @canonical-key — keys come from listing_tile_mv ListingKey on the same card row
    .order('event_at', { ascending: false })
    .limit(Math.min(keys.length * 4, 500))
  if (error) console.error('[attachListingCardExtras] price drops not read', error.message)
  if (error || !data) return out
  for (const row of data as ActivityDropRow[]) {
    const key = row.listing_key?.trim()
    if (!key || out.has(key)) continue
    const drop = parseActivityPriceDrop(row.payload, row.event_at)
    if (drop) out.set(key, drop)
  }
  return out
}

/**
 * Every current price drop in the last N days, the newest event per listing.
 * Paged in (event_at, id) order, newest first: 30 days held 2,180 price_drop
 * events on 2026-10-01, and the single read this replaces stopped at
 * PostgREST's 1,000, so every drop older than about two weeks fell off the
 * homepage and /buy cards (SITE-212 review).
 */
async function readRecentPriceDrops(
  days: number,
): Promise<{ drops: Map<string, ListingCardPriceDrop>; error: string | null }> {
  const drops = new Map<string, ListingCardPriceDrop>()
  const sb = supabaseAnon()
  if (!sb) return { drops, error: 'no Supabase client' }
  const window = Math.min(Math.max(days, 1), 45)
  const windowStart = new Date(Date.now() - window * 86_400_000).toISOString()
  const { rows, error } = await fetchPagedRows<ActivityDropRow>((from, to) =>
    sb
      .from('activity_events')
      .select('listing_key, event_at, payload')
      .eq('event_type', 'price_drop')
      .gte('event_at', windowStart)
      .order('event_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
  for (const row of rows) {
    const key = row.listing_key?.trim()
    if (!key || drops.has(key)) continue
    const drop = parseActivityPriceDrop(row.payload, row.event_at)
    if (drop) drops.set(key, drop)
  }
  return { drops, error: error?.message ?? null }
}

async function fetchRecentPriceDropEntries(days: number): Promise<Array<[string, ListingCardPriceDrop]>> {
  const { drops, error } = await readRecentPriceDrops(days)
  if (error) {
    // Logged here: makeResilientCached swallows the throw. Thrown, never cached
    // as "no drops" (it falls back to [] for this call only).
    console.error('[getRecentPriceDropEntries] price drops not read', error)
    throw new Error(`[getRecentPriceDropEntries] price drops not read: ${error}`)
  }
  return [...drops.entries()]
}

/**
 * The newest price drop per listing over the last N days, one read shared by
 * the homepage and /buy rails (loadRecentPriceDropEvents) and the search
 * results' "Price drop" badge, cached ten minutes. A card shows it only while
 * the drop is still current (currentPriceDrop): /price-drops applies the same
 * test, previous price above today's ask.
 */
export const getRecentPriceDropEntries = makeResilientCached(
  fetchRecentPriceDropEntries,
  ['recent-price-drop-entries-v1'],
  { revalidate: 600, tags: [cacheTag.listings] },
  [],
)

/** Latest current price-drop events in the last N days (homepage rails). */
export async function loadRecentPriceDropEvents(
  days = RECENT_DROP_DAYS,
): Promise<Map<string, ListingCardPriceDrop>> {
  return new Map(await getRecentPriceDropEntries(days))
}

/**
 * A drop event still describes the listing only while its previous price is
 * above today's ask: a cut followed by a raise (a price_increase event, which
 * this read does not see) is not a price drop any more. The homepage rail
 * (currentDrop) makes the same test; /price-drops makes it too, inside its own
 * narrower set (single-family, $50K and up, the last 7 days). No ask, or a
 * zero one, says nothing.
 */
export function currentPriceDrop(
  drop: ListingCardPriceDrop | null | undefined,
  listPrice: number | string | null | undefined,
): ListingCardPriceDrop | null {
  const ask = listPrice == null ? NaN : Number(listPrice)
  if (!drop || !Number.isFinite(ask) || ask <= 0) return null
  return drop.previousPrice > ask ? drop : null
}

export async function attachListingCardExtras(
  keys: string[],
): Promise<Map<string, ListingCardExtras>> {
  const sb = supabaseAnon()
  const out = new Map<string, ListingCardExtras>()
  if (!sb || keys.length === 0) return out
  const slice = keys.filter(Boolean).slice(0, ROW_CAP)
  const [{ data, error }, drops] = await Promise.all([
    sb
      .from('listings')
      // OriginalListPrice is mixed case, passed bare to supabase-js. From 2026-09-21
      // to 09-30 this read named original_list_price, which listings does not have,
      // and failed on every call with nothing logged: cards went without their extra
      // photos, tour, office and original price, and search cards without their drop
      // badge. ci:listings-select-columns now fails a column listings does not have.
      // Photos is only the photo list out of details (the whole raw MLS payload).
      .select('ListingKey, OriginalListPrice, virtual_tour_url, ListOfficeName, PhotoURL, Photos:details->Photos')
      .in('ListingKey', slice), // @canonical-key — keys come from listing_tile_mv ListingKey on the same card row
    latestPriceDropsForKeys(slice),
  ])
  if (error) console.error('[attachListingCardExtras] listings read failed', error.message)
  for (const raw of (data ?? []) as Array<{
    ListingKey?: string | null
    OriginalListPrice?: number | string | null
    virtual_tour_url?: string | null
    ListOfficeName?: string | null
    PhotoURL?: string | null
    Photos?: DetailsPhotoJson[] | null
  }>) {
    const key = raw.ListingKey?.trim()
    if (!key) continue
    const photos: string[] = []
    const seen = new Set<string>()
    const push = (url: string | null | undefined) => {
      const next = url?.trim()
      if (!next || seen.has(next)) return
      seen.add(next)
      photos.push(next)
    }
    // Prefer sized detail photos (large) over a possibly tiny PhotoURL lead.
    for (const photo of Array.isArray(raw.Photos) ? raw.Photos : []) {
      if (photos.length >= PHOTO_CAP) break
      push(bestUri(photo))
    }
    if (photos.length === 0) push(raw.PhotoURL ? listingRowPhotoSrc(raw.PhotoURL) : raw.PhotoURL)
    const original =
      raw.OriginalListPrice != null && Number.isFinite(Number(raw.OriginalListPrice))
        ? Number(raw.OriginalListPrice)
        : null
    const priceDrop = drops.get(key) ?? null
    out.set(key, {
      originalListPrice: original,
      tourUrl: raw.virtual_tour_url?.trim() || null,
      listOfficeName: raw.ListOfficeName?.trim() || null,
      photoUrls: photos,
      priceDrop,
    })
  }
  // A drop is its own read (activity_events): a failed or partial listings read keeps it.
  for (const [key, priceDrop] of drops) {
    if (!out.has(key)) {
      out.set(key, { originalListPrice: null, tourUrl: null, listOfficeName: null, photoUrls: [], priceDrop })
    }
  }
  return out
}
