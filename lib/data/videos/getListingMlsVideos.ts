/**
 * The MLS videos and tours of a bounded set of listings, in one read per batch
 * (2026-10-14). For surfaces that show many listings' videos at once: the
 * /videos tiles (36 to 60 listings) and /sitemaps/video.xml (the listings.xml
 * set). One listing's page keeps getListingVideos, which also reads our own
 * renders and video_tours_cache.
 *
 * WHY. listing_tile_mv carries has_virtual_tour but no URL, so every /videos
 * tile shipped tourUrl: null and the page emitted no VideoObject at all. The
 * URLs live in listings.details (Videos[], VirtualTours[]) and the typed
 * virtual_tour_url (the cleaned scalar tour field, listing-mapper).
 *
 * ONE DIFFERENCE FROM THE LISTING PAGE, on purpose. getListingVideos also reads
 * the two scalar fields details.VirtualTourURLUnbranded / Branded; here the
 * typed virtual_tour_url (the first of the two that cleans) stands in for
 * them, which saves two more detoasts per row. Those scalars carry no date, so
 * no VideoObject or video.xml entry depends on them; at worst a tile plays the
 * branded copy of a tour the page shows unbranded.
 *
 * TOAST (docs/TOAST_READ_DISCIPLINE.md): `details->Videos` and
 * `details->VirtualTours` detoast the ~10 KB document per row, so every read
 * is narrowed by primary key `.in('ListingKey', batch)`. With `onlyFlagged`
 * the typed has_virtual_tour / virtual_tour_url columns prefilter the batch
 * before any detoast. Those typed columns lag the jsonb in places (the TOAST
 * doc measured 969 jsonb-only tour rows on 2026-07-31), so a flagged-only read
 * can miss a video the page itself still shows; the sitemap accepts that to
 * avoid detoasting ~8,800 documents per regeneration.
 *
 * Suppressed media (media_suppressed), the seller internet opt-out, the
 * address-only opt-out and non-IDX listings return nothing. Shaping is
 * lib/listing/listing-video-assembly.ts, the same as the listing page.
 * Throws when a batch fails twice; callers fall back or keep their last file.
 */
import { supabaseAnon } from '@/lib/data/client'
import type { VideoEmbed } from '@/lib/data/types/video'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import {
  createListingVideoCollector,
  latestMediaHistoryDates,
  mlsDetailsVideoCandidates,
  needsMediaHistoryDate,
  type MediaHistoryDates,
} from '@/lib/listing/listing-video-assembly'

export type ListingMlsVideos = {
  videos: VideoEmbed[]
  /** listings.PhotoURL, the MLS lead photo. */
  leadPhotoUrl: string | null
}

type Row = {
  ListingKey: string | null
  PhotoURL: string | null
  media_suppressed: boolean | null
  permit_internet_yn: boolean | null
  permit_address_internet_yn: boolean | null
  idx_participant: boolean | null
  virtual_tour_url: string | null
  Videos: unknown
  VirtualTours: unknown
}

const BATCH_CONCURRENCY = 3

const SELECT =
  'ListingKey, PhotoURL, media_suppressed, permit_internet_yn, permit_address_internet_yn, idx_participant, virtual_tour_url, Videos:details->Videos, VirtualTours:details->VirtualTours'

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

async function withOneRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>, label: string): Promise<T> {
  const first = await fn()
  if (!first.error) return first
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
  const second = await fn()
  if (second.error) throw new Error(`[getListingMlsVideos] ${label}: ${errorMessage(second.error)}`)
  return second
}

function batches(keys: readonly string[], size: number): string[][] {
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))]
  const out: string[][] = []
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size))
  return out
}

/** ListingKey -> its MLS videos and lead photo. Listings with no video are left out. */
export async function getListingMlsVideosByKeys(
  listingKeys: readonly string[],
  options: { onlyFlagged?: boolean } = {},
): Promise<Map<string, ListingMlsVideos>> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getListingMlsVideos] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing')
  const out = new Map<string, ListingMlsVideos>()
  const now = new Date()
  const all = batches(listingKeys, options.onlyFlagged ? 100 : 50)
  // Three batches in flight: a sitemap's ~90 primary-key batches finish in a
  // fraction of the sequential time without crowding the pool.
  const rows: Row[] = []
  for (let i = 0; i < all.length; i += BATCH_CONCURRENCY) {
    const pages = await Promise.all(
      all.slice(i, i + BATCH_CONCURRENCY).map((batch) =>
        withOneRetry(() => {
          const base = supabase.from('listings').select(SELECT).in('ListingKey', batch)
          return options.onlyFlagged ? base.or('has_virtual_tour.eq.true,virtual_tour_url.not.is.null') : base
        }, 'listings video batch'),
      ),
    )
    for (const page of pages) rows.push(...((page.data ?? []) as unknown as Row[]))
  }
  const history = await readMediaHistoryDates(
    rows
      .filter((r) => needsMediaHistoryDate({ Videos: r.Videos, VirtualTours: r.VirtualTours }, now))
      .map((r) => String(r.ListingKey ?? '').trim())
      .filter(Boolean),
    now,
  )
  for (const row of rows) {
    const key = String(row.ListingKey ?? '').trim()
    if (!key) continue
    if (
      row.media_suppressed === true ||
      row.permit_internet_yn === false ||
      row.permit_address_internet_yn === false ||
      row.idx_participant === false
    ) {
      continue
    }
    const collector = createListingVideoCollector()
    collector.pushCandidates(
      mlsDetailsVideoCandidates(
        { Videos: row.Videos, VirtualTours: row.VirtualTours, VirtualTourURLUnbranded: row.virtual_tour_url },
        now,
        history.get(key) ?? {},
      ),
    )
    const videos = collector.list()
    if (videos.length > 0) out.set(key, { videos, leadPhotoUrl: row.PhotoURL ?? null })
  }
  return out
}

