import { describe, expect, it } from 'vitest'
import { getPlaceLinks } from '@/lib/place-links'
import { resortQuietItems } from '../../_v3/resort-doors'
import {
  buildExploreEdges,
  communityDocumentItems,
  reconcileListedVsDetachedFaq,
  reconcilePlaceHoaFaq,
} from './community-figures'

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

// D103 (2026-08-27): the Field's listed-set count and the Dataset/FAQ's
// detached count are two different populations, and nothing reconciled them.
describe('reconcileListedVsDetachedFaq', () => {
  const baseFaqs = [
    { question: 'What is the median home price in Tetherow?', answer: 'The median list price is $2,372,500.' },
    { question: 'How many single-family homes are for sale in Tetherow?', answer: 'There are 18 active single-family listings in Tetherow.' },
  ]

  it('appends the reconciling sentence to the count FAQ answer, from live numbers', () => {
    const out = reconcileListedVsDetachedFaq(baseFaqs, { placeName: 'Tetherow', listedCount: 25, detachedCount: 18 })
    const countAnswer = out.find((f) => f.question.startsWith('How many'))?.answer ?? ''
    expect(countAnswer).toMatch(/25 homes listed for Tetherow/)
    expect(countAnswer).toMatch(/every property type/)
    expect(countAnswer).toMatch(/18 is the single-family subset/)
    // Every other answer is untouched.
    expect(out[0]).toEqual(baseFaqs[0])
  })

  it('is a no-op when the counts already agree or either is absent', () => {
    expect(reconcileListedVsDetachedFaq(baseFaqs, { placeName: 'Tetherow', listedCount: 18, detachedCount: 18 })).toEqual(baseFaqs)
    expect(reconcileListedVsDetachedFaq(baseFaqs, { placeName: 'Tetherow', listedCount: 25, detachedCount: null })).toEqual(baseFaqs)
    expect(reconcileListedVsDetachedFaq(baseFaqs, { placeName: 'Tetherow', listedCount: 0, detachedCount: 18 })).toEqual(baseFaqs)
  })
})

// D103 (2026-08-27): the FAQ's HOA answer must not print an unexplained
// number beside the character block's own measurement.
describe('reconcilePlaceHoaFaq', () => {
  const baseFaqs = [{ question: 'Does Tetherow have an HOA?', answer: 'Yes. Estimated annual HOA fees in Tetherow start around $1,464.' }]

  it('replaces the HOA answer with the measured figure and its basis', () => {
    const out = reconcilePlaceHoaFaq(baseFaqs, {
      annual: 2052,
      kind: 'measured',
      basis: 'median of the 6 current listings that report dues',
    })
    expect(out[0]?.answer).toMatch(/\$2,052/)
    expect(out[0]?.answer).toMatch(/median of the 6 current listings that report dues/)
  })

  it('is a no-op for master and estimate kinds, and for no resolved HOA', () => {
    expect(reconcilePlaceHoaFaq(baseFaqs, { annual: 1464, kind: 'master' })).toEqual(baseFaqs)
    expect(reconcilePlaceHoaFaq(baseFaqs, { annual: 1464, kind: 'estimate' })).toEqual(baseFaqs)
    expect(reconcilePlaceHoaFaq(baseFaqs, null)).toEqual(baseFaqs)
  })
})
