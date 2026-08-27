import { describe, expect, it } from 'vitest'
import { getPlaceLinks } from '@/lib/place-links'
import { resortQuietItems } from '../../_v3/resort-doors'
import { buildExploreEdges, communityDocumentItems } from './community-figures'

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
      documentItems: [],
      golfCourses: [],
      resortItems: resortQuietItems(),
    })
    const byLabel = new Map(items.flatMap((item) => ('href' in item ? [[item.label, item.href]] : [])))
    expect(byLabel.get('Search Tetherow homes')).toBe('/homes-for-sale/bend/tetherow')
    expect(byLabel.get('Tetherow market report')).toBe('/housing-market/bend/tetherow')
    expect(byLabel.get('Search Tetherow homes')).not.toBe('/homes-for-sale')
    expect(byLabel.get('Search Tetherow homes')).not.toBe('/search')
  })

  it('recorded documents render as legal doors with per-item provenance', () => {
    // buildClosedFigures left with the pulse-world builders (2026-08-26): the
    // stats-cache closed figures were the alias-join under-count at this grain.
    const items = communityDocumentItems('Vandevert Ranch', [
      {
        id: 'doc-1',
        url: 'https://docs.example/ccr.pdf',
        kind: 'ccr',
        county: 'Deschutes',
        recordingType: 'instrument',
        pageCount: 42,
        fileBytes: 1024,
      } as never,
    ])
    expect(items).toHaveLength(2)
    const link = items[0]
    expect(link && 'href' in link ? link.href : null).toBe('https://docs.example/ccr.pdf')
    expect(link && 'label' in link ? link.label : '').toMatch(/Vandevert Ranch/)
    expect(link && 'label' in link ? link.label : '').toMatch(/Deschutes County/)
    const caveat = items[1]
    expect(caveat && 'body' in caveat ? caveat.body : '').toMatch(/amendments may exist/)
    expect(communityDocumentItems('Vandevert Ranch', [])).toEqual([])
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
      documentItems: [],
      golfCourses: [],
      resortItems: resortQuietItems(),
    })
    const hrefs = items.flatMap((item) => ('href' in item ? [item.href] : []))
    expect(hrefs).toContain('/communities/tetherow')
    expect(hrefs).toContain('/communities/caldera-springs')
    expect(hrefs).toContain('/communities/sunriver')
  })
})
