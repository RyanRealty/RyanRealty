import { describe, expect, it } from 'vitest'
import {
  pickFirstVideoFromDetails,
  pickFirstVideoFromListingRow,
  listingRowShowsVideoTile,
} from './pick-video-from-details'

describe('pickFirstVideoFromDetails', () => {
  it('reads VirtualTourURLUnbranded', () => {
    expect(pickFirstVideoFromDetails({ VirtualTourURLUnbranded: 'https://example.com/tour' })).toEqual({
      url: 'https://example.com/tour',
      source: 'virtual_tour',
    })
  })

  it('reads Videos.Uri and URL aliases', () => {
    expect(pickFirstVideoFromDetails({ Videos: [{ URL: 'https://x.com/v.mp4' }] })).toEqual({
      url: 'https://x.com/v.mp4',
      source: 'listing_video',
    })
  })

  it('reads lowercase videos array', () => {
    expect(pickFirstVideoFromDetails({ videos: [{ uri: 'https://x.com/a.mp4' }] })).toEqual({
      url: 'https://x.com/a.mp4',
      source: 'listing_video',
    })
  })

  it('parses JSON string details', () => {
    const json = JSON.stringify({ VirtualTourURL: 'https://tour.example/1' })
    expect(pickFirstVideoFromDetails(json)).toEqual({
      url: 'https://tour.example/1',
      source: 'virtual_tour',
    })
  })

  it('pickFirstVideoFromListingRow uses virtual_tour_url column', () => {
    expect(
      pickFirstVideoFromListingRow({
        details: {},
        virtual_tour_url: 'https://matterport.com/x',
      })
    ).toEqual({ url: 'https://matterport.com/x', source: 'virtual_tour' })
  })

  it('listingRowShowsVideoTile respects has_virtual_tour', () => {
    expect(listingRowShowsVideoTile({ has_virtual_tour: true, details: null })).toBe(true)
    expect(listingRowShowsVideoTile({ has_virtual_tour: false, details: {} })).toBe(false)
  })

  it('listingRowShowsVideoTile true when virtual_tour_url set', () => {
    expect(listingRowShowsVideoTile({ has_virtual_tour: false, details: {}, virtual_tour_url: 'https://x.com' })).toBe(
      true
    )
  })
})

describe('pickFirstVideoFromDetails — mail-scanner rewrites (2026-10-14)', () => {
  const wrapped =
    'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fvimeo.com%2F123456789&data=05%7C02%7Cbroker%40example.com%7Cx&sdata=y&reserved=0'

  it('unwraps a SafeLinks Videos.Uri', () => {
    expect(pickFirstVideoFromDetails({ Videos: [{ Uri: wrapped }] })).toEqual({
      url: 'https://vimeo.com/123456789',
      source: 'listing_video',
    })
  })

  it('unwraps a SafeLinks VirtualTourURLUnbranded and a stored virtual_tour_url', () => {
    expect(pickFirstVideoFromDetails({ VirtualTourURLUnbranded: wrapped })?.url).toBe('https://vimeo.com/123456789')
    expect(pickFirstVideoFromListingRow({ virtual_tour_url: wrapped })?.url).toBe('https://vimeo.com/123456789')
  })

  it('skips an unreadable wrapper and takes the next candidate', () => {
    expect(
      pickFirstVideoFromDetails({
        Videos: [{ Uri: 'https://protect-us.mimecast.com/s/AbCdEf' }, { Uri: 'https://youtu.be/dQw4w9WgXcQ' }],
      }),
    ).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ', source: 'listing_video' })
  })
})
