import { describe, expect, it } from 'vitest'
import { blamesPriorAgent } from '@/lib/crm/first-touch-copy'
import {
  citySupplySentence,
  cmaFirstContactFactsFromRow,
  composeCmaFirstContact,
  composeCmaFirstContactSubject,
  composeFirstContactNumbers,
  lastAskVersusHeroBand,
  salesScopeFromTierCounts,
  streetOnly,
} from '@/lib/cma/first-contact'
import type { FirstContactRun } from '@/lib/cma/first-contact-render'
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

function linkHrefs(paragraphs: FirstContactRun[][]): string[] {
  return paragraphs.flat().flatMap((r) => (typeof r === 'string' ? [] : [r.href]))
}

describe('first-contact copy (Matt 2026-10-05 email)', () => {
  it('opens on the unsold home, then the work, and keeps the list price out of the note', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    const report = 'The full report is attached. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.'
    expect(c.bodyText.indexOf('Hi there,')).toBe(0)
    expect(c.bodyText.indexOf("We're sorry your home didn't sell this go-around.")).toBeGreaterThan(0)
    expect(c.bodyText.indexOf("We're sorry")).toBeLessThan(c.bodyText.indexOf('We spent time in the MLS'))
    expect(c.bodyText).toContain('We spent time in the MLS on 1005 Butler Market and put this report together for you.')
    expect(c.bodyText.indexOf('We found five sales')).toBeGreaterThan(c.bodyText.indexOf('We spent time in the MLS'))
    expect(c.bodyText.indexOf(report)).toBeGreaterThan(c.bodyText.indexOf('We found five sales'))
    expect(c.bodyText).not.toContain('We would list it at')
    expect(c.bodyText).not.toContain('Our price')
    expect(c.bodyText).not.toContain('See our price')
    expect(c.bodyText).not.toContain('$605,000')
    expect(c.bodyText).toContain('we would love the opportunity to earn your business.')
    expect(c.bodyText.indexOf('we would love the opportunity')).toBeLessThan(c.bodyText.indexOf('We spent time in the MLS'))
    expect(c.bodyText).toContain('Please feel free to call with any questions.')
    expect(c.bodyText).toContain('Best of luck in the future.')
    expect(c.bodyText).not.toContain('My name is')
    expect(c.bodyText).not.toContain('the price is everything')
    expect(c.bodyText).not.toContain('shifting')
    expect(c.bodyText).not.toContain('less favorable for sellers')
    expect(c.previewText).toBe('Five sales on 1005 Butler Market support $585,000 to $625,000.')
    expect(c.previewText).not.toContain('$605,000')
  })

  it('asks to earn the business without the essay, on every lane', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.bodyText).toContain('earn your business')
      expect(c.bodyText).toContain('the price we would list at, the homes you would be competing with')
      expect(c.bodyText).not.toContain('the price is everything')
      expect(c.bodyText).not.toContain('the most knowledgeable brokers in Central Oregon')
      expect(c.bodyText).not.toContain('see how we sell homes')
      expect(c.bodyText).not.toContain('read our reviews')
      expect(c.bodyText).not.toContain('learn about our business')
      expect(c.bodyText).not.toContain('sit down')
      expect(c.bodyText).not.toContain('premium product')
      expect(c.bodyText).not.toMatch(/https?:/)
      if (o === 'expired') {
        expect(c.bodyText).toContain('Please feel free to call with any questions.')
        expect(c.bodyText).not.toContain('Please let me know if you have any questions.')
      } else {
        expect(c.bodyText).toContain('Please let me know if you have any questions.')
      }
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
    expect(fsbo.previewText).toBe('A second look at 1005 Butler Market, no charge and no strings.')
    expect(fsbo.previewText).not.toMatch(/\$/)
    const asked = composeCmaFirstContact('seller-valuation', FACTS)
    expect(asked.bodyText).toContain('Thank you for asking what 1005 Butler Market is worth.')
    expect(asked.bodyText).not.toContain('came off the market')
    expect(asked.bodyText).not.toContain('sorry')
    expect(asked.bodyText).toContain('The range is what the sales support, not a promise.')
    expect(asked.previewText).toBe('Five sales on 1005 Butler Market support $585,000 to $625,000.')
    expect(asked.previewText).not.toContain('$605,000')
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

  it('uses the letter hero band for below, inside, and above', () => {
    // Nugget: $725k last ask, letter band $734k–$878k. Old code compared only
    // to the high and called $725k "inside".
    expect(lastAskVersusHeroBand(725_000, 734_000, 878_000)).toBe('below')
    expect(lastAskVersusHeroBand(800_000, 734_000, 878_000)).toBe('inside')
    expect(lastAskVersusHeroBand(900_000, 734_000, 878_000)).toBe('above')
    const below = composeFirstContactNumbers('expired', {
      ...FACTS,
      valueLow: 734_000,
      valueHigh: 878_000,
      recommendedList: 803_000,
      lastListPrice: 725_000,
    })
    expect(below).toContain('they support $734,000 to $878,000.')
    expect(below).toContain('The last listing asked $725,000, below what those sales support.')
    expect(below).not.toContain('Price was not what held it back.')
    expect(below).not.toContain('inside what those sales support')
    const inside = composeFirstContactNumbers('expired', {
      ...FACTS,
      valueLow: 734_000,
      valueHigh: 878_000,
      recommendedList: 803_000,
      lastListPrice: 800_000,
    })
    expect(inside).toContain('The last listing asked $800,000, inside what those sales support.')
    expect(inside).not.toContain('Price was not what held it back.')
    const above = composeFirstContactNumbers('expired', {
      ...FACTS,
      valueLow: 734_000,
      valueHigh: 878_000,
      recommendedList: 803_000,
      lastListPrice: 950_000,
    })
    expect(above).toContain('The last listing asked $950,000, about 8% above what those sales support.')
    expect(above).not.toContain('inside what those sales support')
    expect(above).not.toContain('below what those sales support')
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

  it('keeps the report sentence in the body and does not print a URL', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.close).toBe(
        'The full report is attached. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.',
      )
      expect(c.bodyText).toContain(c.close)
      expect(c.previewText).not.toContain('$605,000')
      expect(c.previewText).not.toMatch(/our price/i)
      if (o === 'fsbo') expect(c.previewText).not.toMatch(/\$/)
      expect(c.bodyText).not.toMatch(/https?:/)
    }
  })

  it('describes the report only as what it holds', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    expect(c.bodyText).toContain('the homes you would be competing with')
    expect(c.bodyText).toContain('what happened to nearby homes that did not sell')
    expect(c.bodyText).not.toContain('Every address in it links back to our site')
  })

  it('prints the city pulse in the market page\'s own words, and only when it was loaded', () => {
    expect(citySupplySentence('Bend', 2.95)).toBe("Bend has 3.0 months of supply right now. That is a seller's market.")
    expect(citySupplySentence('Bend', 4.05)).toBe('Bend has 4.1 months of supply right now. That is a balanced market.')
    expect(citySupplySentence('Bend', 6)).toBe("Bend has 6.0 months of supply right now. That is a buyer's market.")
    expect(citySupplySentence('Bend', null)).toBeNull()
    expect(citySupplySentence('', 2.95)).toBeNull()
    const withPulse = composeCmaFirstContact('expired', { ...FACTS, monthsOfSupply: 2.95 })
    const line = "Bend has 3.0 months of supply right now. That is a seller's market."
    const market = withPulse.bodyText.indexOf(line)
    expect(market).toBeGreaterThan(withPulse.bodyText.indexOf('they support $585,000 to $625,000'))
    expect(withPulse.bodyText.indexOf('The full report is attached.')).toBeGreaterThan(market)
    expect(withPulse.bodyText.indexOf('months of supply', market + line.length)).toBe(-1)
    expect(withPulse.bodyText).not.toContain('shifting')
    const without = composeCmaFirstContact('expired', FACTS)
    expect(without.bodyText).not.toContain('months of supply')
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
      expect(c.bodyText).not.toMatch(/\d{3}[.\-]\d{3}[.\-]\d{4}|\(\d{3}\)\s?\d{3}/)
      expect(c.bodyText).not.toContain('call or text')
      expect(c.bodyText).not.toContain('give me a call')
      expect(c.bodyText).not.toMatch(/@ryan-realty\.com/)
      expect(c.bodyText.trimEnd().endsWith('Ryan Realty')).toBe(false)
    }
    expect(composeCmaFirstContact('expired', FACTS).bodyText).toContain('Best of luck in the future.')
    expect(composeCmaFirstContact('fsbo', FACTS).bodyText).toContain('Best of luck with the sale.')
  })

  it('leaves the broker name to the system signature', () => {
    const c = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Rebecca Peterson' })
    expect(c.bodyText).not.toContain('Rebecca')
    expect(c.bodyText).not.toContain('My name is')
  })

  const DBR = {
    label: 'Diamond Bar Ranch',
    href: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch?utm_source=crm&utm_medium=doc&utm_campaign=cma-letter',
  }
  const REDMOND = { label: 'Redmond', href: 'https://ryan-realty.com/cities/redmond?utm_source=crm&utm_medium=doc&utm_campaign=cma-letter' }

  it('leaves the subdivision page in the report, not in the email', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      city: 'Redmond',
      subdivision: 'Diamond Bar Ranch',
      monthsOfSupply: 2.95,
      place: { subdivision: { ...DBR, closed12mo: 6, unsold12mo: 19, active: 2, pending: 1, history: null }, wider: REDMOND },
    })
    expect(c.bodyText).not.toContain('Diamond Bar Ranch page')
    expect(c.bodyText).not.toContain('sold in the last twelve months')
    expect(c.bodyText).not.toContain('came off the market without selling')
    expect(c.bodyText).not.toContain('Our Redmond page')
    expect(c.bodyText).toContain("Redmond has 3.0 months of supply right now. That is a seller's market.")
    expect(c.bodyText.match(/months of supply/g)).toEqual(['months of supply'])
    expect(c.bodyText).not.toMatch(/https?:/)
    expect(linkHrefs(c.paragraphs)).toEqual([])
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
      { brokerName: 'Matt Ryan', lastListPrice: 460000, place: { subdivision: { ...DBR, closed12mo: 6, unsold12mo: null, active: 2, pending: null, history: null }, wider: REDMOND } },
    )
    expect(facts.city).toBe('Redmond')
    expect(facts.subdivision).toBe('Diamond Bar Ranch')
    expect(facts.firstName).toBeNull()
    expect(facts.lastListPrice).toBe(460000)
    expect(facts.closedSalesCount).toBe(5)
    expect(facts.salesScope).toBe('near')
    const letter = composeCmaFirstContact('expired', facts)
    expect(letter.bodyText).toContain('Hi there,')
    expect(letter.bodyText).not.toContain('Blair')
    expect(letter.bodyText).toContain('We spent time in the MLS on 2465 7th and put this report together for you.')
    expect(letter.bodyText).toContain('We found five sales of homes like yours near you, and they support $412,000 to $443,000.')
    expect(letter.bodyText).toContain('The last listing asked $460,000, a little above what those sales support.')
    expect(letter.bodyText).not.toContain('In Diamond Bar Ranch')
    expect(linkHrefs(letter.paragraphs)).toEqual([])
  })

  it('keeps the email free of tracked place links when the row has a slug', () => {
    const facts = cmaFirstContactFactsFromRow(
      {
        slug: 'cma-2465-7th',
        subject_address: '2465 7th, Redmond, OR 97756',
        subject_city: 'Redmond',
        subject_subdivision: 'Diamond Bar Ranch',
        client_name: 'Blair Auld',
        value_low: 412000,
        value_high: 443000,
        recommended_list: 435000,
        comps_count: 5,
      },
      {
        brokerName: 'Matt Ryan',
        brokerSlug: 'matt',
        personId: 99,
        place: { subdivision: { ...DBR, closed12mo: 6, unsold12mo: null, active: 2, pending: null, history: null }, wider: REDMOND },
      },
    )
    expect(facts.cmaSlug).toBe('cma-2465-7th')
    const letter = composeCmaFirstContact('expired', facts)
    expect(letter.bodyText).toContain('The full report is attached. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.')
    expect(letter.bodyText).not.toContain('$435,000')
    expect(letter.bodyText).not.toContain('utm_')
    expect(letter.bodyText).not.toMatch(/https?:/)
    expect(linkHrefs(letter.paragraphs)).toEqual([])
  })
})
