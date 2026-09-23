import { describe, expect, it } from 'vitest'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'
import {
  NEARBY_MEDIAN_MIN_N,
  publishNearbyMedianListPrice,
  summarizeNearbyHomes,
} from './nearby-on-market-homes'

function row(key: string, price: number | null) {
  return {
    listing_key: key,
    list_price: price,
    beds: 3,
    baths: '2.5',
    sqft: '1800',
    street_number: '100',
    street_name: 'NW Test',
    street_suffix: 'Ave',
    city: 'Bend',
    postal_code: '97703',
    lat: '44.06',
    lng: '-121.28',
    photo_url: null,
  }
}

describe('publishNearbyMedianListPrice (DATA-8)', () => {
  it('takes its floor from the Market Truth registry median floor', () => {
    expect(NEARBY_MEDIAN_MIN_N).toBe(STAT_BY_ID.get('median_list_active')?.minN)
    expect(NEARBY_MEDIAN_MIN_N).toBe(10)
  })

  it('withholds a median under the floor instead of printing an anecdote', () => {
    // Tumalo State Park box, 2026-09-23: 5 on-market homes.
    expect(publishNearbyMedianListPrice([759_000, 650_000, 900_000, 1_200_000, 500_000])).toBeNull()
  })

  it('is percentile_cont: an even count interpolates the two middle prices', () => {
    const prices = [100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000]
    expect(publishNearbyMedianListPrice(prices)).toBe(550_000)
  })

  it('ignores missing and non-positive prices when counting toward the floor', () => {
    const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => n * 100_000)
    expect(publishNearbyMedianListPrice([...nine, null, 0, -5])).toBeNull()
    expect(publishNearbyMedianListPrice([...nine, 1_000_000])).toBe(550_000)
  })
})

describe('summarizeNearbyHomes (DATA-3)', () => {
  it('counts and medians the FULL set while returning only the display slice', () => {
    // Pilot Butte park box, 2026-09-23: 114 homes. The old DAL capped the read at
    // the 60 most expensive and printed count 60 and the top-60 median.
    const rows = Array.from({ length: 114 }, (_, i) => row(`k${i}`, 1_500_000 - i * 10_000))
    const { homes, stats } = summarizeNearbyHomes(rows, 60)
    expect(homes).toHaveLength(60)
    expect(stats.count).toBe(114)
    // Full-set median of 1,500,000 .. 370,000 step 10,000 = midpoint 935,000.
    expect(stats.medianListPrice).toBe(935_000)
    // The top-60 slice would have said 1,205,000.
    expect(publishNearbyMedianListPrice(homes.map((h) => h.price))).toBe(1_205_000)
  })

  it('maps listing_search_mv rows to the tile shape the amenity pages render', () => {
    const { homes } = summarizeNearbyHomes([row('20260901', 725_000)], 60)
    expect(homes[0]).toMatchObject({
      listingKey: '20260901',
      href: '/listing/20260901',
      price: 725_000,
      baths: 2.5,
      sqft: 1800,
      addressLine: '100 NW Test Ave',
      cityLine: 'Bend, OR 97703',
      lat: 44.06,
      lng: -121.28,
    })
  })
})
