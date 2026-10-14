/**
 * The per-class sitemap row cache, shared by the public route and the warmer.
 *
 * WHY IT LIVES HERE (2026-08-02, third pass). The warmer used to warm the
 * sitemaps by fetching their public URLs five times:
 *
 *     for (const cls of SITEMAP_CLASSES) await fetch(`${baseUrl}/sitemaps/${cls}.xml`)
 *
 * and its comment claimed "the in-flight dedupe collapses them onto one shared
 * universe build". That is not true over HTTP. Each fetch is a separate lambda
 * invocation with its own module scope, so the module-level memo is never
 * shared, and because the calls are sequential there is no in-flight overlap to
 * dedupe in the first place. Every class paid a full ~10.7K-URL fan-out.
 *
 * Measured in production immediately after deploy, sequential, cold:
 *
 *     core.xml      504  300.6s     <- killed at maxDuration
 *     geo.xml       504  300.6s
 *     content.xml   200  146.7s     <- one build DID fit, on a warm instance
 *     listings.xml  504  300.2s
 *
 * One build takes ~147s. Five of them do not fit in a 300s ceiling; one plus
 * four cheap filters does, with room to spare. So the warmer now imports this
 * module and calls getClassRows() five times inside ONE invocation, where the
 * memo genuinely applies: one universe build, then four in-memory filters, and
 * all five unstable_cache entries written for the hour ahead.
 *
 * LISTINGS ARE NOT ON THAT FAN-OUT. getClassRows('listings') reads
 * listing_tile_mv through getListingSitemapRows (ordered, throw-on-error).
 * Filtering the universe for listings dropped 1,759 live keys (unordered
 * pages) and served an empty urlset when the universe threw.
 *
 * Kept out of lib/data/ deliberately — this is a cache/composition helper, not
 * a DAL read, and the DAL index gate AST-walks lib/data/**\/*.ts.
 */
