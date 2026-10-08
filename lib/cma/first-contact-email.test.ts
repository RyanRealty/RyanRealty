import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact, firstContactReportRuns } from '@/lib/cma/first-contact'
import { paragraphsToPlain, type FirstContactRun } from '@/lib/cma/first-contact-render'
import type { FirstContactPlace } from '@/lib/cma/first-contact-place'

const NATE_PLACE: FirstContactPlace = {
  subdivision: {
    label: 'Clarendon Place',
    href: 'https://ryan-realty.com/subdivisions/clarendon-place',
    closed12mo: 6,
    active: 2,
    unsold12mo: 3,
    pending: null,
    history: null,
  },
  wider: { label: 'Bend', href: 'https://ryan-realty.com/cities/bend' },
}

const NATE_PLAIN = `Hi there,

My name is Matt Ryan, and I own Ryan Realty here in Bend. We're a local brokerage, and careful market analysis is at the core of how we price homes. Your home at 62017 Nate's came off the market recently, so we put together an analysis we thought might be useful.

The market has shifted this year. Price reductions are up, but the bigger change is seller concessions, where the seller pays money back to the buyer at closing for things like closing costs, repairs, or a lower interest rate. The recorded sale price stays the same, so values can look steadier than they are. A home that sells at full price with a 3% concession leaves the seller with 3% less than the record shows.

Our report accounts for that. It shows where your listing sat against the competition, what nearby homes actually sold for after concessions, the homes you'd be competing with today, and where we'd price it.

See the full market analysis

Please let me know if you have any questions about the numbers or how we put this together. If you consider selling in the future, we'd love the opportunity to earn your business, and we're here anytime.

If you've already chosen a broker for your next step, please consider this information only. We hope it goes well for you.`

function linksOf(paragraphs: FirstContactRun[][]): Array<{ text: string; href: string }> {
  return paragraphs.flat().flatMap((r) => (typeof r === 'string' || !('href' in r) ? [] : [{ text: r.text, href: r.href }]))
}

describe('Nate first-contact letter (expired, 62017 Nate\'s)', () => {
  const copy = composeCmaFirstContact('expired', {
    address: "62017 Nate's, Bend, OR 97702",
    firstName: null,
    valueLow: 346000,
    valueHigh: 372000,
    recommendedList: 358000,
    lastListPrice: 405000,
    brokerName: 'Matt Ryan',
    brokerSlug: 'matt',
    city: 'Bend',
    subdivision: 'Clarendon Place',
    closedSalesCount: 4,
    salesScope: 'subdivision',
    cmaSlug: 'cma-62017-nate-s',
    place: NATE_PLACE,
  })

  it('prints the approved plain text, words only', () => {
    expect(copy.bodyText).toBe(NATE_PLAIN)
    expect(copy.bodyText).not.toMatch(/https?:/)
    expect(copy.bodyText).not.toMatch(/[—–]/)
    expect(copy.bodyText).not.toContain('Someone')
  })

  it('keeps the note free of links; the button carries the report', () => {
    expect(linksOf(copy.paragraphs)).toEqual([])
    expect(copy.previewText).toBe('What nearby homes sold for after concessions, and the homes you would be competing with.')
    expect(copy.previewText).not.toMatch(/\$/)
    expect(copy.previewText).not.toContain('$358,000')
    expect(copy.bodyText).not.toContain('$358,000')
    expect(copy.mastheadLine).toBe('MARKET ANALYSIS')
  })

  it('drops the online sentence when that constant is emptied, and does not invent a link', () => {
    const runs = firstContactReportRuns('expired', 'https://ryan-realty.com/cma/cma-62017-nate-s', '', 'read it online')
    expect(paragraphsToPlain([runs])).not.toContain('read it online')
    expect(runs.some((r) => typeof r !== 'string')).toBe(false)
    expect(paragraphsToPlain([runs])).toContain('It walks through each of those sales')
  })
})
