/**
 * Extract a playable tour or video URL from Spark/RESO `details` JSONB (or raw Spark row).
 * Keep in sync with sync pipeline and `fetchListingsWithVideos` (served via
 * `getListingsWithVideosCached` / `getSubdivisionVideoTours`).
 */
export type VideoTourSource = 'virtual_tour' | 'listing_video'

function parseDetailsObject(details: unknown): Record<string, unknown> | null {
  if (details == null) return null
  if (typeof details === 'string') {
    const s = details.trim()
    if (!s || (s[0] !== '{' && s[0] !== '[')) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>
  }
  return null
}

function firstVideoFromArray(
  videos: unknown,
  source: VideoTourSource
): { url: string; source: VideoTourSource } | null {
  if (!Array.isArray(videos)) return null
  for (const video of videos) {
    if (!video || typeof video !== 'object') continue
    const v = video as Record<string, unknown>
    const uri = String(v.Uri ?? v.uri ?? v.URL ?? v.url ?? v.Url ?? '').trim()
    if (uri) return { url: uri, source }
    const objectHtml = String(v.ObjectHtml ?? v.objectHtml ?? v.object_html ?? '').trim()
    if (objectHtml.length > 20) return { url: objectHtml, source }
  }
  return null
}

export function pickFirstVideoFromDetails(details: unknown): { url: string; source: VideoTourSource } | null {
  const d = parseDetailsObject(details)
  if (!d) return null

  const fromListingVideos =
    firstVideoFromArray(d.Videos, 'listing_video') ?? firstVideoFromArray(d.videos, 'listing_video')
  if (fromListingVideos) return fromListingVideos

  const fromTours =
    firstVideoFromArray(d.VirtualTours, 'virtual_tour') ?? firstVideoFromArray(d.virtualTours, 'virtual_tour')
  if (fromTours) return fromTours

  const fallbackTour = String(
    d.VirtualTourURLUnbranded ??
      d.virtualTourURLUnbranded ??
      d.VirtualTourURL ??
      d.virtualTourURL ??
      ''
  ).trim()
  if (fallbackTour) return { url: fallbackTour, source: 'virtual_tour' }

  return null
}

/** Prefer details, then raw Spark payload, then denormalized tour URL columns. */
export function pickFirstVideoFromListingRow(row: Record<string, unknown>): { url: string; source: VideoTourSource } | null {
  const fromDetails = pickFirstVideoFromDetails(row.details)
  if (fromDetails) return fromDetails
  const fromRaw = pickFirstVideoFromDetails(row.raw_data)
  if (fromRaw) return fromRaw
  const vt = String(
    row.virtual_tour_url ?? row.VirtualTourURL ?? row.VirtualTourURLUnbranded ?? ''
  ).trim()
  if (vt) return { url: vt, source: 'virtual_tour' }
  return null
}

export function resolveListingKeyFromRow(row: Record<string, unknown>): string {
  return String(row.ListingKey ?? row.listing_key ?? row.ListNumber ?? row.listing_id ?? '').trim()
}

/** For client components: same rules as server video picker + optional `has_virtual_tour` column. */
export function listingRowShowsVideoTile(row: {
  details?: unknown
  raw_data?: unknown
  has_virtual_tour?: boolean | null
  virtual_tour_url?: string | null
}): boolean {
  if (row.has_virtual_tour === true) return true
  return pickFirstVideoFromListingRow(row as Record<string, unknown>) != null
}