/**
 * listing_history `Video` / `VirtualTour` dates for listings whose single media
 * record carries the feed's 1970 sentinel (lib/listing/listing-video-assembly.ts).
 * A failed batch dates nothing in it rather than failing the caller.
 */
async function readMediaHistoryDates(listingKeys: readonly string[], now: Date): Promise<Map<string, MediaHistoryDates>> {
  const out = new Map<string, MediaHistoryDates>()
  const supabase = supabaseAnon()
  if (!supabase || listingKeys.length === 0) return out
  // 20 listings a batch keeps a response far under PostgREST's 1,000-row cap
  // (a listing logs a few to a few dozen media events).
  // Ten listings a batch, newest events first, so a response cut at the 1,000
  // row cap drops the OLDEST events (a listing logs one per media write), never
  // the latest one a date is taken from.
  const all = batches(listingKeys, 10)
  const pages: Array<{ data: unknown[] | null; error: unknown }> = []
  for (let i = 0; i < all.length; i += BATCH_CONCURRENCY) {
    pages.push(
      ...(await Promise.all(
        all.slice(i, i + BATCH_CONCURRENCY).map(async (batch) => {
          const { data, error } = await supabase
            .from('listing_history')
            .select('listing_key, event, event_date')
            .in('listing_key', batch)
            .in('event', ['Video', 'VirtualTour'])
            .order('event_date', { ascending: false })
            .limit(1000)
          return { data: (data ?? null) as unknown[] | null, error }
        }),
      )),
    )
  }
  for (const { data, error } of pages) {
    if (error || !data) {
      console.error(`[getListingMlsVideos] listing_history batch failed, those videos stay undated: ${errorMessage(error)}`)
      continue
    }
    const byKey = new Map<string, Array<{ event: string | null; event_date: string | null }>>()
    for (const r of data as Array<{ listing_key: string | null; event: string | null; event_date: string | null }>) {
      const key = String(r.listing_key ?? '').trim()
      if (!key) continue
      const list = byKey.get(key) ?? []
      list.push(r)
      byKey.set(key, list)
    }
    for (const [key, events] of byKey) out.set(key, latestMediaHistoryDates(events, now))
  }
  return out
}

/** What a VideoObject names: the street line the listing page prints, its city, its brokerage. */
export type ListingVideoPlace = {
  street: string | null
  city: string | null
  listOfficeName: string | null
}

type PlaceRow = {
  ListingKey: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  ListOfficeName: string | null
  StreetDirPrefix: string | null
  StreetSuffix: string | null
  StreetDirSuffix: string | null
}

/**
 * Street line (publishStreetLine with the MLS directionals and suffix, the
 * same bits the listing page uses), city and listing brokerage for the few
 * listings that carry a VideoObject. The directionals and suffix live only in
 * details, so this is narrowed by ListingKey and called only for listings
 * whose video qualifies.
 */
export async function getListingVideoPlacesByKeys(listingKeys: readonly string[]): Promise<Map<string, ListingVideoPlace>> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getListingMlsVideos] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing')
  const out = new Map<string, ListingVideoPlace>()
  const all = batches(listingKeys, 50)
  for (let i = 0; i < all.length; i += BATCH_CONCURRENCY) {
    const pages = await Promise.all(
      all.slice(i, i + BATCH_CONCURRENCY).map((batch) =>
        withOneRetry(
          () =>
            supabase
              .from('listings')
              .select(
                'ListingKey, StreetNumber, StreetName, City, ListOfficeName, StreetDirPrefix:details->>StreetDirPrefix, StreetSuffix:details->>StreetSuffix, StreetDirSuffix:details->>StreetDirSuffix',
              )
              .in('ListingKey', batch),
          'listings place batch',
        ),
      ),
    )
    for (const page of pages) {
      for (const r of (page.data ?? []) as unknown as PlaceRow[]) {
        const key = String(r.ListingKey ?? '').trim()
        if (!key || out.has(key)) continue
        out.set(key, {
          street: publishStreetLine({
            streetNumber: r.StreetNumber,
            streetDirPrefix: r.StreetDirPrefix,
            streetName: r.StreetName,
            streetSuffix: r.StreetSuffix,
            streetDirSuffix: r.StreetDirSuffix,
          }),
          city: r.City?.trim() || null,
          listOfficeName: r.ListOfficeName?.trim() || null,
        })
      }
    }
  }
  return out
}
