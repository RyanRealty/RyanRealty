import { describe, expect, it } from 'vitest'
import { medianCaptionForGrain, publishSellMedian } from './publish-median-caption'

describe('medianCaptionForGrain', () => {
  it('labels a region figure as Regional median', () => {
    expect(medianCaptionForGrain('region', 'Central Oregon')).toBe('Regional median')
  })

  it('names the place for every finer grain', () => {
    expect(medianCaptionForGrain('community', 'Tetherow')).toBe('Tetherow median')
    expect(medianCaptionForGrain('city', 'Bend')).toBe('Bend median')
    expect(medianCaptionForGrain('neighborhood', 'Awbrey Butte')).toBe('Awbrey Butte median')
    expect(medianCaptionForGrain('subdivision', 'Braeburn')).toBe('Braeburn median')
    expect(medianCaptionForGrain('zip', '97703')).toBe('97703 median')
  })

  it('refuses an empty place name on a non-region grain', () => {
    expect(() => medianCaptionForGrain('community', '  ')).toThrow(/placeName/)
  })
})

describe('publishSellMedian', () => {
  it('pairs the Tetherow list median with a Tetherow caption (founding case)', () => {
    expect(
      publishSellMedian({
        placeMedian: 1_499_000,
        regionMedian: 742_000,
        grain: 'community',
        placeName: 'Tetherow',
      }),
    ).toEqual({ value: 1_499_000, caption: 'Tetherow median' })
  })

  it('never labels a place number as Regional median', () => {
    const published = publishSellMedian({
      placeMedian: 1_499_000,
      regionMedian: 742_000,
      grain: 'community',
      placeName: 'Tetherow',
    })
    expect(published?.caption).not.toBe('Regional median')
  })

  it('falls back to the region number only with the regional caption', () => {
    expect(
      publishSellMedian({
        placeMedian: null,
        regionMedian: 742_000,
        grain: 'community',
        placeName: 'Tetherow',
      }),
    ).toEqual({ value: 742_000, caption: 'Regional median' })
  })

  it('returns null when neither median is present', () => {
    expect(
      publishSellMedian({
        placeMedian: null,
        regionMedian: null,
        grain: 'city',
        placeName: 'Bend',
      }),
    ).toBeNull()
  })
})
