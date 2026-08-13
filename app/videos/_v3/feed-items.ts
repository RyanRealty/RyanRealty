import type { ListingTile } from '@/lib/data'
import type { VideoFeedItem } from '@/components/site/VideoFeedClient'
import { listingTileHref } from '@/lib/slug'
import { normalizeEmbed } from '@/lib/video-embed'

export function tilesToFeedItems(tiles: readonly ListingTile[]): VideoFeedItem[] {
  const items: VideoFeedItem[] = []
  for (const t of tiles) {
    const videoUrl = t.tourUrl?.trim()
    if (!t.listingKey || !videoUrl) continue
    const norm = normalizeEmbed(videoUrl)
    if (!norm || norm.embedType === 'link') continue
    const addressLine = [t.streetNumber, t.streetName, t.streetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!addressLine) continue
    const cityLine = [t.subdivisionName, t.city].filter((part) => typeof part === 'string' && part.trim()).join(' · ')
    items.push({
      listingKey: t.listingKey,
      videoUrl,
      posterUrl: t.photoUrl ?? null,
      price: t.listPrice ?? null,
      addressLine,
      cityLine,
      detailHref: listingTileHref({
        listingKey: t.listingKey,
        listNumber: t.listNumber,
        streetNumber: t.streetNumber,
        streetName: t.streetName,
        city: t.city,
        subdivisionName: t.subdivisionName,
      }),
      beds: t.beds ?? null,
      baths: t.baths ?? null,
      sqft: t.sqft ?? null,
    })
  }
  return items
}
