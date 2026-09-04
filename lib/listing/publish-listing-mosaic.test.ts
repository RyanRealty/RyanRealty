import { describe, expect, it } from 'vitest'
import {
  preferListingMosaicPhotoUrl,
  publishListingMosaicThumbs,
  publishListingMosaicTiles,
} from './publish-listing-mosaic'

describe('publishListingMosaicThumbs', () => {
  const photos = ['p1', 'p2', 'p3', 'p4', 'p5']

  it('mosaic grid: up to four stills beside a photo lead', () => {
    expect(publishListingMosaicThumbs(photos, false)).toEqual(['p2', 'p3', 'p4', 'p5'])
  })

  it('video lead: first four stills sit in the side cells', () => {
    expect(publishListingMosaicThumbs(photos, true)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('does not invent empty cells when the house has one photo', () => {
    expect(publishListingMosaicThumbs(['p1'], false)).toEqual([])
  })
})

describe('publishListingMosaicTiles', () => {
  it('fills up to four stills and never mints 3D, floor, or map tiles', () => {
    expect(
      publishListingMosaicTiles({ photoCount: 35, leadIsVideo: false }).map((t) => t.kind),
    ).toEqual(['photo', 'photo', 'photo', 'photo'])
    expect(publishListingMosaicTiles({ photoCount: 35, leadIsVideo: false })).toEqual([
      { kind: 'photo', photoIndex: 1 },
      { kind: 'photo', photoIndex: 2 },
      { kind: 'photo', photoIndex: 3 },
      { kind: 'photo', photoIndex: 4 },
    ])
  })

  it('video lead starts the side stills at the first photo', () => {
    expect(publishListingMosaicTiles({ photoCount: 8, leadIsVideo: true })).toEqual([
      { kind: 'photo', photoIndex: 0 },
      { kind: 'photo', photoIndex: 1 },
      { kind: 'photo', photoIndex: 2 },
      { kind: 'photo', photoIndex: 3 },
    ])
  })

  it('does not invent a photo cell when the house has one still', () => {
    expect(publishListingMosaicTiles({ photoCount: 1, leadIsVideo: false })).toEqual([])
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
