/**
 * getTrailDetail — resolve a trail registry entry + the REAL active single-family
 * homes near the trailhead (from our own MLS listings) + the live city market
 * band, for the /central-oregon/trails/[slug] page. Mirrors getGolfDetail (same
 * ~1.5-mile bounding box, video-attached tiles, market snapshot). Trail facts
 * come from the static registry (CLAUDE.md §0).
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesInBox, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import { getTrailBySlug, CO_TRAILS, type CoTrail } from '@/data/co-trails'
import { leftoverCityAreaMarket } from '@/lib/data/market-truth/leftover-area-market'
import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import type { AreaMarket } from '@/lib/area-market'

const LAT_PAD = 0.022
const LNG_PAD = 0.028
const MAX_HOMES = 60

export type TileVideo = { url: string; embedType: 'iframe' | 'video-tag' } | null

export type TrailHomeTile = {
  listingKey: string
  href: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressLine: string
  cityLine: string
  lat: number | null
  lng: number | null
  photoUrl: string | null
  video: TileVideo
  hasTour: boolean
}

export type TrailStats = { count: number; medianListPrice: number | null }

export type TrailDetail = {
  trail: CoTrail
  homes: TrailHomeTile[]
  stats: TrailStats
  relatedTrails: CoTrail[]
  cityMarket: AreaMarket | null
}

async function attachTileVideos(homes: TrailHomeTile[]): Promise<void> {
  const candidates = homes.filter((h) => h.photoUrl && h.listingKey).slice(0, 12)
  await Promise.all(
    candidates.map((h) =>
      getListingVideos(h.listingKey)
        .then((vids) => {
          for (const v of vids) {
            const bg = toTileBackgroundVideo(v)
            if (bg) {
              h.video = bg
              return
            }
          }
          h.hasTour = vids.length > 0
        })
        .catch(() => {}),
    ),
  )
  homes.sort((a, b) => (a.video ? 0 : a.hasTour ? 1 : 2) - (b.video ? 0 : b.hasTour ? 1 : 2))
}

/**
 * Every public on-market PropertyType 'A' home in the box, from listing_search_mv.
 * `stats` covers the full set; `homes` is its price-desc top slice (DATA-3/8).
 */
async function fetchTrailHomes(trail: CoTrail): Promise<{ homes: TrailHomeTile[]; stats: NearbyHomeStats }> {
  if (typeof trail.lat !== 'number' || typeof trail.lng !== 'number') {
    return { homes: [], stats: { count: 0, medianListPrice: null } }
  }
  const { homes, stats } = await fetchOnMarketHomesInBox({
    label: '[getTrailDetail] trail homes',
    lat: trail.lat,
    lng: trail.lng,
    latPad: LAT_PAD,
    lngPad: LNG_PAD,
    maxTiles: MAX_HOMES,
  })
  return {
    homes: homes.map((h) => ({ ...h, video: null, hasTour: false })),
    stats,
  }
}

async function fetchTrailDetail(slug: string): Promise<TrailDetail | null> {
  const trail = getTrailBySlug(slug)
  if (!trail) return null

  const { homes, stats } = await fetchTrailHomes(trail)
  await attachTileVideos(homes)
  const relatedTrails = CO_TRAILS.filter((t) => t.slug !== trail.slug && t.city === trail.city)

  const cityMarket: AreaMarket | null = await leftoverCityAreaMarket({
    cityName: trail.city,
    geoSlug: trail.geoSlug,
  }).catch(() => null)

  return {
    trail,
    homes,
    stats,
    relatedTrails,
    cityMarket,
  }
}

export function getTrailDetail(slug: string): Promise<TrailDetail | null> {
  return unstable_cache(() => fetchTrailDetail(slug), ['trail-detail-v3-full-set', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'trails'],
  })()
}
