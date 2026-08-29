import { describe, expect, it } from 'vitest'
import { publishListingLeadMedia } from './publish-listing-lead-media'
import type { VideoEmbed } from '@/lib/data/types/video'

const rockwayTour: VideoEmbed = {
  source: 'mls-other',
  embedType: 'iframe',
  url: 'https://www.zillow.com/view-imx/eef1afae-a710-4791-92a6-49dafe8d75d3?wl=true&setAttribution=mls&initialViewType=pano',
  professional: true,
  isVirtualTour: true,
}

const reel: VideoEmbed = {
  source: 'mls-direct-mp4',
  embedType: 'video-tag',
  url: 'https://cdn.example.com/walkthrough.mp4',
  professional: true,
}

describe('publishListingLeadMedia', () => {
  it('a native reel is media 1 when both a reel and a tour exist', () => {
    expect(publishListingLeadMedia([rockwayTour, reel])).toEqual({ kind: 'video', video: reel })
  })

  it('a 3D tour is media 1 when no reel exists', () => {
    expect(publishListingLeadMedia([rockwayTour])).toEqual({ kind: 'tour', video: rockwayTour })
  })

  it('returns null so the caller uses the first still of this house', () => {
    expect(publishListingLeadMedia([])).toBeNull()
  })
})
