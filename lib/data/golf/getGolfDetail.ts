/**
 * getGolfDetail — resolve a course from the canonical registry (data/golf/
 * courses.ts, the SAME registry that powers /lp/central-oregon-golf) + the REAL
 * active single-family homes near the clubhouse + the live city market band, for
 * the /central-oregon/golf/[slug] per-course page. One registry, no duplication.
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesInBox, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { cityToGeoSlug } from '@/lib/golf-format'
import { leftoverCityAreaMarket } from '@/lib/data/market-truth/leftover-area-market'
import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import type { AreaMarket } from '@/lib/area-market'

const LAT_PAD = 0.022
const LNG_PAD = 0.028
const MAX_HOMES = 60

export type TileVideo = { url: string; embedType: 'iframe' | 'video-tag' } | null

export type GolfHomeTile = {
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

export type GolfStats = { count: number; medianListPrice: number | null }

export type GolfDetail = {
  course: GolfCourse
  geoSlug: string
  homes: GolfHomeTile[]
  stats: GolfStats
  relatedCourses: GolfCourse[]
  cityMarket: AreaMarket | null
}

function getCourseBySlug(slug: string): GolfCourse | undefined {
  return GOLF_COURSES.find((c) => c.slug === slug)
}

async function attachTileVideos(homes: GolfHomeTile[]): Promise<void> {
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
async function fetchCourseHomes(course: GolfCourse): Promise<{ homes: GolfHomeTile[]; stats: NearbyHomeStats }> {
  const { homes, stats } = await fetchOnMarketHomesInBox({
    label: '[getGolfDetail] course homes',
    lat: course.lat,
    lng: course.lng,
    latPad: LAT_PAD,
    lngPad: LNG_PAD,
    maxTiles: MAX_HOMES,
  })
  return {
    homes: homes.map((h) => ({ ...h, video: null, hasTour: false })),
    stats,
  }
}

async function fetchGolfDetail(slug: string): Promise<GolfDetail | null> {
  const course = getCourseBySlug(slug)
  if (!course) return null

  const geoSlug = cityToGeoSlug(course.city)
  const { homes, stats } = await fetchCourseHomes(course)
  await attachTileVideos(homes)
  const relatedCourses = GOLF_COURSES.filter(
    (c) => c.slug !== course.slug && cityToGeoSlug(c.city) === geoSlug,
  )

  const cityMarket: AreaMarket | null = await leftoverCityAreaMarket({
    cityName: course.city.replace(/\s*\(.*?\)/g, '').split('/')[0].trim(),
    geoSlug,
  }).catch(() => null)

  return {
    course,
    geoSlug,
    homes,
    stats,
    relatedCourses,
    cityMarket,
  }
}

export function getGolfDetail(slug: string): Promise<GolfDetail | null> {
  return unstable_cache(() => fetchGolfDetail(slug), ['golf-detail-v4-full-set', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'golf'],
  })()
}
