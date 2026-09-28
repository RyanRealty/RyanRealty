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

My name is Matt Ryan, owner and principal broker of Ryan Realty in Bend. We keep tabs on the MLS and noticed your home at 62017 Nate's came off the market recently without selling. We're sorry it didn't sell, and we would like the opportunity to earn your business should you decide to relist.

We researched your property and the comparable sales to see what we would do to get a better result. We found four sales of homes like yours in Clarendon Place, and they support $346,000 to $372,000. The last listing asked $405,000, about 9% above what those sales support. That gap is usually the whole story, and it says nothing bad about the house. We would recommend listing at $358,000.

In today's market, the price is everything. Priced too high, a home sits, and every week it sits weakens your position when an offer finally comes. Priced right, it draws real activity and often more than one offer, so pricing low is rarely the danger people think it is. That line is a fine one, and finding it takes brokers who know exactly what is happening around your home. We believe we are the most knowledgeable brokers in Central Oregon when it comes to market performance, and that is what went into this analysis.

The full report is attached as a PDF, and you can also read it online. It walks through each of those sales, the listings near you that did not sell and what happened to their prices, and who you would be competing with right now at that price. Every address in it links back to our site if you want to look closer.

Again, we are sorry your home did not sell. If you are ever considering selling in the future, we would love the opportunity to earn your business. You can see how we sell homes, read our reviews, and see who we are.

In Clarendon Place itself, six homes sold in the last twelve months, two are for sale right now, and three came off the market without selling. Our Clarendon Place page keeps the running picture, what is for sale there, what has sold, and what did not. The Bend page shows the wider market it sits in.

Please let me know if you have any questions. Best of luck in the future.`

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

  it('links the short words to clean hrefs', () => {
    expect(linksOf(copy.paragraphs)).toEqual([
      { text: 'read it online', href: 'https://ryan-realty.com/cma/cma-62017-nate-s' },
      { text: 'see how we sell homes', href: 'https://ryan-realty.com/sell' },
      { text: 'read our reviews', href: 'https://ryan-realty.com/reviews' },
      { text: 'see who we are', href: 'https://ryan-realty.com/about' },
      { text: 'Clarendon Place page', href: 'https://ryan-realty.com/subdivisions/clarendon-place' },
      { text: 'Bend page', href: 'https://ryan-realty.com/cities/bend' },
    ])
  })

  it('drops the online sentence when that constant is emptied, and does not invent a link', () => {
    const runs = firstContactReportRuns('expired', 'https://ryan-realty.com/cma/cma-62017-nate-s', '', 'read it online')
    expect(paragraphsToPlain([runs])).not.toContain('read it online')
    expect(runs.some((r) => typeof r !== 'string')).toBe(false)
    expect(paragraphsToPlain([runs])).toContain('It walks through each of those sales')
  })
})
