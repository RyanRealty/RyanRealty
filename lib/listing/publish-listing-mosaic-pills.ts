/**
 * Pills painted ON the listing mosaic. Only pills that exist.
 * Price never lives on media. Floor plan / street / redesign stay off
 * until this listing actually has that media.
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { isListingVirtualTour, publishListingHeroVideo } from './publish-listing-hero-video'

export type ListingMosaicPillId = 'photos' | 'video' | 'tour' | 'floor'

export type ListingMosaicPill = {
  id: ListingMosaicPillId
  label: string
  action: 'gallery' | 'tour' | 'floor'
}

function listingTour(videos: ReadonlyArray<VideoEmbed>): VideoEmbed | undefined {
  return videos.find((row) =>
    isListingVirtualTour({
      url: row.url,
      hint: row.source,
      isVirtualTour: row.isVirtualTour,
    }),
  )
}

export function publishListingMosaicPills(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
}): ListingMosaicPill[] {
  const pills: ListingMosaicPill[] = []
  const video = publishListingHeroVideo(input.videos)
  const tour = listingTour(input.videos)
  if (video) pills.push({ id: 'video', label: 'Video', action: 'tour' })
  if (tour) pills.push({ id: 'tour', label: '3D', action: 'tour' })
  if ((input.floorPlanCount ?? 0) > 0) {
    pills.push({ id: 'floor', label: 'Floor plan', action: 'floor' })
  }
  if (input.photoCount > 0) {
    pills.push({
      id: 'photos',
      label: `${input.photoCount} photos`,
      action: 'gallery',
    })
  }
  return pills
}

export type ListingGalleryTabId = 'photos' | 'floor' | 'tour' | 'video'

export type ListingGalleryTab = {
  id: ListingGalleryTabId
  label: string
}

/** Desktop tab row. Only those this listing has. */
export function publishListingGalleryTabs(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
}): ListingGalleryTab[] {
  const tabs: ListingGalleryTab[] = []
  if (input.photoCount > 0) tabs.push({ id: 'photos', label: 'Photos' })
  if ((input.floorPlanCount ?? 0) > 0) tabs.push({ id: 'floor', label: 'Floor plan' })
  const tour = listingTour(input.videos)
  const video = publishListingHeroVideo(input.videos)
  if (tour) tabs.push({ id: 'tour', label: '3D' })
  if (video) tabs.push({ id: 'video', label: 'Video' })
  return tabs
}

export type ListingGalleryMobilePillId = 'all' | 'video' | 'floor' | 'tour'

export type ListingGalleryMobilePill = {
  id: ListingGalleryMobilePillId
  label: string
}

/** Mobile gallery pills. Only those this listing has. */
export function publishListingGalleryMobilePills(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
}): ListingGalleryMobilePill[] {
  const pills: ListingGalleryMobilePill[] = []
  if (input.photoCount > 0) pills.push({ id: 'all', label: 'All' })
  const video = publishListingHeroVideo(input.videos)
  if (video) pills.push({ id: 'video', label: 'Video Tour' })
  if ((input.floorPlanCount ?? 0) > 0) pills.push({ id: 'floor', label: 'Floor plans' })
  if (listingTour(input.videos)) pills.push({ id: 'tour', label: '3D' })
  return pills
}
