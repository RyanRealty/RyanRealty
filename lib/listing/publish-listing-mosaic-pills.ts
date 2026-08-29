/**
 * Pills painted ON the listing mosaic. Only pills that exist.
 * Price never lives on media. Floor plan / street / redesign stay off
 * until this listing actually has that media.
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { isListingVirtualTour, publishListingHeroVideo } from './publish-listing-hero-video'

export type ListingMosaicPillId = 'photos' | 'video' | 'tour'

export type ListingMosaicPill = {
  id: ListingMosaicPillId
  label: string
  action: 'gallery' | 'tour'
}

export function publishListingMosaicPills(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
}): ListingMosaicPill[] {
  const pills: ListingMosaicPill[] = []
  const video = publishListingHeroVideo(input.videos)
  const tour = input.videos.find((row) =>
    isListingVirtualTour({
      url: row.url,
      hint: row.source,
      isVirtualTour: row.isVirtualTour,
    }),
  )
  if (video) pills.push({ id: 'video', label: 'Video', action: 'tour' })
  if (tour) pills.push({ id: 'tour', label: '3D', action: 'tour' })
  if (input.photoCount > 0) {
    pills.push({
      id: 'photos',
      label: `${input.photoCount} photos`,
      action: 'gallery',
    })
  }
  return pills
}

export type ListingGalleryTabId = 'photos' | 'video' | 'tour'

export type ListingGalleryTab = {
  id: ListingGalleryTabId
  label: string
}

/** Desktop tabs / mobile pills. Only those this listing has. */
export function publishListingGalleryTabs(input: {
  photoCount: number
  videos: ReadonlyArray<VideoEmbed>
}): ListingGalleryTab[] {
  const tabs: ListingGalleryTab[] = []
  if (input.photoCount > 0) tabs.push({ id: 'photos', label: 'Photos' })
  const video = publishListingHeroVideo(input.videos)
  const tour = input.videos.find((row) =>
    isListingVirtualTour({
      url: row.url,
      hint: row.source,
      isVirtualTour: row.isVirtualTour,
    }),
  )
  if (video) tabs.push({ id: 'video', label: 'Video' })
  if (tour) tabs.push({ id: 'tour', label: '3D' })
  return tabs
}
