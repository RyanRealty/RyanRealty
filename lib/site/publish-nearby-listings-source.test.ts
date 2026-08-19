import { describe, expect, it } from 'vitest'
import { publishNearbyListingsSource } from './publish-nearby-listings-source'

describe('publishNearbyListingsSource', () => {
  it('withholds the timeout sentence when listings loaded', () => {
    expect(
      publishNearbyListingsSource({
        grain: 'school',
        scope: 'whose MLS school field matches this school',
        listingCount: 342,
      }),
    ).toBe(
      'active single-family listings (PropertyType A) whose MLS school field matches this school, from the MLS.',
    )
  })

  it('names the timeout only when the count is zero', () => {
    expect(
      publishNearbyListingsSource({
        grain: 'park',
        scope: 'within about 1.5 miles of the park centroid',
        listingCount: 0,
      }),
    ).toContain('A listings timeout renders this park with a zero count')
  })
})
