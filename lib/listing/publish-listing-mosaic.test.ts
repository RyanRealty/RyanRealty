import { describe, expect, it } from 'vitest'
import {
  preferListingMosaicPhotoUrl,
  publishListingMosaicThumbs,
  publishListingMosaicTiles,
} from './publish-listing-mosaic'

describe('publishListingMosaicThumbs', () => {
  const photos = ['p1', 'p2', 'p3', 'p4', 'p5']

  it('mosaic grid: two stacked stills beside a photo lead', () => {
    expect(publishListingMosaicThumbs(photos, false)).toEqual(['p2', 'p3'])
  })

  it('video lead: first two stills sit in the stacked cells', () => {
    expect(publishListingMosaicThumbs(photos, true)).toEqual(['p1', 'p2'])
  })

  it('does not invent empty cells when the house has one photo', () => {
    expect(publishListingMosaicThumbs(['p1'], false)).toEqual([])
  })
})

describe('publishListingMosaicTiles', () => {
  const photosOnly = {
    photoCount: 35,
    leadIsVideo: false,
    hasTour: false,
    hasFloor: false,
    hasMap: false,
  }

  it('photos only: two stills, no invented 3D or map', () => {
    expect(publishListingMosaicTiles(photosOnly)).toEqual([
      { kind: 'photo', photoIndex: 1 },
      { kind: 'photo', photoIndex: 2 },
    ])
  })

  it('17733 Meadow House: 3D, floor, and map occupy real tiles', () => {
    const tiles = publishListingMosaicTiles({
      photoCount: 35,
      leadIsVideo: false,
      hasTour: true,
      hasFloor: true,
      hasMap: true,
    })
    expect(tiles.map((t) => t.kind)).toEqual(['photo', 'tour', 'floor', 'map'])
    expect(tiles.some((t) => t.kind === 'tour')).toBe(true)
  })

  it('does not mint a 3D tile when leftover has no tour', () => {
    const tiles = publishListingMosaicTiles({
      photoCount: 12,
      leadIsVideo: false,
      hasTour: false,
      hasFloor: true,
      hasMap: true,
    })
    expect(tiles.map((t) => t.kind)).toEqual(['photo', 'photo', 'floor', 'map'])
  })

  it('omits the map tile when the caller has no key or point', () => {
    const tiles = publishListingMosaicTiles({
      photoCount: 8,
      leadIsVideo: true,
      hasTour: true,
      hasFloor: false,
      hasMap: false,
    })
    expect(tiles.map((t) => t.kind)).toEqual(['photo', 'photo', 'tour'])
  })

  it('one extra media keeps two house stills so the extra can span', () => {
    expect(
      publishListingMosaicTiles({
        photoCount: 35,
        leadIsVideo: false,
        hasTour: false,
        hasFloor: false,
        hasMap: true,
      }).map((t) => t.kind),
    ).toEqual(['photo', 'photo', 'map'])
  })

  it('does not invent a photo cell when the house has one still', () => {
    expect(
      publishListingMosaicTiles({
        photoCount: 1,
        leadIsVideo: false,
        hasTour: true,
        hasFloor: false,
        hasMap: true,
      }).map((t) => t.kind),
    ).toEqual(['tour', 'map'])
  })
})

describe('preferListingMosaicPhotoUrl', () => {
  it('bumps a Spark resize path that already names a small derivative', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/640x480/true/abc-o.jpg'
    expect(preferListingMosaicPhotoUrl(src)).toBe(
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg',
    )
  })

  it('bumps an existing width query and leaves URLs without size alone', () => {
    expect(preferListingMosaicPhotoUrl('https://cdn.example.com/p.jpg?w=300')).toBe(
      'https://cdn.example.com/p.jpg?w=1600',
    )
    expect(
      preferListingMosaicPhotoUrl('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg'),
    ).toBe('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg')
  })

  it('does not shrink a 1600-wide Spark plate', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg'
    expect(preferListingMosaicPhotoUrl(src)).toBe(src)
  })
})
