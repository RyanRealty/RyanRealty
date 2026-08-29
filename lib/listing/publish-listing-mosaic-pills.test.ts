import { describe, expect, it } from 'vitest'
import type { VideoEmbed } from '@/lib/data/types/video'
import { publishListingGalleryTabs, publishListingMosaicPills } from './publish-listing-mosaic-pills'

const reel: VideoEmbed = {
  source: 'mls-direct-mp4',
  embedType: 'video-tag',
  url: 'https://cdn.example.com/house.mp4',
  professional: true,
}

const tour: VideoEmbed = {
  source: 'mls-matterport',
  embedType: 'iframe',
  url: 'https://my.matterport.com/show/?m=abc',
  professional: true,
  isVirtualTour: true,
}

describe('publishListingMosaicPills', () => {
  it('omits pills this listing does not have', () => {
    expect(publishListingMosaicPills({ photoCount: 12, videos: [] })).toEqual([
      { id: 'photos', label: '12 photos', action: 'gallery' },
    ])
    expect(publishListingMosaicPills({ photoCount: 0, videos: [] })).toEqual([])
  })

  it('adds Video and 3D only when those media exist', () => {
    const pills = publishListingMosaicPills({ photoCount: 8, videos: [reel, tour] })
    expect(pills.map((p) => p.id)).toEqual(['video', 'tour', 'photos'])
  })
})

describe('publishListingGalleryTabs', () => {
  it('does not invent Floor plan, Street view, or Redesign', () => {
    const tabs = publishListingGalleryTabs({ photoCount: 4, videos: [reel] })
    expect(tabs.map((t) => t.id)).toEqual(['photos', 'video'])
    expect(tabs.some((t) => /floor|street|redesign/i.test(t.label))).toBe(false)
  })
})
