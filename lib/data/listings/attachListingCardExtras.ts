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
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'

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
    .in('listing_key', keys)
    .order('event_at', { ascending: false })
    .limit(Math.min(keys.length * 4, 500))
  if (error || !data) return out
  for (const row of data as ActivityDropRow[]) {
    const key = row.listing_key?.trim()
    if (!key || out.has(key)) continue
    const drop = parseActivityPriceDrop(row.payload, row.event_at)
    if (drop) out.set(key, drop)
  }
  return out
}

/** Latest current price-drop events in the last N days (homepage rails). */
export async function loadRecentPriceDropEvents(
  days = RECENT_DROP_DAYS,
): Promise<Map<string, ListingCardPriceDrop>> {
  const out = new Map<string, ListingCardPriceDrop>()
  const sb = supabaseAnon()
  if (!sb) return out
  const window = Math.min(Math.max(days, 1), 45)
  const windowStart = new Date(Date.now() - window * 86_400_000).toISOString()
  const { data, error } = await sb
    .from('activity_events')
    .select('listing_key, event_at, payload')
    .eq('event_type', 'price_drop')
    .gte('event_at', windowStart)
    .order('event_at', { ascending: false })
    .limit(1000)
  if (error || !data) return out
  for (const row of data as ActivityDropRow[]) {
    const key = row.listing_key?.trim()
    if (!key || out.has(key)) continue
    const drop = parseActivityPriceDrop(row.payload, row.event_at)
    if (drop) out.set(key, drop)
  }
  return out
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
      .select('ListingKey, original_list_price, virtual_tour_url, ListOfficeName, PhotoURL, details')
      .in('ListingKey', slice), // @canonical-key — keys come from listing_tile_mv ListingKey on the same card row
    latestPriceDropsForKeys(slice),
  ])
  if (error || !data) return out
  for (const raw of data as Array<{
    ListingKey?: string | null
    original_list_price?: number | null
    virtual_tour_url?: string | null
    ListOfficeName?: string | null
    PhotoURL?: string | null
    details?: { Photos?: DetailsPhotoJson[] } | null
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
    for (const photo of raw.details?.Photos ?? []) {
      if (photos.length >= PHOTO_CAP) break
      push(bestUri(photo))
    }
    if (photos.length === 0) push(raw.PhotoURL ? listingRowPhotoSrc(raw.PhotoURL) : raw.PhotoURL)
    const original =
      raw.original_list_price != null && Number.isFinite(Number(raw.original_list_price))
        ? Number(raw.original_list_price)
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
  return out
}
