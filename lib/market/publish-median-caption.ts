/**
 * Caption for a published list median.
 *
 * The number's geography is the caption. "Regional median" is only honest
 * when the figure is the region pulse. A community, city, neighborhood,
 * subdivision, or ZIP median under that label is a different set.
 *
 * Founding case: /communities/tetherow printed $1,499,000 as Regional median.
 * That was the Tetherow list median on the same hero (fleet
 * 5f0ec58d60988a52e76b8a559ef22f0c).
 *
 * If the place has no median, a region fallback may print — only with the
 * regional caption. Do not pair a place number with a regional label.
 */

export type MedianGrain =
  | 'region'
  | 'city'
  | 'neighborhood'
  | 'community'
  | 'subdivision'
  | 'zip'

export type PublishedSellMedian = {
  value: number
  caption: string
}

function asPositiveMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function medianCaptionForGrain(grain: MedianGrain, placeName: string): string {
  if (grain === 'region') return 'Regional median'
  const name = placeName.trim()
  if (!name) {
    throw new Error('medianCaptionForGrain: placeName is required for a non-region grain')
  }
  return `${name} median`
}

export function publishSellMedian(input: {
  placeMedian: number | null | undefined
  regionMedian?: number | null
  grain: MedianGrain
  placeName: string
}): PublishedSellMedian | null {
  const place = asPositiveMedian(input.placeMedian)
  if (place != null) {
    return {
      value: place,
      caption: medianCaptionForGrain(input.grain, input.placeName),
    }
  }
  const region = asPositiveMedian(input.regionMedian)
  if (region != null) {
    return { value: region, caption: 'Regional median' }
  }
  return null
}
