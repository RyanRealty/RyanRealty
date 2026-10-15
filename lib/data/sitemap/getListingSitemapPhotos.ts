/**
 * Every photo of a bounded set of listings, for one /sitemaps/listing-photos
 * part (2026-10-14). Pure shaping is in listing-photo-sitemap.ts.
 *
 * TOAST (docs/TOAST_READ_DISCIPLINE.md): `Photos:details->Photos` detoasts the
 * ~10 KB details document once per row, so this read is narrowed by primary
 * key, `.in('ListingKey', batch)`, BATCH_SIZE at a time, over the ~370 listings
 * of one part. About 370 x 1.4-3.8 ms of database time per part, once per
 * sitemap revalidation window, never per page view.
 *
 * Suppression, checked here on the listings row itself (belt and braces: the
 * caller's listing set already comes from listing_tile_mv, whose predicates
 * drop the internet and non-IDX opt-outs):
 *   media_suppressed    owner media-removal request: no photos at all
 *   permit_internet_yn  seller internet opt-out (ODS §5-3 B)
 *   permit_address_internet_yn  seller withheld the address: the listing
 *                       page is a 404 (getListingDetail), so its address-
 *                       bearing URL never goes in a sitemap. listing_tile_mv
 *                       does NOT drop these rows, so this check is the filter.
 *   idx_participant     non-IDX listing brokerage (ODS §5-3 G)
 *
 * Throws when a batch still fails after its retry: the route answers an error
 * and the CDN keeps the last good file, rather than caching a part with
 * listings silently missing.
 */
import { supabaseAnon } from '@/lib/data/client'
import { listingSitemapPhotoUrls } from '@/lib/data/sitemap/listing-photo-sitemap'

const BATCH_SIZE = 50
const BATCH_CONCURRENCY = 2

type PhotoRow = {
  ListingKey: string | null
  PhotoURL: string | null
  media_suppressed: boolean | null
  permit_internet_yn: boolean | null
  permit_address_internet_yn: boolean | null
  idx_participant: boolean | null
  Photos: unknown
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

async function readBatch(keys: readonly string[]): Promise<PhotoRow[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getListingSitemapPhotos] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing')
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('listings')
      .select('ListingKey, PhotoURL, media_suppressed, permit_internet_yn, permit_address_internet_yn, idx_participant, Photos:details->Photos')
      .in('ListingKey', keys as string[]) // @canonical-key — keys are listing_tile_mv listing_key (the listings.xml set)
    if (!error) return (data ?? []) as PhotoRow[]
    lastError = error
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
  }
  throw new Error(`[getListingSitemapPhotos] listings photo batch failed: ${errorMessage(lastError)}`)
}

/** ListingKey -> sitemap photo URLs (empty listings are left out of the map). */
export async function getListingSitemapPhotos(listingKeys: readonly string[]): Promise<Map<string, string[]>> {
  const keys = [...new Set(listingKeys.map((k) => k.trim()).filter(Boolean))]
  const batches: string[][] = []
  for (let i = 0; i < keys.length; i += BATCH_SIZE) batches.push(keys.slice(i, i + BATCH_SIZE))

  const out = new Map<string, string[]>()
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const results = await Promise.all(batches.slice(i, i + BATCH_CONCURRENCY).map((b) => readBatch(b)))
    for (const rows of results) {
      for (const row of rows) {
        const key = String(row.ListingKey ?? '').trim()
        if (!key) continue
        if (
          row.media_suppressed === true ||
          row.permit_internet_yn === false ||
          row.permit_address_internet_yn === false ||
          row.idx_participant === false
        ) continue
        const urls = listingSitemapPhotoUrls(row.Photos, row.PhotoURL)
        if (urls.length > 0) out.set(key, urls)
      }
    }
  }
  return out
}
