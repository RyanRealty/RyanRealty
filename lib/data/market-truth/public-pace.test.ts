import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_PUBLIC_PACE,
  formatPaceDelta,
  formatPaceShare,
  publicPaceHasRow,
  publicPaceItems,
} from '@/lib/data/market-truth/public-pace'

const SRC = readFileSync(resolve('lib/data/market-truth/public-pace.ts'), 'utf8')

describe('getPublicDetachedPace', () => {
  it('reads leftover market_metric cells, never pulse, never MOS', () => {
    expect(SRC).toMatch(/getMetric/)
    expect(SRC).toMatch(/getMetrics/)
    expect(SRC).not.toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/isPublishable/)
    expect(SRC).toMatch(/median_days_to_contract/)
    expect(SRC).toMatch(/new_listings/)
    expect(SRC).toMatch(/pct_with_price_cut/)
    expect(SRC).toMatch(/yoy_median_price/)
    expect(SRC).toMatch(/median_sale_to_original_list/)
    expect(SRC).toMatch(/pending_count/)
    expect(SRC).toMatch(/closed_count_30d/)
    expect(SRC).toMatch(/median_days_to_contract_90d/)
    expect(SRC).toMatch(/segment: 'detached'/)
    expect(SRC).toMatch(/'neighborhood'/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/months_of_supply/)
    expect(SRC).not.toMatch(/commercial_lease/)
  })

  it('omits a miss instead of printing 0', () => {
    expect(SRC).toMatch(/closedCount == null \|\| closedCount <= 0/)
    expect(SRC).toMatch(/newListings == null \|\| newListings <= 0/)
    expect(publicPaceHasRow(EMPTY_PUBLIC_PACE)).toBe(false)
    expect(publicPaceHasRow({ ...EMPTY_PUBLIC_PACE, daysToContract: 28 })).toBe(true)
    expect(formatPaceShare(0.465871121718377)).toBe('46.6%')
    expect(formatPaceDelta(-0.0193548387096775)).toBe('-1.9%')
    expect(formatPaceDelta(0.0184735051045211)).toBe('+1.8%')
    const items = publicPaceItems({
      ...EMPTY_PUBLIC_PACE,
      pendingCount: 311,
      saleToOriginal: 0.969230769230769,
      medianPriceCut: 0.0591357428610843,
    })
    expect(items.some((item) => item.label.includes('pending · now'))).toBe(true)
    expect(items.some((item) => item.label.includes('sale to original list'))).toBe(true)
    expect(items.some((item) => item.value === '5.9%')).toBe(true)
  })
})

describe('public pace surfaces', () => {
  it('city and housing-market pages read getPublicDetachedPace', () => {
    const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const market = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    const zip = readFileSync(resolve('app/zip/[zip]/page.tsx'), 'utf8')
    const sell = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    expect(city).toMatch(/getPublicDetachedPace/)
    // v3 city page (2026-08-26): the pace items print as Instrument figures
    // through publicPaceItems, the same builder PublicPaceStats renders from.
    expect(city).toMatch(/publicPaceItems/)
    expect(market).toMatch(/getPublicDetachedPace/)
    expect(hub).toMatch(/getPublicDetachedPace/)
    expect(zip).toMatch(/getPublicDetachedPace/)
    expect(sell).toMatch(/getPublicDetachedPace/)
    const listing = readFileSync(
      resolve('components/site/listing-detail/NeighborhoodMarketContext.tsx'),
      'utf8',
    )
    const annual = readFileSync(resolve('app/housing-market/annual-review/page.tsx'), 'utf8')
    const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
    const reports = readFileSync(resolve('app/housing-market/reports/page.tsx'), 'utf8')
    const lp = readFileSync(resolve('app/lp/seller-home-value/page.tsx'), 'utf8')
    expect(listing).toMatch(/getPublicDetachedPace/)
    expect(annual).toMatch(/getPublicDetachedPace/)
    expect(region).toMatch(/getPublicDetachedPace/)
    expect(reports).toMatch(/getPublicDetachedPace/)
    expect(lp).toMatch(/getPublicDetachedPace/)
    const expired = readFileSync(resolve('app/lp/expired-listing/page.tsx'), 'utf8')
    const buyer = readFileSync(resolve('app/lp/buyer-listing-alerts/page.tsx'), 'utf8')
    expect(expired).toMatch(/getPublicDetachedPace/)
    expect(buyer).toMatch(/getPublicDetachedPace/)
    const mos = readFileSync(resolve('app/months-of-supply/page.tsx'), 'utf8')
    const jsonFeed = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    expect(mos).toMatch(/getPublicDetachedPace/)
    expect(jsonFeed).toMatch(/getPublicDetachedPace/)
    const searchLayer = readFileSync(resolve('lib/market/search-city-sfr-publish.ts'), 'utf8')
    const searchTail = readFileSync(resolve('app/search/[...slug]/sections/SeoTail.tsx'), 'utf8')
    expect(searchLayer).toMatch(/getPublicDetachedPace/)
    expect(searchLayer).toMatch(/isPlainCityPage/)
    const citiesIndex = readFileSync(resolve('app/cities/page.tsx'), 'utf8')
    expect(citiesIndex).toMatch(/getPublicDetachedPace/)
    expect(citiesIndex).toMatch(/Pending · now/)
    const home = readFileSync(resolve('app/page.tsx'), 'utf8')
    expect(home).toMatch(/getPublicDetachedPace/)
    // v3 homepage (2026-08-27): the pace items print as Instrument figures
    // through publicPaceItems, the builder the deleted PublicPaceStats strip
    // rendered from.
    expect(home).toMatch(/publicPaceItems/)
    expect(searchTail).toMatch(/publicPaceItems/)
    const community = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    const neighborhood = readFileSync(
      resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'),
      'utf8',
    )
    expect(community).toMatch(/getPublicDetachedPace/)
    // v3 community page (2026-08-26): the pace items print as Instrument
    // figures through publicPaceItems.
    expect(community).toMatch(/publicPaceItems/)
    expect(neighborhood).toMatch(/getPublicDetachedPace/)
    // v3 neighborhood page (2026-08-26): the pace items print as Instrument
    // figures through publicPaceItems, the builder PublicPaceStats renders from.
    expect(neighborhood).toMatch(/publicPaceItems/)
    expect(city).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
  })
})
