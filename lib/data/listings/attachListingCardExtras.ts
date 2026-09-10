/**
 * Extra leftover fields on search cards that listing_tile_mv
 * does not project: original ask (for Price reduced $X), virtual tour URL,
 * office name, and extra photo URIs for the card carousel.
 */
import { supabaseAnon } from '@/lib/data/client'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'

const PHOTO_CAP = 8
const ROW_CAP = 60

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

export type ListingCardExtras = {
  originalListPrice: number | null
  tourUrl: string | null
  listOfficeName: string | null
  photoUrls: string[]
}

export async function attachListingCardExtras(
  keys: string[],
): Promise<Map<string, ListingCardExtras>> {
  const sb = supabaseAnon()
  const out = new Map<string, ListingCardExtras>()
  if (!sb || keys.length === 0) return out
  const slice = keys.filter(Boolean).slice(0, ROW_CAP)
  const { data, error } = await sb
    .from('listings')
    .select('ListingKey, original_list_price, virtual_tour_url, ListOfficeName, PhotoURL, details')
    .in('ListingKey', slice) // @canonical-key — keys come from listing_tile_mv ListingKey on the same card row
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
    out.set(key, {
      originalListPrice: original,
      tourUrl: raw.virtual_tour_url?.trim() || null,
      listOfficeName: raw.ListOfficeName?.trim() || null,
      photoUrls: photos,
    })
  }
  return out
}
