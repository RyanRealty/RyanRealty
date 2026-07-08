import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import { listingDetailPath, displaySubdivision } from '@/lib/slug'
import type { KbFeaturedItem } from '@/components/site/kb/types'
import type { ListingTile } from '@/lib/data'

/**
 * Resolve active listing tiles into KB featured items — the SINGLE source for the
 * homepage + every city/community page (no fork). Each home's MLS media is
 * classified into:
 *   - `video`: a clean, silent, chrome-less background loop that autoplays in the
 *     tile on focus/scroll (Vimeo background, YouTube controls-off, Cloudflare, or
 *     a direct mp4). No play button, no controls.
 *   - `tour`:  the home HAS media but it can't autoplay chrome-less in a tile
 *     (Aryeo watch page, Zillow 3D pano, Matterport, iGuide). The tile stays a
 *     photo and shows a "Tour" badge that opens the listing where the tour plays.
 * Homes sort background-video first, then tour, then photo-only, so the grid leads
 * with motion. Every figure stays live (§0); failure-safe per listing.
 */
export async function resolveFeaturedItems(tiles: ListingTile[], limit = 6): Promise<KbFeaturedItem[]> {
  const candidates = tiles.filter((t) => t.photoUrl).slice(0, 12)
  const media = await Promise.all(
    candidates.map((t) =>
      getListingVideos(t.listingKey)
        .then((vids) => {
          let bg: { url: string; embedType: 'iframe' | 'video-tag' } | null = null
          for (const v of vids) {
            const cand = toTileBackgroundVideo(v)
            if (cand) {
              bg = cand
              break
            }
          }
          return { bg, hasMedia: vids.length > 0 }
        })
        .catch(() => ({ bg: null as { url: string; embedType: 'iframe' | 'video-tag' } | null, hasMedia: false })),
    ),
  )
  const rank = (m: { bg: unknown; hasMedia: boolean }) => (m.bg ? 0 : m.hasMedia ? 1 : 2)
  return candidates
    .map((t, i) => ({ t, m: media[i]! }))
    .sort((a, b) => rank(a.m) - rank(b.m))
    .slice(0, limit)
    .map(({ t, m }) => ({
      price: t.listPrice,
      address: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
      sub: displaySubdivision(t.subdivisionName) ?? '',
      city: t.city ?? '',
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
      acres: t.lotSizeAcres ?? null,
      img: t.photoUrl ?? '',
      href: listingDetailPath(
        t.listingKey,
        { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city, postalCode: t.postalCode },
        { city: t.city, subdivision: t.subdivisionName },
        { mlsNumber: t.listNumber },
      ),
      video: m.bg,
      tour: !m.bg && m.hasMedia,
    }))
}
