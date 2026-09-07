import { describe, expect, it } from 'vitest'
import { listingPhotoAlt } from './listing-photo-alt'

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
