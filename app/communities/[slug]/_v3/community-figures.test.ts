import { describe, expect, it } from 'vitest'
import { getPlaceLinks } from '@/lib/place-links'
import { resortQuietItems } from '../../_v3/resort-doors'
import { buildClosedFigures, buildExploreEdges } from './community-figures'

describe('master-plan place follows', () => {
  it('Homes and Market doors keep the community filter', () => {
    const tetherow = getPlaceLinks({ type: 'community', slug: 'tetherow', citySlug: 'bend' })
    const items = buildExploreEdges({
      communityName: 'Tetherow',
      cityName: 'Bend',
      citySlug: 'bend',
      browseHref: tetherow.browseUrl,
      communityMarketHref: tetherow.marketUrl,
      cityReportHref: '/housing-market/bend',
      pagePath: '/communities/tetherow',
      faqs: [],
      golfCourses: [],
      resortItems: resortQuietItems(),
    })
    const byLabel = new Map(items.flatMap((item) => ('href' in item ? [[item.label, item.href]] : [])))
    expect(byLabel.get('Search Tetherow homes')).toBe('/homes-for-sale/bend/tetherow')
    expect(byLabel.get('Tetherow market report')).toBe('/housing-market/bend/tetherow')
    expect(byLabel.get('Search Tetherow homes')).not.toBe('/homes-for-sale')
    expect(byLabel.get('Search Tetherow homes')).not.toBe('/search')
  })

  it('closed-sale figures open this place market, not a generic search', () => {
    const [figure] = buildClosedFigures({
      medianSalePrice: 1_200_000,
      soldCount: 40,
      medianDaysOnMarket: 21,
      marketHref: '/housing-market/sunriver/caldera-springs',
    })
    expect(figure?.href).toBe('/housing-market/sunriver/caldera-springs')
  })

  it('closing Quiet carries the registry resort list', () => {
    const items = buildExploreEdges({
      communityName: 'Sunriver',
      cityName: 'Sunriver',
      citySlug: 'sunriver',
      browseHref: '/homes-for-sale/sunriver/sunriver',
      communityMarketHref: '/housing-market/sunriver/sunriver',
      cityReportHref: '/housing-market/sunriver',
      pagePath: '/communities/sunriver',
      faqs: [],
      golfCourses: [],
      resortItems: resortQuietItems(),
    })
    const hrefs = items.flatMap((item) => ('href' in item ? [item.href] : []))
    expect(hrefs).toContain('/communities/tetherow')
    expect(hrefs).toContain('/communities/caldera-springs')
    expect(hrefs).toContain('/communities/sunriver')
  })
})
