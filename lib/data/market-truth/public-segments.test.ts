import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collapseCitySegmentRows, type RawSegmentCell } from '@/lib/data/market-truth/city-segment-collapse'
import {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentItems,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'

const SRC = readFileSync(resolve('lib/data/market-truth/public-segments.ts'), 'utf8')

describe('getPublicPlaceSegments', () => {
  it('reads publishable market_metric extra-segment cells', () => {
    expect(SRC).toMatch(/getMetric/)
    expect(SRC).toMatch(/getMetrics/)
    expect(SRC).not.toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/isPublishable/)
    expect(SRC).toMatch(/'condo'/)
    expect(SRC).toMatch(/'townhome'/)
    expect(SRC).toMatch(/manufactured_land/)
    expect(SRC).toMatch(/'land'/)
    expect([...PUBLIC_PLACE_SEGMENTS]).toEqual([
      'condo',
      'townhome',
      'manufactured_land',
      'manufactured_park',
      'multifamily_2_4',
      'land',
      'farm',
      'commercial_sale',
      'business',
    ])
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/'commercial_lease'/)
    expect(SRC).toMatch(/'neighborhood'/)
    expect(SRC).not.toMatch(/'all_residential'/)
    expect(SRC).toMatch(/pending_count/)
    expect(SRC).toMatch(/closed_count/)
    expect(SRC).toMatch(/PUBLIC_SEGMENT_STATS/)
  })

  it('omits a miss instead of printing 0', () => {
    expect(SRC).toMatch(/activeCount == null \|\| row.activeCount <= 0/)
    expect(SRC).toMatch(/propertySubTypes/)
  })

  it('names browse URLs and display bits without fabricating 0', () => {
    expect(publicSegmentBrowseHref('bend', 'condo')).toBe(
      '/homes-for-sale/bend?propertySubTypes=Condominium',
    )
    expect(publicSegmentBrowseHref('la-pine', 'townhome')).toBe(
      '/homes-for-sale/la-pine?propertySubTypes=Townhouse',
    )
    expect(publicSegmentBrowseHref(null, 'condo')).toBe(
      '/homes-for-sale?propertySubTypes=Condominium',
    )
    expect(publicSegmentBrowseHref('bend', 'condo', { postalCode: '97701' })).toBe(
      '/homes-for-sale/bend?postalCode=97701&propertySubTypes=Condominium',
    )
    expect(publicSegmentNoun('condo', 1)).toBe('condo')
    expect(publicSegmentNoun('condo', 66)).toBe('condos')
    expect(publicSegmentNoun('townhome', 78)).toBe('townhomes')
    expect(publicSegmentBrowseHref('bend', 'land')).toBe('/homes-for-sale/bend?propertyType=Land')
    expect(publicSegmentBrowseHref('bend', 'manufactured_land')).toBe(
      '/homes-for-sale/bend?propertySubTypes=Manufactured+On+Land',
    )
    expect(publicSegmentNoun('land', 198)).toBe('lots')
    expect(publicSegmentDisplayBits({
      medianList: 326000,
      monthsOfSupply: 12.8,
      verdict: 'buyer',
      pendingCount: 5,
      closedCount: 32,
    })).toEqual(['$326,000', '12.8 months', "buyer's", '5 pending · now', '32 closed · 12 months'])
    expect(publicSegmentDisplayBits({
      medianList: 589000,
      monthsOfSupply: null,
      verdict: null,
      pendingCount: 5,
      closedCount: 32,
    })).toEqual(['$589,000', '5 pending · now', '32 closed · 12 months'])
    expect(publicSegmentDisplayBits({
      medianList: null,
      monthsOfSupply: null,
      verdict: null,
    })).toEqual([])
    const items = publicSegmentItems(
      [
        {
          segment: 'condo',
          activeCount: 66,
          medianList: 326000,
          monthsOfSupply: 12.8,
          verdict: 'buyer',
          pendingCount: 5,
          closedCount: 32,
          sampleN: 40,
        },
        {
          segment: 'townhome',
          activeCount: 0,
          medianList: null,
          monthsOfSupply: null,
          verdict: null,
          pendingCount: null,
          closedCount: null,
          sampleN: null,
        },
      ],
      'bend',
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.key).toBe('condo')
    expect(items[0]?.value).toBe('66')
    expect(items[0]?.noun).toBe('condos')
    expect(items[0]?.href).toBe('/homes-for-sale/bend?propertySubTypes=Condominium')
    expect(items[0]?.label).toContain('condos for sale')
  })

  it('collapse with public segments does not emit detached or all_residential', () => {
    const cell = (
      partial: Partial<RawSegmentCell> & Pick<RawSegmentCell, 'segment' | 'stat_id' | 'value'>,
    ): RawSegmentCell => ({
      value_text: null,
      sample_n: 40,
      window_months: 0,
      period_end: '2026-08-23',
      computed_at: '2026-08-23T01:00:00Z',
      complete_through: '2026-08-22',
      is_publishable: true,
      ...partial,
    })
    const rows = collapseCitySegmentRows(
      [
        cell({ segment: 'detached', stat_id: 'active_count', value: 774 }),
        cell({ segment: 'condo', stat_id: 'active_count', value: 66 }),
        cell({ segment: 'farm', stat_id: 'active_count', value: 12 }),
      ],
      { segments: PUBLIC_PLACE_SEGMENTS },
    )
    expect(rows.map((row) => row.segment)).toEqual([...PUBLIC_PLACE_SEGMENTS])
    expect(rows.find((row) => row.segment === 'condo')?.activeCount).toBe(66)
    expect(rows.find((row) => row.segment === 'farm')?.activeCount).toBe(12)
    expect(rows.find((row) => row.segment === 'detached')).toBeUndefined()
    expect(rows.find((row) => row.segment === 'all_residential')).toBeUndefined()
  })
})

