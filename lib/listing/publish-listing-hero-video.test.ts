import { describe, expect, it } from 'vitest'
import {
  isListingVirtualTour,
  isListingWalkthroughVideo,
  publishListingHeroUnmute,
  publishListingHeroVideo,
  publishListingVirtualTour,
  publishTourEmbedFromUrl,
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
    expect(publishListingVirtualTour([rockwayTour, reel])).toEqual(rockwayTour)
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

  it('Trailmere Vimeo walkthrough is video even when MLS stored it as a tour', () => {
    const zillow3d: VideoEmbed = {
      source: 'mls-other',
      embedType: 'iframe',
      url: 'https://www.zillow.com/view-3d-home/865acc3a-e3d4-4402-ab96-f77e09bc5273/?utm_source=captureapp',
      professional: true,
      isVirtualTour: true,
    }
    const walkthrough: VideoEmbed = {
      source: 'mls-vimeo',
      embedType: 'iframe',
      url: 'https://vimeo.com/1208618330?fl=pl&fe=sh',
      professional: true,
      isVirtualTour: true,
    }
    expect(isListingWalkthroughVideo(walkthrough.url)).toBe(true)
    expect(isListingVirtualTour({ url: walkthrough.url, name: 'Walkthrough Video', isVirtualTour: true })).toBe(
      false,
    )
    expect(isListingVirtualTour({ url: zillow3d.url, name: 'Zillow 3D', isVirtualTour: true })).toBe(true)
    expect(publishListingHeroVideo([zillow3d, walkthrough])).toEqual(walkthrough)
    expect(publishListingVirtualTour([zillow3d, walkthrough])).toEqual(zillow3d)
  })
})

describe('publishTourEmbedFromUrl', () => {
  it('opens a Matterport URL in the on-site iframe overlay', () => {
    const embed = publishTourEmbedFromUrl('https://my.matterport.com/show/?m=abc', 'https://img/p.jpg')
    expect(embed?.embedType).toBe('iframe')
    expect(embed?.isVirtualTour).toBe(true)
    expect(embed?.url).toContain('matterport')
  })
})
