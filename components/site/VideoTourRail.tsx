/**
 * VideoTourRail — server wrapper that fetches the most-expensive listings WITH a
 * video for a given context (homepage / city / neighborhood) and renders the
 * client VideoSlider. Drop it near the top of any page.
 *
 * Data (§0, real listings only):
 *   - No geo  -> getCentralOregonHomeVideoTours() (pre-built video_tours_cache,
 *     price_desc, falls back to a live fetch).
 *   - city / community -> getListingsWithVideos({ ..., sort: 'price_desc' }).
 *
 * Renders nothing when there are no video listings for the context, so it is
 * safe to place unconditionally.
 */
import { VideoSlider, type VideoSlideItem } from './VideoSlider.client'
import {
  getCentralOregonHomeVideoTours,
  getListingsWithVideos,
} from '@/app/actions/videos'

type Props = {
  /** City name (e.g. "Bend") to scope the rail to one city. */
  city?: string | null
  /** Subdivision / community / neighborhood name to scope the rail. */
  community?: string | null
  eyebrow?: string
  title?: string
  limit?: number
}

export async function VideoTourRail({
  city,
  community,
  eyebrow,
  title,
  limit = 12,
}: Props) {
  const scoped = !city?.trim() && !community?.trim()
  let rows = scoped
    ? await getCentralOregonHomeVideoTours()
    : await getListingsWithVideos({
        ...(city?.trim() ? { city: city.trim() } : {}),
        ...(community?.trim() ? { community: community.trim() } : {}),
        sort: 'price_desc',
        status: 'active',
        limit,
      })

  // Matt wants a rail on every page. If a city or community has no video
  // listings of its own, fall back to the Central Oregon set rather than hide.
  if (!scoped && (!rows || rows.length === 0)) {
    rows = await getCentralOregonHomeVideoTours()
  }

  const items: VideoSlideItem[] = (rows ?? [])
    .filter((r) => r.listing_key && (r.video_url ?? '').trim())
    .slice(0, limit)
    .map((r) => ({
      listingKey: r.listing_key,
      posterUrl: r.photo_url ?? null,
      price: r.list_price ?? null,
      addressLine: (r.unparsed_address ?? '').trim() || 'View this home',
      cityLine: [r.subdivision_name, r.city].filter(Boolean).join(' · '),
    }))

  if (!items.length) return null

  return (
    <VideoSlider
      items={items}
      eyebrow={eyebrow ?? 'Video tours'}
      title={title ?? 'Walk through these homes'}
    />
  )
}
