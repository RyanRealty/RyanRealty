import { describe, expect, it } from 'vitest'
import { publishListingMosaicThumbs } from './publish-listing-mosaic'

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
