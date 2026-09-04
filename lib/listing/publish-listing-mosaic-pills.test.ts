import { describe, expect, it } from 'vitest'
import type { VideoEmbed } from '@/lib/data/types/video'
import {
  publishListingGalleryMobilePills,
  publishListingGalleryTabs,
  publishListingMosaicPills,
} from './publish-listing-mosaic-pills'

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
  it('omits the photo caption when this listing has no stills', () => {
    expect(publishListingMosaicPills({ photoCount: 0, videos: [] })).toEqual([])
  })

  it('photo count is the only mosaic caption; 3D floor and street are tiles', () => {
    const pills = publishListingMosaicPills({
      photoCount: 35,
      videos: [reel, tour],
      floorPlanCount: 1,
      hasStreetView: true,
    })
    expect(pills).toEqual([{ id: 'photos', label: '35 photos', action: 'gallery' }])
    expect(pills.map((p) => p.id)).not.toContain('tour')
    expect(pills.map((p) => p.id)).not.toContain('floor')
    expect(pills.map((p) => p.id)).not.toContain('street')
    expect(pills.map((p) => p.id)).not.toContain('video')
  })
})

describe('publishListingGalleryTabs', () => {
  it('does not invent Floor plan, Street view, or Redesign', () => {
    const tabs = publishListingGalleryTabs({ photoCount: 4, videos: [reel] })
    expect(tabs.map((t) => t.id)).toEqual(['photos', 'video'])
    expect(tabs.some((t) => /floor|street|redesign/i.test(t.label))).toBe(false)
  })

  it('adds Floor plan when this listing has a plan still', () => {
    const tabs = publishListingGalleryTabs({
      photoCount: 37,
      videos: [reel, tour],
      floorPlanCount: 1,
    })
    expect(tabs.map((t) => t.id)).toEqual(['photos', 'floor', 'tour', 'video'])
  })

  it('locks Photos / Floor plan / 3D / Video / Street view / Redesign order', () => {
    const tabs = publishListingGalleryTabs({
      photoCount: 8,
      videos: [reel, tour],
      floorPlanCount: 1,
      hasStreetView: true,
      hasRedesign: true,
    })
    expect(tabs.map((t) => t.label)).toEqual([
      'Photos',
      'Floor plan',
      '3D',
      'Video',
      'Street view',
      'Redesign',
    ])
  })
})

describe('publishListingGalleryMobilePills', () => {
  it('names All / Video Tour / Floor plans / 3D only when they exist', () => {
    expect(
      publishListingGalleryMobilePills({ photoCount: 6, videos: [] }).map((p) => p.id),
    ).toEqual(['all'])
    expect(
      publishListingGalleryMobilePills({
        photoCount: 37,
        videos: [reel, tour],
        floorPlanCount: 1,
      }).map((p) => p.label),
    ).toEqual(['All', 'Video Tour', 'Floor plans', '3D'])
  })
})
