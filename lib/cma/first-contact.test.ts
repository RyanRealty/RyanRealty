import { describe, expect, it } from 'vitest'
import { blamesPriorAgent } from '@/lib/crm/first-touch-copy'
import {
  cmaFirstContactFactsFromRow,
  composeCmaFirstContact,
  composeCmaFirstContactSubject,
  composeFirstContactNumbers,
  salesScopeFromTierCounts,
  streetOnly,
} from '@/lib/cma/first-contact'
import type { CmaOrigin } from '@/lib/cma/origin'

const FACTS = {
  address: '1005 Butler Market, Bend, OR 97701',
  firstName: 'Michelle',
  valueLow: 585_000,
  valueHigh: 625_000,
  recommendedList: 605_000,
  brokerName: 'Matt Ryan',
  city: 'Bend',
  closedSalesCount: 5,
  salesScope: 'near' as const,
}

const ORIGINS: CmaOrigin[] = ['expired', 'fsbo', 'seller-valuation', 'lead-form', 'broker', 'internal', 'unknown']

describe('first-contact copy (Matt 2026-09-09 register)', () => {
  it('opens the way Matt opens: who we are, why we wrote, sorry it did not sell', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    expect(c.bodyText).toContain('My name is Matt Ryan, owner and principal broker of Ryan Realty in Bend.')
    expect(c.bodyText).toContain('We keep tabs on the MLS and noticed your home at 1005 Butler Market came off the market recently without selling.')
    expect(c.bodyText).toContain("We're sorry it didn't sell, and we would like the opportunity to earn your business should you decide to relist.")
    expect(c.bodyText).toContain('Again, we are sorry your home did not sell.')
    expect(c.bodyText).toContain('Best of luck in the future.')
  })

  it('carries the pricing philosophy and the earn-your-business ask on every lane', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.bodyText).toContain('the price is everything')
      expect(c.bodyText).toContain('pricing low is rarely the danger people think it is')
      expect(c.bodyText).toContain('the most knowledgeable brokers in Central Oregon')
      expect(c.bodyText).toContain('earn your business')
      expect(c.bodyText).toContain('talk about how we sell homes')
      expect(c.bodyText).toContain('premium product')
      expect(c.bodyText).toContain('https://ryan-realty.com/reviews')
      expect(c.bodyText).toContain('https://ryan-realty.com/about')
      expect(c.bodyText).toContain('Please let me know if you have any questions.')
    }
  })

  it('does not assume a request was made when none was', () => {
    const expired = composeCmaFirstContact('expired', FACTS)
    expect(expired.bodyText).not.toContain('Thank you for asking')
    const fsbo = composeCmaFirstContact('fsbo', FACTS)
    expect(fsbo.bodyText).toContain('your home at 1005 Butler Market is for sale by owner')
    expect(fsbo.bodyText).toContain('no charge and no strings')
    expect(fsbo.bodyText).not.toContain('sorry')
    expect(fsbo.bodyText).toContain('Best of luck with the sale.')
    const asked = composeCmaFirstContact('seller-valuation', FACTS)
    expect(asked.bodyText).toContain('Thank you for asking what 1005 Butler Market is worth.')
    expect(asked.bodyText).not.toContain('came off the market')
    expect(asked.bodyText).not.toContain('sorry')
    expect(asked.bodyText).toContain('The range is what the sales support, not a promise.')
  })

  it('carries the same verified numbers whatever the origin', () => {
    const bodies = new Set<string>()
    for (const o of ORIGINS) {
      const n = composeCmaFirstContact(o, FACTS).numbers ?? ''
      expect(n).toContain('$585,000')
      expect(n).toContain('$625,000')
      expect(n).toContain('$605,000')
      expect(n).toContain('We found five sales of homes like yours near you')
      bodies.add(n.replace(/^We researched .*?result\. /, ''))
    }
    expect(bodies.size).toBe(1)
  })

  it('sets the last list against the range gently, and only when it sits above', () => {
    const above = composeFirstContactNumbers('expired', { ...FACTS, lastListPrice: 675_000 })
    expect(above).toContain('The last listing asked $675,000, about 8% above what those sales support.')
    expect(above).toContain('That gap is usually the whole story, and it says nothing bad about the house.')
    const little = composeFirstContactNumbers('expired', { ...FACTS, lastListPrice: 640_000 })
    expect(little).toContain('The last listing asked $640,000, a little above what those sales support.')
    expect(little).not.toContain('whole story')
    const inside = composeFirstContactNumbers('expired', { ...FACTS, lastListPrice: 600_000 })
    expect(inside).toContain('The last listing asked $600,000, inside what those sales support.')
    const fsbo = composeFirstContactNumbers('fsbo', { ...FACTS, lastListPrice: 675_000 })
    expect(fsbo).toContain('You are asking $675,000, about 8% above what those sales support.')
    expect(fsbo).toContain('That is worth knowing before an offer comes in.')
    expect(fsbo).not.toContain('nothing bad about the house')
  })

  it('names the subdivision only when every priced sale came from it', () => {
    expect(salesScopeFromTierCounts({ 'subdivision-3mo': 6, 'subdivision-6mo': 2 })).toBe('subdivision')
    expect(salesScopeFromTierCounts({ 'subdivision-6mo': 1, 'nearby-1mi-6mo': 1, 'subdivision-3mo-wide': 1 })).toBe('near')
    expect(salesScopeFromTierCounts({ 'neighborhood-6mo': 10 })).toBe('near')
    expect(salesScopeFromTierCounts({ 'citywide-12mo': 4, 'competing-area-12mo': 3 })).toBe('area')
    expect(salesScopeFromTierCounts({ 'rural-15mi-18mo': 5 })).toBe('area')
    expect(salesScopeFromTierCounts({})).toBeNull()
    expect(salesScopeFromTierCounts(null)).toBeNull()
    const sub = composeFirstContactNumbers('expired', { ...FACTS, subdivision: 'Petrosa', salesScope: 'subdivision', closedSalesCount: 8 })
    expect(sub).toContain('We found eight sales of homes like yours in Petrosa')
    const na = composeFirstContactNumbers('expired', { ...FACTS, subdivision: 'N/A', salesScope: 'subdivision', closedSalesCount: 8 })
    expect(na).toContain('in your area')
    const none = composeFirstContactNumbers('expired', { ...FACTS, closedSalesCount: null, salesScope: null })
    expect(none).toContain('Closed sales in your area support $585,000 to $625,000.')
  })

  it('subjects and previews are plain', () => {
    expect(composeCmaFirstContactSubject('expired', '2240 Oak, Bend, OR 97703')).toBe('A market analysis for 2240 Oak')
    expect(composeCmaFirstContactSubject('fsbo', '2240 Oak')).toBe('A market analysis for 2240 Oak')
    expect(composeCmaFirstContactSubject('seller-valuation', '2240 Oak')).toBe('Your report on 2240 Oak')
    expect(streetOnly('2465 7th, Redmond, OR 97756')).toBe('2465 7th')
    expect(streetOnly('  ')).toBeNull()
  })

  it('keeps close verbatim inside bodyText so the rail can splice the report URL', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.close).toBe('The full report is attached as a PDF.')
      expect(c.bodyText).toContain(c.close)
      expect(c.bodyText.replace(c.close, `${c.close} https://x`)).toContain('https://x')
    }
  })

  it('describes the report only as what it holds', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    expect(c.bodyText).toContain('the listings near you that did not sell and what happened to their prices')
    expect(c.bodyText).toContain('who you would be competing with right now at that price')
    expect(c.bodyText).toContain('Every address in it links back to our site')
  })

  it('has no em dash, semicolon or exclamation on any origin, and never prints CMA', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      const all = `${c.subject} ${c.previewText} ${c.bodyText}`
      expect(all).not.toMatch(/[—–;!]/)
      expect(all).not.toMatch(/\bCMA\b/)
    }
  })

  it('says nothing Matt banned: no form letter, no desk, no "the ask", no blaming the prior agent', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, { ...FACTS, lastListPrice: 700_000 })
      const all = `${c.subject} ${c.bodyText}`.toLowerCase()
      expect(all).not.toContain('form letter')
      expect(all).not.toContain('our desk')
      expect(all).not.toContain('the ask')
      expect(all).not.toContain('overpriced')
      expect(all).not.toContain('your last agent')
      expect(all).not.toContain('i would like a shot')
      expect(blamesPriorAgent(`${c.subject} ${c.bodyText}`)).toBe(false)
    }
  })

  it('prints no contact details of its own: the system signature carries them', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.bodyText).toContain('Please let me know if you have any questions.')
      expect(c.bodyText).not.toMatch(/\d{3}[.\-]\d{3}[.\-]\d{4}|\(\d{3}\)\s?\d{3}/)
      expect(c.bodyText).not.toContain('call or text')
      expect(c.bodyText).not.toContain('give me a call')
      expect(c.bodyText).not.toMatch(/@ryan-realty\.com/)
      // No sign-off either: the signature IS the sign-off.
      expect(c.bodyText.trimEnd().endsWith('Ryan Realty')).toBe(false)
    }
    expect(composeCmaFirstContact('expired', FACTS).bodyText).toContain('Best of luck in the future.')
    expect(composeCmaFirstContact('fsbo', FACTS).bodyText).toContain('Best of luck with the sale.')
  })

  it('introduces another broker as with Ryan Realty', () => {
    const c = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Rebecca Peterson' })
    expect(c.bodyText).toContain('My name is Rebecca Peterson, a broker with Ryan Realty in Bend.')
  })

  const DBR = {
    label: 'Diamond Bar Ranch',
    href: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch?utm_source=crm&utm_medium=doc&utm_campaign=cma-letter',
  }
  const REDMOND = { label: 'Redmond', href: 'https://ryan-realty.com/cities/redmond?utm_source=crm&utm_medium=doc&utm_campaign=cma-letter' }

  it('dives into the subdivision when its page renders, then the wider market', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      city: 'Redmond',
      subdivision: 'Diamond Bar Ranch',
      place: { subdivision: { ...DBR, closed12mo: 6, active: 2, pending: 1, history: null }, wider: REDMOND },
    })
    expect(c.bodyText).toContain(
      'In Diamond Bar Ranch itself, six homes sold in the last twelve months, two are for sale right now, and one is under contract.',
    )
    expect(c.bodyText).toContain(`Our Diamond Bar Ranch page keeps the running picture, what is for sale there and what has sold: ${DBR.href}.`)
    expect(c.bodyText).toContain(`The Redmond page shows the wider market it sits in: ${REDMOND.href}.`)
  })

  it('falls back to the page\'s closed-sales history when the twelve-month figures are withheld', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      place: {
        subdivision: { ...DBR, closed12mo: null, active: null, pending: null, history: { thisYear: 2026, closedThisYear: 12, closedSince: 367, sinceYear: 2005 } },
        wider: REDMOND,
      },
    })
    expect(c.bodyText).toContain('In Diamond Bar Ranch itself, twelve homes have sold so far in 2026, and 367 have closed there since 2005.')
    const one = composeCmaFirstContact('expired', {
      ...FACTS,
      place: {
        subdivision: { ...DBR, closed12mo: null, active: null, pending: null, history: { thisYear: 2026, closedThisYear: 1, closedSince: 1, sinceYear: 2026 } },
        wider: REDMOND,
      },
    })
    expect(one.bodyText).toContain('In Diamond Bar Ranch itself, one home has sold so far in 2026.')
  })

  it('prints the plain page line when the counts are withheld', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      place: { subdivision: { ...DBR, closed12mo: null, active: null, pending: null, history: null }, wider: REDMOND },
    })
    expect(c.bodyText).toContain(`Our Diamond Bar Ranch page is at ${DBR.href}.`)
    expect(c.bodyText).not.toContain('sold in the last twelve months')
    expect(c.bodyText).toContain('The Redmond page shows the wider market it sits in')
  })

  it('never links a subdivision page the resolver did not clear', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      subdivision: 'Nowhere Estates',
      place: { subdivision: null, wider: REDMOND },
    })
    expect(c.bodyText).not.toContain('/subdivisions/')
    expect(c.bodyText).not.toContain('Nowhere Estates')
    expect(c.bodyText).toContain(`Our page on Redmond is at ${REDMOND.href}.`)
  })

  it('names the neighborhood page when the subject sits in one', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      place: {
        subdivision: null,
        wider: { label: 'Riverwest', href: 'https://ryan-realty.com/cities/bend/riverwest?utm_source=crm&utm_medium=doc&utm_campaign=cma-letter' },
      },
    })
    expect(c.bodyText).toContain('Our page on Riverwest is at')
    expect(c.bodyText).toMatch(/\/cities\/bend\/riverwest/)
    expect(c.bodyText).not.toContain('Our page on Bend')
  })

  it('prints no place link at all when nothing was resolved', () => {
    for (const place of [null, undefined, { subdivision: null, wider: null }]) {
      const c = composeCmaFirstContact('expired', { ...FACTS, subdivision: 'Diamond Bar Ranch', place })
      expect(c.bodyText).not.toContain('ryan-realty.com/cities')
      expect(c.bodyText).not.toContain('ryan-realty.com/subdivisions')
      expect(c.bodyText).not.toContain('Our page on')
    }
    const c = composeCmaFirstContact('expired', { ...FACTS, city: null, place: null })
    expect(c.bodyText).toContain('Central Oregon street by street')
  })

  it('reads the letter facts off a cmas row without inventing them', () => {
    const facts = cmaFirstContactFactsFromRow(
      {
        subject_address: '2465 7th, Redmond, OR 97756',
        subject_city: 'Redmond',
        subject_subdivision: 'Diamond Bar Ranch',
        client_name: 'Blair Auld',
        value_low: 412000,
        value_high: 443000,
        recommended_list: 435000,
        comps_count: 5,
        build_summary: { comp_selection: { final_tier_counts: { 'nearby-1mi-6mo': 1, 'subdivision-6mo': 1, 'subdivision-9mo': 1 } } },
        render_args: { market: { geoLabel: 'Redmond', geoSlug: 'redmond' } },
      },
      { brokerName: 'Matt Ryan', lastListPrice: 460000, place: { subdivision: { ...DBR, closed12mo: 6, active: 2, pending: null, history: null }, wider: REDMOND } },
    )
    expect(facts.city).toBe('Redmond')
    expect(facts.subdivision).toBe('Diamond Bar Ranch')
    expect(facts.firstName).toBe('Blair')
    expect(facts.lastListPrice).toBe(460000)
    expect(facts.closedSalesCount).toBe(5)
    expect(facts.salesScope).toBe('near')
    const letter = composeCmaFirstContact('expired', facts)
    expect(letter.bodyText).toContain('your home at 2465 7th came off the market')
    expect(letter.bodyText).toContain('We found five sales of homes like yours near you, and they support $412,000 to $443,000.')
    expect(letter.bodyText).toContain('The last listing asked $460,000, a little above what those sales support.')
    expect(letter.bodyText).toContain('In Diamond Bar Ranch itself, six homes sold in the last twelve months, and two are for sale right now.')
    expect(letter.bodyText).toMatch(/\/subdivisions\/diamond-bar-ranch/)
  })
})
