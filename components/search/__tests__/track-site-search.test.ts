import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ ga4: [] as unknown[][], firstParty: [] as unknown[][], ga4Throws: false }))
vi.mock('@/lib/tracking', () => ({
  trackEvent: (...args: unknown[]) => {
    if (calls.ga4Throws) throw new Error('dataLayer blocked')
    calls.ga4.push(args)
  },
}))
vi.mock('@/components/VisitTracker', () => ({
  fireFirstPartyEvent: (...args: unknown[]) => calls.firstParty.push(args),
}))

import { trackSiteSearch } from '../track-site-search'

beforeEach(() => {
  calls.ga4.length = 0
  calls.firstParty.length = 0
  calls.ga4Throws = false
})

describe('trackSiteSearch', () => {
  it('sends one GA4 search and one first-party search row', () => {
    trackSiteSearch({ surface: 'search_page', source: 'typeahead', query: 'Bend', term: 'be', city: 'Bend' })
    expect(calls.ga4).toEqual([
      ['search', { surface: 'search_page', search_term: 'be', city: 'Bend', subdivision: undefined, postalCode: undefined }],
    ])
    expect(calls.firstParty).toEqual([
      [
        'search',
        {
          metadata: {
            query: 'Bend',
            term: 'be',
            city: 'Bend',
            subdivision: undefined,
            postalCode: undefined,
            surface: 'search_page',
            source: 'typeahead',
          },
        },
      ],
    ])
  })

  it('keeps the query the admin card counts in metadata.query, trimmed, and drops a term equal to it', () => {
    trackSiteSearch({ surface: 'home_hero', source: 'submit', query: '  3 bed in Redmond ', term: '3 bed in Redmond' })
    const [, opts] = calls.firstParty[0] as [string, { metadata: Record<string, unknown> }]
    expect(opts.metadata.query).toBe('3 bed in Redmond')
    expect(opts.metadata.term).toBeUndefined()
    expect(calls.ga4[0][1]).toMatchObject({ surface: 'home_hero', search_term: '3 bed in Redmond' })
  })

  it('still records a blank submit, with no query', () => {
    trackSiteSearch({ surface: 'home_hero', source: 'submit', query: '' })
    expect(calls.ga4).toHaveLength(1)
    expect(calls.ga4[0][1]).toMatchObject({ surface: 'home_hero', search_term: undefined })
    expect(calls.firstParty).toHaveLength(1)
    const [, opts] = calls.firstParty[0] as [string, { metadata: Record<string, unknown> }]
    expect(opts.metadata.query).toBeUndefined()
  })

  it('a GA4 failure does not stop the first-party row', () => {
    calls.ga4Throws = true
    expect(() => trackSiteSearch({ surface: 'chrome', source: 'typeahead', query: 'Sisters' })).not.toThrow()
    expect(calls.firstParty).toHaveLength(1)
  })
})
