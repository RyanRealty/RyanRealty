import { describe, expect, it } from 'vitest'
import { listingGalleryFrameAlt, listingPhotoAlt, publishListingPhotoCaption } from './listing-photo-alt'

describe('listingPhotoAlt', () => {
  it('joins address and city when both are present', () => {
    expect(
      listingPhotoAlt({
        addressLine: '2732 NW Ordway Ave',
        cityLine: 'Bend, OR 97703 · Awbrey Butte',
      }),
    ).toBe('2732 NW Ordway Ave, Bend, OR 97703 · Awbrey Butte')
  })

  it('falls back to the address alone when cityLine is an empty string', () => {
    expect(listingPhotoAlt({ addressLine: '2732 NW Ordway Ave', cityLine: '' })).toBe(
      '2732 NW Ordway Ave',
    )
  })

  it('falls back to the address alone when cityLine is omitted', () => {
    expect(listingPhotoAlt({ addressLine: '2732 NW Ordway Ave' })).toBe('2732 NW Ordway Ave')
  })

  it('trims whitespace from both inputs before joining', () => {
    expect(
      listingPhotoAlt({ addressLine: '  2732 NW Ordway Ave  ', cityLine: '  Bend, OR  ' }),
    ).toBe('2732 NW Ordway Ave, Bend, OR')
  })

  it('treats a whitespace-only cityLine as empty', () => {
    expect(listingPhotoAlt({ addressLine: '2732 NW Ordway Ave', cityLine: '   ' })).toBe(
      '2732 NW Ordway Ave',
    )
  })
})

describe('listingGalleryFrameAlt', () => {
  it('joins address and ordinal so every gallery frame names the house', () => {
    expect(
      listingGalleryFrameAlt({
        addressLine: '2750 NE Great Horned Place',
        ordinal: 3,
        total: 54,
      }),
    ).toBe('2750 NE Great Horned Place, photo 3 of 54')
  })

  it('keeps city when the row has one', () => {
    expect(
      listingGalleryFrameAlt({
        addressLine: '2750 NE Great Horned Place',
        cityLine: 'Bend, OR',
        ordinal: 1,
        total: 54,
      }),
    ).toBe('2750 NE Great Horned Place, Bend, OR, photo 1 of 54')
  })

  it('falls back to a listing slot when the address is missing', () => {
    expect(listingGalleryFrameAlt({ addressLine: '  ', ordinal: 2, total: 10 })).toBe(
      'Listing photo 2 of 10',
    )
  })

  it('never returns an empty string even with junk ordinals', () => {
    expect(listingGalleryFrameAlt({ addressLine: '', ordinal: 0, total: 0 }).length).toBeGreaterThan(
      0,
    )
  })
})

describe('listingGalleryFrameAlt with the MLS caption (2026-10-14)', () => {
  const base = { addressLine: '2750 NE Great Horned Place', cityLine: 'Bend, OR', ordinal: 3, total: 54 }

  it('leads with the caption as written, then names the home', () => {
    expect(listingGalleryFrameAlt({ ...base, caption: 'Kitchen with quartz island' })).toBe(
      'Kitchen with quartz island. 2750 NE Great Horned Place, Bend, OR, photo 3 of 54',
    )
  })

  it('keeps the caption punctuation and only collapses whitespace', () => {
    expect(listingGalleryFrameAlt({ ...base, caption: '  Views of  Mt. Bachelor! ' })).toBe(
      'Views of Mt. Bachelor! 2750 NE Great Horned Place, Bend, OR, photo 3 of 54',
    )
  })

  it('falls back to address, city, photo n of N for a blank or empty caption', () => {
    const fallback = '2750 NE Great Horned Place, Bend, OR, photo 3 of 54'
    expect(listingGalleryFrameAlt({ ...base, caption: '' })).toBe(fallback)
    expect(listingGalleryFrameAlt({ ...base, caption: '   ' })).toBe(fallback)
    expect(listingGalleryFrameAlt({ ...base, caption: null })).toBe(fallback)
    expect(listingGalleryFrameAlt(base)).toBe(fallback)
  })
})

describe('publishListingPhotoCaption', () => {
  it('withholds a caption carrying another brokerage contact or a link', () => {
    expect(publishListingPhotoCaption('Call broker@example.com for a showing')).toBeNull()
    expect(publishListingPhotoCaption('Call 541-555-0123 for details')).toBeNull()
    expect(publishListingPhotoCaption('Tour at www.example.com')).toBeNull()
  })

  it('withholds file names and number-only captions', () => {
    expect(publishListingPhotoCaption('IMG_4021.jpg')).toBeNull()
    expect(publishListingPhotoCaption('DSC0193')).toBeNull()
    expect(publishListingPhotoCaption('12')).toBeNull()
  })

  it('withholds a caption long enough to be remarks', () => {
    expect(publishListingPhotoCaption('a'.repeat(201))).toBeNull()
  })

  it('prints an ordinary caption unchanged', () => {
    expect(publishListingPhotoCaption('Primary suite with gas fireplace')).toBe('Primary suite with gas fireplace')
  })
})
