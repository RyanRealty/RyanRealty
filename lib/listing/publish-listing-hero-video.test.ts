import { describe, expect, it } from 'vitest'
import {
  isListingVirtualTour,
  publishListingHeroUnmute,
  publishListingHeroVideo,
} from './publish-listing-hero-video'
import type { VideoEmbed } from '@/lib/data/types/video'

const rockwayTour: VideoEmbed = {
  source: 'mls-other',
  embedType: 'iframe',
  url: 'https://www.zillow.com/view-imx/eef1afae-a710-4791-92a6-49dafe8d75d3?wl=true&setAttribution=mls&initialViewType=pano',
  professional: true,
}

const reel: VideoEmbed = {
  source: 'mls-direct-mp4',
  embedType: 'video-tag',
  url: 'https://cdn.example.com/walkthrough.mp4',
  professional: true,
}

describe('publishListingHeroVideo', () => {
  it('Rockway 3D Video is a tour, not a hero reel', () => {
    expect(isListingVirtualTour({ url: rockwayTour.url, name: '3D Video' })).toBe(true)
    expect(publishListingHeroVideo([rockwayTour])).toBeNull()
    expect(publishListingHeroUnmute(rockwayTour)).toBe(false)
  })

  it('native mp4 is the unmute hero', () => {
    expect(publishListingHeroVideo([rockwayTour, reel])).toEqual(reel)
    expect(publishListingHeroUnmute(reel)).toBe(true)
  })

  it('iframe marketing video can be the hero but cannot unmute', () => {
    const vimeo: VideoEmbed = {
      source: 'mls-vimeo',
      embedType: 'iframe',
      url: 'https://player.vimeo.com/video/123',
      professional: true,
    }
    expect(publishListingHeroVideo([vimeo])).toEqual(vimeo)
    expect(publishListingHeroUnmute(vimeo)).toBe(false)
  })
})