import { siteOrigin } from '@/lib/site-origin'
import type { MetadataRoute } from 'next'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { buildAllUrls } from '@/app/sitemap'
import { classifySitemapUrl, type SitemapClass } from '@/lib/data/sitemap/classify'
import { getListingSitemapRows } from '@/lib/data/sitemap/getListingSitemapRows'
import type { ListingSitemapRow } from '@/lib/data/sitemap/listing-sitemap-path'
import { getListingSitemapPhotos } from '@/lib/data/sitemap/getListingSitemapPhotos'
import { listingPhotoSitemapPart } from '@/lib/data/sitemap/listing-photo-sitemap'
import { getListingMlsVideosByKeys, getListingVideoPlacesByKeys } from '@/lib/data/videos/getListingMlsVideos'
import { listingVideoDescription, publishListingVideos } from '@/lib/listing/publish-listing-video-schema'
import { LISTING_MOSAIC_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { getIndexablePresetSlugs } from '@/lib/search-presets'
import { createUniverseMemo } from '@/lib/sitemap-universe-memo'

export function siteBaseUrl(): string {
  return siteOrigin()
}

// Freshness is stamped on RESOLVE, so a build slower than its own TTL is still
// reused. 10 minutes covers a sequential sweep of all five classes plus the
// warmer. See lib/sitemap-universe-memo.ts and its tests for the invariant.
const UNIVERSE_TTL_MS = 600_000

const buildUniverseOnce = createUniverseMemo<MetadataRoute.Sitemap>(
  () => buildAllUrls(siteBaseUrl(), new Date()),
  UNIVERSE_TTL_MS,
)

/** [path, lastmodISO] or, for a listing with a photo, [path, lastmodISO, imageUrl]. */
export type SitemapClassRow = [string, string] | [string, string, string]

/**
 * Rows are [path, lastmodISO] tuples (plus an image URL on listing rows); path is relative to the site base URL
 * ('' for the homepage row). unstable_cache includes the cls argument in the
 * cache key, so each class caches independently and stays far under the 2MB
 * per-entry cap that broke v1.
 */
export const getClassRows = unstable_cache(
  async (cls: SitemapClass): Promise<SitemapClassRow[]> => {
    if (cls === 'listings') {
      const rows = await getListingSitemapRows()
      return rows.map((r) => (r.imageUrl ? [r.path, r.lastModified, r.imageUrl] : [r.path, r.lastModified]))
    }
    const baseUrl = siteBaseUrl()
    const urls = await buildUniverseOnce()
    const presetSlugs = new Set(getIndexablePresetSlugs())
    return urls
      .filter((u) => classifySitemapUrl(u.url, presetSlugs) === cls)
      .map((u) => [
        u.url.startsWith(baseUrl) ? u.url.slice(baseUrl.length) : u.url,
        u.lastModified instanceof Date ? u.lastModified.toISOString() : String(u.lastModified ?? ''),
      ])
  },
  // v4 (2026-09-24): PR #368 changed which market URLs the universe emits
  // (a registry community's market page is its community-grain path). The v3
  // entries built by the old code kept serving the three 301 sources for over
  // an hour after the deploy, so the key moves and the next read builds fresh.
  // Bump it again whenever buildAllUrls changes WHICH urls it emits.
  // v5 (2026-10-04): listing rows carry a third element, the lead photo URL.
  ['sitemap-class-urls-v5'],
  { revalidate: 3600 },
)

/**
 * The listings.xml listing set (Active, Active Under Contract, Pending, from
 * listing_tile_mv) with its ListingKeys, as compact [key, path, lastmod]
 * tuples: ~1 MB for ~8,800 listings, under unstable_cache's 2 MB entry. Cached
 * across instances for the hour, so the 24 photo parts and video.xml, each
 * served by whichever instance takes the request, share one listing read
 * instead of paging the set 25 times. A failed read throws and is not cached.
 */
const getListingSitemapKeyTuples = unstable_cache(
  async (): Promise<Array<[string, string, string]>> =>
    (await getListingSitemapRows()).map((r) => [r.listingKey, r.path, r.lastModified]),
  ['sitemap-listing-key-rows-v1'],
  { revalidate: 3600 },
)

/** The keyed listing set, also memoized per instance (unstable_cache does not dedupe in-flight misses). */
export const getListingSitemapRowsOnce = createUniverseMemo<ListingSitemapRow[]>(
  async () =>
    (await getListingSitemapKeyTuples()).map(([listingKey, path, lastModified]) => ({
      listingKey,
      path,
      lastModified,
      imageUrl: null,
    })),
  UNIVERSE_TTL_MS,
)

export type ListingPhotoSitemapEntry = { path: string; lastModified: string; images: string[] }

/**
 * One /sitemaps/listing-photos/{part}.xml: the listings.xml listings whose
 * ListingKey hashes to `part`, each with every photo (capped), in listing_key
 * order. A listing with no publishable photo is left out of the file.
 */
export async function getListingPhotoSitemapEntries(part: number): Promise<ListingPhotoSitemapEntry[]> {
  const rows = (await getListingSitemapRowsOnce()).filter((r) => listingPhotoSitemapPart(r.listingKey) === part)
  const photos = await getListingSitemapPhotos(rows.map((r) => r.listingKey))
  const out: ListingPhotoSitemapEntry[] = []
  for (const row of rows) {
    const images = photos.get(row.listingKey)
    if (images && images.length > 0) out.push({ path: row.path, lastModified: row.lastModified, images })
  }
  return out
}

export type ListingVideoSitemapVideo = {
  title: string
  description: string
  playerUrl: string
  thumbnailUrl: string
  publicationDate: string
}

export type ListingVideoSitemapEntry = { path: string; lastModified: string; videos: ListingVideoSitemapVideo[] }

/**
 * /sitemaps/video.xml (2026-10-14): every listings.xml listing whose MLS video
 * is a YouTube or Vimeo player with a dated MLS record, the same videos the
 * listing page's VideoObject describes (publishListingVideos), up to three per
 * listing. The typed tour flags prefilter before any details read
 * (getListingMlsVideosByKeys onlyFlagged), so a video only the jsonb knows of
 * is on its page but not here.
 */
export async function getListingVideoSitemapEntries(): Promise<ListingVideoSitemapEntry[]> {
  const rows = await getListingSitemapRowsOnce()
  const media = await getListingMlsVideosByKeys(
    rows.map((r) => r.listingKey),
    { onlyFlagged: true },
  )
  const qualifying = rows.flatMap((row) => {
    const m = media.get(row.listingKey)
    if (!m) return []
    const lead = m.leadPhotoUrl ? listingRowPhotoSrc(m.leadPhotoUrl, LISTING_MOSAIC_LEAD_PHOTO_SIZE) : null
    const published = publishListingVideos(m.videos, lead, 3)
    return published.length > 0 ? [{ row, published }] : []
  })
  // The street line the listing page prints (MLS directionals and suffix) and
  // the brokerage it credits, read only for the listings that qualify.
  const places = await getListingVideoPlacesByKeys(qualifying.map((q) => q.row.listingKey))
  const out: ListingVideoSitemapEntry[] = []
  for (const { row, published } of qualifying) {
    const p = places.get(row.listingKey)
    if (!p?.street) continue
    const place = `${p.street}${p.city ? `, ${p.city}, OR` : ''}`
    out.push({
      path: row.path,
      lastModified: row.lastModified,
      videos: published.map((v, i) => ({
        title: i === 0 ? `Video tour of ${place}` : `Video tour of ${place}, video ${i + 1}`,
        description: listingVideoDescription(place, p.listOfficeName),
        playerUrl: v.player.embedUrl,
        thumbnailUrl: v.thumbnailUrl,
        publicationDate: v.uploadDate,
      })),
    })
  }
  return out
}
