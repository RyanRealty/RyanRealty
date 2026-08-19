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

  it('does not call a genuine zero a timeout', () => {
    expect(
      publishNearbyListingsSource({
        grain: 'trail',
        scope: 'within about 1.5 miles of the trailhead',
        listingCount: 0,
      }),
    ).not.toContain('timeout')
  })

  it('names the timeout only when the read timed out', () => {
    expect(
      publishNearbyListingsSource({
        grain: 'park',
        scope: 'within about 1.5 miles of the park centroid',
        listingCount: 0,
        timedOut: true,
      }),
    ).toContain('A listings timeout renders this park with a zero count')
  })
})
