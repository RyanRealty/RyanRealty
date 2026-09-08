/**
 * Chapter 2: the listings near you that did not sell.
 * docs/plans/CMA_REIMAGINED_2026-09-07.md, Delta 1.
 *
 * These assertions were the unsold-peer ROW tests until 2026-09-07. The rows
 * became stories — a card each, with the price path drawn — so the same facts
 * are asserted against the new shape: subject first, the subject's own listing
 * never repeated as a peer, one card per address however many cycles it ran,
 * every other address a tracked link, and nothing invented when there is
 * nothing to tell.
 */
import { describe, expect, it } from 'vitest'
import {
  askAgainstSoldSentence,
  didNotSellBodyHtml,
  didNotSellLeadSentence,
  didNotSellStories,
  readLocalFailedThenSold,
  soldPpsfRange,
} from '@/lib/cma/did-not-sell'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '648 Douglas',
  city: 'La Pine',
  subdivision: 'Wild River',
  listingKey: 'SUBJ-1',
  standardStatus: 'Withdrawn',
  lastListPrice: 575000,
  lastListDate: '2026-01-05',
  sqft: 1600,
  beds: 3,
  baths: 2,
  yearBuilt: 2004,
  photoUrl: null,
  listingHistoryLine: 'Listed Jan 5, 2026 at $575,000, came off withdrawn · 120 days on market.',
} as unknown as CmaSubject

const peer = {
  listingKey: 'W-1',
  address: '88 Wren',
  listPrice: 519000,
  originalListPrice: 545000,
  status: 'Expired',
  daysOnMarket: 97,
  onMarketDate: '2026-01-10',
  photoUrl: null,
  listingHistoryLine: 'Listed Jan 10, 2026 at $545,000, cut to $519,000, came off expired · 97 days on market',
  beds: 3,
  baths: 2,
  sqft: 1500,
  yearBuilt: 2006,
  lotAcres: 0.3,
  propertySubType: 'Single Family Residence',
  latitude: 43.705,
  longitude: -121.501,
} as CmaExpiredPeer

const comps = [
  { address: 'a', closePrice: 457000, sqft: 1665 },
  { address: 'b', closePrice: 410000, sqft: 1280 },
  { address: 'c', closePrice: 460000, sqft: 1502 },
] as unknown as CmaAdjustedComp[]

const market = (extra: Record<string, unknown>): CmaMarketContext =>
  ({ geoLabel: 'Redmond', ...extra }) as unknown as CmaMarketContext

const askOutcome = {
  city: 'Redmond',
  windowMonths: 12,
  groups: [
    { key: 'sold-no-cut', n: 375, medianDays: 8 },
    { key: 'sold-after-cut', n: 303, medianDays: 67, medianCutPct: 3.9 },
    { key: 'did-not-sell', n: 232, medianDays: 117.5 },
  ],
}

const body = (extra: Partial<Parameters<typeof didNotSellBodyHtml>[0]> = {}) =>
  didNotSellBodyHtml({
    subject,
    comps,
    market: market({ askOutcome }),
    peers: [peer],
    finalCycle: null,
    docLinks: { brokerSlug: 'matthew-ryan', personId: 538, cmaSlug: 'cma-x' },
    ...extra,
  })

describe('the chapter sentence', () => {
  it('prefers the city\'s own failed-then-sold pairs', () => {
    const s = didNotSellLeadSentence({
      market: market({
        askOutcome,
        localFailedThenSold: {
          city: 'Redmond',
          windowMonths: 24,
          n: 153,
          medianShareOfFailedAsk: 95.7,
        },
      }),
      city: 'Redmond',
    })
    expect(s).toContain('232 single-family homes in Redmond came off the market without selling in the last 12 months.')
    expect(s).toContain('153 Redmond listings that failed came back and sold, at a median 95.7 percent')
    expect(s).not.toContain('Central Oregon')
  })

  it('names the regional figure AS regional when the local pairs are too few', () => {
    const s = didNotSellLeadSentence({
      market: market({
        askOutcome,
        localFailedThenSold: { city: 'Sisters', windowMonths: 24, n: 4, medianShareOfFailedAsk: 93 },
      }),
      city: 'Sisters',
    })
    expect(s).toContain('Across Central Oregon')
    expect(s).toContain('94.2 percent')
  })

  it('refuses a malformed or thin local block', () => {
    expect(readLocalFailedThenSold(market({}))).toBeNull()
    expect(
      readLocalFailedThenSold(
        market({ localFailedThenSold: { city: 'Redmond', n: 9, medianShareOfFailedAsk: 95 } }),
      ),
    ).toBeNull()
    expect(
      readLocalFailedThenSold(
        market({ localFailedThenSold: { city: '', n: 99, medianShareOfFailedAsk: 95 } }),
      ),
    ).toBeNull()
  })
})

