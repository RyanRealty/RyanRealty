import { describe, expect, it } from 'vitest'
import { listingRowPhotoSrc } from './listing-row-photo'

const ASSET = '20260501165710852242000000-o.jpg'

describe('listingRowPhotoSrc', () => {
  it('rewrites a Spark 1600 plate to 320x240 without changing the asset id', () => {
    expect(listingRowPhotoSrc(`https://cdn.resize.sparkplatform.com/ore/1600x1200/true/${ASSET}`)).toBe(
      `https://cdn.resize.sparkplatform.com/ore/320x240/true/${ASSET}`,
    )
  })
})
