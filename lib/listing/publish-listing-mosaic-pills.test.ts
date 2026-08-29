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

  it('1564 Elgin: Floor plan pill only when a plan still exists', () => {
    const withPlan = publishListingMosaicPills({
      photoCount: 37,
      videos: [reel, tour],
      floorPlanCount: 1,
    })
    expect(withPlan.map((p) => p.id)).toEqual(['video', 'tour', 'floor', 'photos'])
    expect(withPlan.find((p) => p.id === 'floor')?.label).toBe('Floor plan')
    expect(withPlan.find((p) => p.id === 'photos')?.label).toBe('37 photos')

    const noPlan = publishListingMosaicPills({ photoCount: 6, videos: [] })
    expect(noPlan.map((p) => p.id)).toEqual(['photos'])
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
