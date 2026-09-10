import { describe, expect, it } from 'vitest'
import { listingRowPhotoSrc } from './listing-row-photo'
import { listingRowPhotoSrc as fromLib } from '@/lib/listing/row-photo'

/**
 * SITE-59. The row asks Spark's resize CDN for the size the row actually
 * draws. §0 governs this file more than looks do: a photograph is a claim
 * about a home, so the ONE thing these tests exist to hold is that the asset
 * id never changes — the bytes that come back are that listing's own picture
 * or nothing at all — and that anything we have not verified passes through
 * untouched rather than being guessed at.
 *
 * Measured 2026-09-09 against the live CDN with a browser UA:
 *   /ore/1600x1200/true/20260501165710852242000000-o.jpg -> 200, 330,871 bytes, 1200x899
 *   /ore/320x240/true/20260501165710852242000000-o.jpg   -> 200,  30,147 bytes,  320x240
 * The same aerial of 835 Cherry Street, Medford, both times.
 */

const ASSET = '20260501165710852242000000-o.jpg'

describe('listingRowPhotoSrc', () => {
  it('asks the same asset for the size the row draws', () => {
    expect(listingRowPhotoSrc(`https://cdn.resize.sparkplatform.com/ore/1600x1200/true/${ASSET}`)).toBe(
      `https://cdn.resize.sparkplatform.com/ore/320x240/true/${ASSET}`,
    )
  })

  it('never changes the asset id — the picture stays this listing’s picture', () => {
    const out = listingRowPhotoSrc(`https://cdn.resize.sparkplatform.com/ore/1600x1200/true/${ASSET}`)
    expect(out.endsWith(ASSET)).toBe(true)
  })

  it('keeps the feed and the crop flag the feed chose', () => {
    expect(listingRowPhotoSrc(`https://cdn.resize.sparkplatform.com/wvmls/800x600/false/${ASSET}`)).toBe(
      `https://cdn.resize.sparkplatform.com/wvmls/320x240/false/${ASSET}`,
    )
  })

  it('leaves another host alone', () => {
    const other = 'https://photos.example-mls.com/1600x1200/abc.jpg'
    expect(listingRowPhotoSrc(other)).toBe(other)
  })

  it('leaves a Spark URL whose path is not the verified grammar alone', () => {
    const odd = 'https://cdn.resize.sparkplatform.com/some/other/shape.jpg'
    expect(listingRowPhotoSrc(odd)).toBe(odd)
  })

  it('leaves a relative or owned path alone', () => {
    expect(listingRowPhotoSrc('/images/brokers/matt-ryan.png')).toBe('/images/brokers/matt-ryan.png')
  })

  it('trims, and returns empty for empty rather than inventing a URL', () => {
    expect(listingRowPhotoSrc('   ')).toBe('')
    expect(listingRowPhotoSrc('')).toBe('')
  })

  it('is the same helper the promoted lib/listing path exports', () => {
    const src = `https://cdn.resize.sparkplatform.com/ore/1600x1200/true/${ASSET}`
    expect(listingRowPhotoSrc(src)).toBe(fromLib(src))
  })
})