describe('public place pages', () => {
  it('city and housing-market city pages read getPublicPlaceSegments', () => {
    const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const strip = readFileSync(resolve('app/cities/[slug]/PublicProductTypes.tsx'), 'utf8')
    const market = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const figures = readFileSync(
      resolve('app/housing-market/[...slug]/_v3/geo-figures.ts'),
      'utf8',
    )
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    expect(city).toMatch(/getPublicPlaceSegments/)
    expect(city).toMatch(/PublicProductTypes/)
    expect(strip).toMatch(/publicSegmentBrowseHref/)
    expect(strip).toMatch(/publicSegmentDisplayBits/)
    expect(market).toMatch(/getPublicPlaceSegments/)
    expect(figures).toMatch(/buildPublicSegmentFigures/)
    expect(figures).toMatch(/publicSegmentBrowseHref/)
    const zip = readFileSync(resolve('app/zip/[zip]/page.tsx'), 'utf8')
    expect(hub).toMatch(/getPublicPlaceSegments/)
    expect(hub).toMatch(/publicSegmentDisplayBits/)
    expect(zip).toMatch(/getPublicPlaceSegments/)
    const annual = readFileSync(resolve('app/housing-market/annual-review/page.tsx'), 'utf8')
    const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
    const reports = readFileSync(resolve('app/housing-market/reports/page.tsx'), 'utf8')
    expect(annual).toMatch(/getPublicPlaceSegments/)
    expect(region).toMatch(/getPublicPlaceSegments/)
    expect(reports).toMatch(/getPublicPlaceSegments/)
    const searchLayer = readFileSync(resolve('lib/market/search-city-sfr-publish.ts'), 'utf8')
    const searchTail = readFileSync(resolve('app/search/[...slug]/sections/SeoTail.tsx'), 'utf8')
    expect(searchLayer).toMatch(/getPublicPlaceSegments/)
    expect(searchLayer).toMatch(/isPlainCityPage/)
    expect(searchTail).toMatch(/publicSegmentBrowseHref/)
    const jsonFeed = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    const jsonRoute = readFileSync(resolve('app/data/market/[geoType]/[geoSlug]/route.ts'), 'utf8')
    const sell = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    const listing = readFileSync(
      resolve('components/site/listing-detail/NeighborhoodMarketContext.tsx'),
      'utf8',
    )
    const sellerLp = readFileSync(resolve('app/lp/seller-home-value/page.tsx'), 'utf8')
    const expired = readFileSync(resolve('app/lp/expired-listing/page.tsx'), 'utf8')
    const buyer = readFileSync(resolve('app/lp/buyer-listing-alerts/page.tsx'), 'utf8')
    expect(jsonFeed).toMatch(/getPublicPlaceSegments/)
    expect(jsonRoute).toMatch(/extraSegments/)
    expect(sell).toMatch(/getPublicPlaceSegments/)
    expect(listing).toMatch(/getPublicPlaceSegments/)
    expect(listing).toMatch(/PublicProductTypes/)
    expect(sellerLp).toMatch(/getPublicPlaceSegments/)
    expect(expired).toMatch(/getPublicPlaceSegments/)
    expect(buyer).toMatch(/getPublicPlaceSegments/)
    const citiesIndex = readFileSync(resolve('app/cities/page.tsx'), 'utf8')
    expect(citiesIndex).toMatch(/getPublicPlaceSegments/)
    const home = readFileSync(resolve('app/page.tsx'), 'utf8')
    expect(home).toMatch(/getPublicPlaceSegments/)
    expect(home).toMatch(/PublicProductTypes/)
    const community = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    const neighborhood = readFileSync(
      resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'),
      'utf8',
    )
    expect(community).toMatch(/getPublicPlaceSegments/)
    expect(community).toMatch(/PublicProductTypes/)
    expect(neighborhood).toMatch(/getPublicPlaceSegments/)
    expect(neighborhood).toMatch(/PublicProductTypes/)
    expect(city).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
    expect(strip).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
  })
})
