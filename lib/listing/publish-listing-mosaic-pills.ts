/**
 * Mosaic captions and gallery tabs. The mosaic is stills of this house.
 * Photo count, 3D, floor, and street view are quiet type on the mosaic.
 * The map is not a caption and not a tile.
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { publishListingHeroVideo, publishListingVirtualTour } from './publish-listing-hero-video'

export type ListingMosaicPillId = 'photos' | 'video' | 'tour' | 'floor' | 'street'

export type ListingMosaicPill = {
  id: ListingMosaicPillId
  label: string
  action: 'gallery' | 'video' | 'tour' | 'floor' | 'street'
}

export function publishListingMosaicPills(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
  hasStreetView?: boolean
}): ListingMosaicPill[] {
  if (input.photoCount <= 0) return []
  const pills: ListingMosaicPill[] = [
    {
      id: 'photos',
      label: `${input.photoCount} photos`,
      action: 'gallery',
    },
  ]
  if (publishListingVirtualTour(input.videos)) {
    pills.push({ id: 'tour', label: '3D', action: 'tour' })
  }
  if ((input.floorPlanCount ?? 0) > 0) {
    pills.push({ id: 'floor', label: 'Floor', action: 'floor' })
  }
  if (input.hasStreetView) {
    pills.push({ id: 'street', label: 'Street view', action: 'street' })
  }
  return pills
}

export type ListingGalleryTabId =
  | 'photos'
  | 'floor'
  | 'tour'
  | 'video'
  | 'street'
  | 'redesign'

export type ListingGalleryTab = {
  id: ListingGalleryTabId
  label: string
}

/**
 * Desktop tab row, Motion God order:
 * Photos / Floor plan / 3D / Video / Street view / Redesign.
 * Only tabs this listing actually has. Street view and Redesign stay off
 * until those media exist.
 */
export function publishListingGalleryTabs(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
  hasStreetView?: boolean
  hasRedesign?: boolean
}): ListingGalleryTab[] {
  const tabs: ListingGalleryTab[] = []
  if (input.photoCount > 0) tabs.push({ id: 'photos', label: 'Photos' })
  if ((input.floorPlanCount ?? 0) > 0) tabs.push({ id: 'floor', label: 'Floor plan' })
  if (publishListingVirtualTour(input.videos)) tabs.push({ id: 'tour', label: '3D' })
  if (publishListingHeroVideo(input.videos)) tabs.push({ id: 'video', label: 'Video' })
  if (input.hasStreetView) tabs.push({ id: 'street', label: 'Street view' })
  if (input.hasRedesign) tabs.push({ id: 'redesign', label: 'Redesign' })
  return tabs
}

export type ListingGalleryMobilePillId = 'all' | 'video' | 'floor' | 'tour' | 'street'

export type ListingGalleryMobilePill = {
  id: ListingGalleryMobilePillId
  label: string
}

/** Mobile gallery pills. Only those this listing has. */
export function publishListingGalleryMobilePills(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
  floorPlanCount?: number
  hasStreetView?: boolean
}): ListingGalleryMobilePill[] {
  const pills: ListingGalleryMobilePill[] = []
  if (input.photoCount > 0) pills.push({ id: 'all', label: 'All' })
  if (publishListingHeroVideo(input.videos)) pills.push({ id: 'video', label: 'Video Tour' })
  if ((input.floorPlanCount ?? 0) > 0) pills.push({ id: 'floor', label: 'Floor plans' })
  if (publishListingVirtualTour(input.videos)) pills.push({ id: 'tour', label: '3D' })
  if (input.hasStreetView) pills.push({ id: 'street', label: 'Street view' })
  return pills
}
