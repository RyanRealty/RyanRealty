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
  brokerPhone: '541.555.0100',
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
      expect(c.bodyText).toContain('nailing the price')
      expect(c.bodyText).toContain('There is no such thing as pricing too low.')
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

  it('reaches for the broker phone when the row has one', () => {
    const withPhone = composeCmaFirstContact('expired', FACTS)
    expect(withPhone.bodyText).toContain('Reply to this email or call or text me at 541.555.0100.')
    const without = composeCmaFirstContact('expired', { ...FACTS, brokerPhone: null })
    expect(without.bodyText).toContain('Reply to this email or give me a call.')
  })

  it('introduces another broker as with Ryan Realty', () => {
    const c = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Rebecca Peterson' })
    expect(c.bodyText).toContain('My name is Rebecca Peterson, a broker with Ryan Realty in Bend.')
  })

  it('names the neighborhood page when one is on the subject', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      neighborhoodName: 'Riverwest',
      neighborhoodSlug: 'riverwest',
    })
    expect(c.bodyText).toContain('Our page on Riverwest is at')
    expect(c.bodyText).toMatch(/\/cities\/bend\/riverwest/)
    expect(c.bodyText).not.toContain('Our page on Bend')
  })

  it('falls back to the city page when there is no neighborhood', () => {
    const c = composeCmaFirstContact('expired', { ...FACTS, city: 'Redmond' })
    expect(c.bodyText).toContain('Our page on Redmond is at')
    expect(c.bodyText).toMatch(/\/cities\/redmond/)
    expect(c.bodyText).toContain('local brokers who know Redmond street by street')
  })

  it('does not invent a place link when the city is unknown', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      city: null,
      neighborhoodName: null,
      neighborhoodSlug: null,
    })
    expect(c.bodyText).not.toContain('ryan-realty.com/cities')
    expect(c.bodyText).not.toContain('ryan-realty.com/subdivisions')
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
      { brokerName: 'Matt Ryan', lastListPrice: 460000 },
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
    expect(letter.bodyText).toContain('Our page on Diamond Bar Ranch is at')
    expect(letter.bodyText).toMatch(/\/subdivisions\/diamond-bar-ranch/)
  })
})
