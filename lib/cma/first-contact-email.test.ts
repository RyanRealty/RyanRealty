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

We're sorry your home wasn't able to sell. We know that can be frustrating.

We took some time and put together a comparative market analysis so we could try to better understand why your home didn't sell. There is no obligation to have this report. We just thought you might find it useful.

We found four sales of homes like yours in Clarendon Place, and they support $346,000 to $372,000. The last listing asked $405,000, about 9% above what those sales support. That gap is usually the whole story, and it says nothing bad about the house.

You can see the full report here. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.

If you are ever considering a sale in the future, we would love the opportunity to sit down with you and possibly earn your business.

If you have any questions on it, please let us know.`

function linksOf(paragraphs: FirstContactRun[][]): Array<{ text: string; href: string }> {
  return paragraphs.flat().flatMap((r) => (typeof r === 'string' ? [] : [{ text: r.text, href: r.href }]))
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
    expect(copy.previewText).toBe("Four sales on 62017 Nate's support $346,000 to $372,000.")
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