describe('what homes like it closed at', () => {
  it('takes the sale prices already printed, over their own living area', () => {
    expect(soldPpsfRange(comps)).toEqual({ low: 274, high: 320, n: 3 })
  })

  it('needs two sales before it states a range', () => {
    expect(soldPpsfRange(comps.slice(0, 1))).toBeNull()
  })

  it('places an ask above, inside, or below what they closed at', () => {
    const range = { low: 274, high: 320 }
    expect(askAgainstSoldSentence({ ask: 360000, sqft: 789, range })).toBe(
      'Asked $360,000 for 789 sqft, $456 a foot. Homes like it closed at $274 to $320 a foot. That is above every one of them.',
    )
    // Inside is not one answer: $294 a foot sits in the middle of $274 to $320,
    // $319 at the top of it, $278 at the bottom.
    expect(askAgainstSoldSentence({ ask: 470000, sqft: 1600, range })).toContain(
      'in the middle of what they closed at',
    )
    expect(askAgainstSoldSentence({ ask: 460000, sqft: 1440, range })).toContain(
      'at the top of what they closed at',
    )
    expect(askAgainstSoldSentence({ ask: 400000, sqft: 1440, range })).toContain(
      'at the bottom of what they closed at',
    )
    expect(askAgainstSoldSentence({ ask: 200000, sqft: 1600, range })).toContain('below every one of them')
  })

  it('says nothing without a size or a range', () => {
    expect(askAgainstSoldSentence({ ask: 360000, sqft: null, range: { low: 1, high: 2 } })).toBe('')
    expect(askAgainstSoldSentence({ ask: 360000, sqft: 789, range: null })).toBe('')
  })
})

/** The card titles only. The drawn line names its listing in its aria-label
 *  too, once per layout, which is a screen reader reading the chart — not the
 *  chapter printing the address three times. */
function cardTitles(html: string): string[] {
  return [...html.matchAll(/class="dns-addr"[^>]*>([\s\S]*?)<\/(?:a|span)>/g)].map((m) => m[1]!.trim())
}

describe('the stories', () => {
  it('leads with the seller\'s own listing, then the ones near them', () => {
    const stories = didNotSellStories({
      subject,
      comps,
      market: market({ askOutcome }),
      peers: [peer],
      finalCycle: null,
    })
    expect(stories.map((s) => s.title)).toEqual(['Your home · 648 Douglas', '88 Wren'])
    expect(stories[0]!.isSubject).toBe(true)
  })

  it('never repeats the subject as a peer (U1)', () => {
    const subjectAsPeer = { ...peer, listingKey: 'SUBJ-1', address: '648 Douglas', listPrice: 575000 }
    const titles = cardTitles(body({ peers: [subjectAsPeer, peer] }))
    expect(titles).toEqual(['Your home · 648 Douglas', '88 Wren'])
  })

  it('collapses same-address cycles into one story (U2)', () => {
    const jan = {
      ...peer,
      listingKey: 'W-JAN',
      address: '15935 Woodchip',
      listPrice: 475000,
      onMarketDate: '2026-01-10',
      daysOnMarket: 80,
    }
    const jun = { ...jan, listingKey: 'W-JUN', listPrice: 450000, onMarketDate: '2026-06-01', daysOnMarket: 40 }
    expect(cardTitles(body({ peers: [jan, jun] }))).toEqual([
      'Your home · 648 Douglas',
      '15935 Woodchip',
    ])
  })

  it('draws each price path and never prints a matrix', () => {
    const html = body()
    expect(html).toContain('dns-card')
    expect(html).toContain('class="price-path"')
    expect(html).not.toContain('comp-matrix')
    expect(html).not.toContain('comp-stack-card')
    // The peer opened at $545,000 and finished at $519,000 with no dated
    // change on the row, so the drop is dashed rather than placed on a day.
    expect(html).toContain('stroke-dasharray')
    expect(html).toContain('came off $519K · 97 days')
  })

  it('carries every other address as a tracked link (U3)', () => {
    const html = body()
    expect(html).toMatch(
      /<a class="dns-addr" href="https:\/\/ryan-realty\.com\/[^"]*_pid=538[^"]*"[^>]*>88 Wren<\/a>/,
    )
    // The reader's own home is the story, not a link out of the document.
    expect(html).toContain('<span class="dns-addr">Your home · 648 Douglas</span>')
  })

  it('states each final ask against what homes like it closed at', () => {
    expect(body()).toContain('Homes like it closed at $274 to $320 a foot')
  })

  it('never says "overpriced" at the reader', () => {
    expect(body().toLowerCase()).not.toContain('overprice')
  })

  it('omits itself when nothing failed — invent nothing', () => {
    const sold = { ...subject, standardStatus: 'Closed' } as unknown as CmaSubject
    expect(body({ subject: sold, peers: null })).toBe('')
    expect(body({ subject: sold, peers: [] })).toBe('')
    expect(body({ subject: sold, peers: [{ ...peer, address: '', listPrice: 0 }] })).toBe('')
  })
})
