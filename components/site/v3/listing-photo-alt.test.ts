import { describe, expect, it } from 'vitest'
import { listingGalleryFrameAlt, listingPhotoAlt } from './listing-photo-alt'

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
