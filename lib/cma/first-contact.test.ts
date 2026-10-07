import { describe, expect, it } from 'vitest'
import { blamesPriorAgent } from '@/lib/crm/first-touch-copy'
import {
  citySupplySentence,
  cmaFirstContactFactsFromRow,
  composeCmaFirstContact,
  composeCmaFirstContactSubject,
  composeFirstContactNumbers,
  greetingFirstName,
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
  return paragraphs.flat().flatMap((r) => (typeof r === 'string' || !('href' in r) ? [] : [r.href]))
}

describe('first-contact copy (Matt 2026-10-05 email)', () => {
  it('opens with the broker, the concession, and the range, and keeps the recommended price out', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    const report = "Our report accounts for that. It shows where your listing sat against the competition, what nearby homes actually sold for after concessions, the homes you'd be competing with today, and where we'd price it."
    expect(c.bodyText.startsWith('Hi Michelle,')).toBe(true)
    expect(c.bodyText).toContain('My name is Matt Ryan, and I own Ryan Realty here in Bend.')
    expect(c.bodyText).toContain('A home that sells at full price with a 3% concession leaves the seller with 3% less than the record shows.')
    expect(c.bodyText).toContain(report)
    expect(c.bodyText).toContain('Five recent sales of homes like yours support a value between $585,000 and $625,000.')
    expect(c.bodyText).not.toContain('near you')
    expect(c.bodyText).not.toContain('in your area')
    expect(c.bodyText.indexOf('Read the full report')).toBeGreaterThan(c.bodyText.indexOf(report))
    expect(c.bodyText.indexOf('Read the full report')).toBeGreaterThan(c.bodyText.indexOf('support a value between'))
    expect(c.bodyText.indexOf('Please let me know if you have any questions about the numbers or how we put this together.')).toBeGreaterThan(c.bodyText.indexOf('Read the full report'))
    expect(c.bodyText.indexOf("If you've already chosen a broker for your next step, please consider this information only.")).toBeGreaterThan(c.bodyText.indexOf('earn your business'))
    expect(c.bodyText.trimEnd().endsWith('Matt')).toBe(true)
    expect(c.bodyText).not.toContain("We're sorry")
    expect(c.bodyText).not.toContain('comparative market analysis')
    expect(c.bodyText).not.toContain('We would list it at')
    expect(c.bodyText).not.toContain('We would recommend listing')
    expect(c.bodyText).not.toContain('Our price')
    expect(c.bodyText).not.toContain('See our price')
    expect(c.bodyText).not.toContain('$605,000')
    expect(c.bodyText).not.toContain('$700,000')
    expect(c.bodyText).not.toContain("It's yours to keep")
    expect(c.bodyText).not.toContain('sit down')
    expect(c.bodyText).not.toContain('seller\'s market')
    expect(c.bodyText).not.toContain('buyer\'s market')
    expect(c.previewText).toBe('Five sales on 1005 Butler Market support $585,000 to $625,000.')
    expect(c.previewText).not.toContain('$605,000')
    expect(linkHrefs(c.paragraphs)).toEqual([])
  })

  it('asks to earn the business without the essay, on every lane', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.bodyText).toContain('earn your business')
      expect(c.bodyText).not.toContain('the price is everything')
      expect(c.bodyText).not.toContain('the most knowledgeable brokers in Central Oregon')
      expect(c.bodyText).not.toContain('see how we sell homes')
      expect(c.bodyText).not.toContain('read our reviews')
      expect(c.bodyText).not.toContain('learn about our business')
      expect(c.bodyText).not.toContain('premium product')
      expect(c.bodyText).not.toMatch(/https?:/)
      if (o === 'expired') {
        expect(c.bodyText).toContain("the homes you'd be competing with today")
        expect(c.bodyText).toContain("we'd love the opportunity to earn your business")
        expect(c.bodyText).not.toContain('sit down')
        expect(c.bodyText).not.toContain('the price we would list at')
        expect(c.bodyText).not.toContain('We spent time in the MLS')
        expect(c.bodyText).not.toContain('Best of luck')
      } else {
        expect(c.bodyText).toContain('the price we would list at, the homes you would be competing with')
        expect(c.bodyText).not.toContain('sit down')
        expect(c.bodyText).toContain('Please let me know if you have any questions.')
        expect(c.bodyText).not.toContain('My name is')
        expect(c.bodyText.startsWith('Hi there,')).toBe(true)
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
    expect(composeCmaFirstContactSubject('expired', '2240 Oak, Bend, OR 97703')).toBe('An analysis of your home at 2240 Oak')
    expect(composeCmaFirstContactSubject('expired', null)).toBe('An analysis of your home')
    expect(composeCmaFirstContactSubject('fsbo', '2240 Oak')).toBe('A market analysis for 2240 Oak')
    expect(composeCmaFirstContactSubject('seller-valuation', '2240 Oak')).toBe('Your report on 2240 Oak')
    expect(streetOnly('2465 7th, Redmond, OR 97756')).toBe('2465 7th')
    expect(streetOnly('  ')).toBeNull()
  })

  it('keeps the report sentence in the body and does not print a URL', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.close).toBe(
        o === 'expired'
          ? "Please let me know if you have any questions about the numbers or how we put this together. If you consider selling in the future, we'd love the opportunity to earn your business, and we're here anytime."
          : 'The full report is attached. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.',
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
    expect(c.bodyText).toContain("the homes you'd be competing with today")
    expect(c.bodyText).toContain('what nearby homes actually sold for after concessions')
    expect(c.bodyText).toContain("where we'd price it")
    expect(c.bodyText).not.toContain('Every address in it links back to our site')
    expect(c.bodyText).not.toContain('We would list it at $')
  })

  it('prints the city pulse in the market page\'s own words, and only when it was loaded', () => {
    expect(citySupplySentence('Bend', 2.95)).toBe("Bend has 3.0 months of supply right now. That is a seller's market.")
    expect(citySupplySentence('Bend', 4.05)).toBe('Bend has 4.1 months of supply right now. That is a balanced market.')
    expect(citySupplySentence('Bend', 6)).toBe("Bend has 6.0 months of supply right now. That is a buyer's market.")
    expect(citySupplySentence('Bend', null)).toBeNull()
    expect(citySupplySentence('', 2.95)).toBeNull()
    const withPulse = composeCmaFirstContact('expired', { ...FACTS, monthsOfSupply: 2.95 })
    const line = 'Bend is at 3.0 months of supply right now.'
    const market = withPulse.bodyText.indexOf(line)
    expect(market).toBeGreaterThan(withPulse.bodyText.indexOf('support a value between $585,000 and $625,000'))
    expect(withPulse.bodyText.indexOf('Read the full report')).toBeGreaterThan(market)
    expect(withPulse.bodyText.indexOf('months of supply', market + line.length)).toBe(-1)
    expect(withPulse.bodyText).not.toContain("seller's market")
    expect(withPulse.bodyText).not.toContain("buyer's market")
    expect(withPulse.bodyText).not.toContain('balanced market')
    const without = composeCmaFirstContact('expired', FACTS)
    expect(without.bodyText).not.toContain('months of supply')
    const noCity = composeCmaFirstContact('expired', { ...FACTS, city: null, monthsOfSupply: 2.95 })
    expect(noCity.bodyText).not.toContain('months of supply')
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
    expect(composeCmaFirstContact('expired', FACTS).bodyText).toContain('Please let me know if you have any questions about the numbers or how we put this together.')
    expect(composeCmaFirstContact('expired', FACTS).bodyText).not.toContain('Best of luck')
    expect(composeCmaFirstContact('fsbo', FACTS).bodyText).toContain('Best of luck with the sale.')
  })

  it('signs as the assigned broker, and only the owner says they own the brokerage', () => {
    const matt = composeCmaFirstContact('expired', FACTS)
    expect(matt.bodyText).toContain('My name is Matt Ryan, and I own Ryan Realty here in Bend.')
    expect(matt.bodyText.trimEnd().endsWith('Matt')).toBe(true)
    const rebecca = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Rebecca Peterson', brokerSlug: 'rebecca' })
    expect(rebecca.bodyText).toContain("My name is Rebecca Peterson, and I'm a broker at Ryan Realty here in Bend.")
    expect(rebecca.bodyText).not.toContain('I own Ryan Realty')
    expect(rebecca.bodyText).not.toContain('Matt')
    expect(rebecca.bodyText.trimEnd().endsWith('Rebecca')).toBe(true)
    const paula = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Paula Rebecca', brokerSlug: 'paula' })
    expect(paula.bodyText).toContain("My name is Paula Rebecca, and I'm a broker at Ryan Realty here in Bend.")
    expect(paula.bodyText).not.toContain('I own')
    expect(paula.bodyText).not.toContain('Matt Ryan')
    expect(paula.bodyText.trimEnd().endsWith('Paula')).toBe(true)
    const paul = composeCmaFirstContact('expired', { ...FACTS, brokerName: 'Paul Stevenson', brokerSlug: 'paul' })
    expect(paul.bodyText).toContain("My name is Paul Stevenson, and I'm a broker at Ryan Realty here in Bend.")
    expect(paul.bodyText.trimEnd().endsWith('Paul')).toBe(true)
    const unnamed = composeCmaFirstContact('expired', { ...FACTS, brokerName: null, brokerSlug: 'rebecca' })
    expect(unnamed.bodyText).toContain("I'm a broker at Ryan Realty here in Bend.")
    expect(unnamed.bodyText).not.toContain('My name is')
    expect(unnamed.bodyText).not.toContain('I own')
    expect(unnamed.bodyText.trimEnd().endsWith('you.')).toBe(true)
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
    expect(c.bodyText).toContain('Redmond is at 3.0 months of supply right now.')
    expect(c.bodyText).not.toContain("seller's market")
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
    expect(letter.bodyText.startsWith('Hi there,')).toBe(true)
    expect(letter.bodyText).not.toContain('Blair')
    expect(letter.bodyText).toContain('My name is Matt Ryan, and I own Ryan Realty here in Bend.')
    expect(letter.bodyText).not.toContain('comparative market analysis')
    expect(letter.bodyText).not.toContain('We spent time in the MLS')
    expect(letter.bodyText).toContain('Five recent sales of homes like yours support a value between $412,000 and $443,000. Your last list price was $460,000, a little above what those sales support.')
    expect(letter.bodyText).not.toContain('near you')
    expect(letter.bodyText).not.toContain('Diamond Bar Ranch')
    expect(letter.bodyText).not.toContain('$435,000')
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
    expect(letter.subject).toBe('An analysis of your home at 2465 7th')
    expect(letter.bodyText).toContain('Read the full report')
    expect(letter.bodyText).toContain("where we'd price it")
    expect(letter.bodyText).not.toContain('$435,000')
    expect(letter.bodyText).not.toContain('utm_')
    expect(letter.bodyText).not.toMatch(/https?:/)
    expect(linkHrefs(letter.paragraphs)).toEqual([])
  })

  it('greets a real first name and refuses a trust, a placeholder, or a generic word', () => {
    expect(greetingFirstName('Michelle Smith')).toBe('Michelle')
    expect(greetingFirstName('AULD, BLAIR')).toBe('BLAIR')
    expect(greetingFirstName('Jan North Revocable Living Trust')).toBeNull()
    expect(greetingFirstName('Jan North & Bea North Rev Liv Trust')).toBeNull()
    expect(greetingFirstName('Website lead')).toBeNull()
    expect(greetingFirstName('Lead nate@example.com')).toBeNull()
    expect(greetingFirstName('Owner')).toBeNull()
    expect(greetingFirstName('Homeowner Smith')).toBeNull()
    expect(greetingFirstName(null)).toBeNull()
    const one = composeCmaFirstContact('expired', { ...FACTS, closedSalesCount: 1, lastListPrice: 600_000 })
    expect(one.bodyText).toContain('One recent sale of a home like yours supports a value between $585,000 and $625,000. Your last list price was $600,000, inside what those sales support.')
    const below = composeCmaFirstContact('expired', { ...FACTS, lastListPrice: 500_000 })
    expect(below.bodyText).toContain('Your last list price was $500,000, below what those sales support.')
    const bare = composeCmaFirstContact('expired', {
      ...FACTS,
      address: null,
      firstName: 'Owner',
      valueLow: null,
      valueHigh: null,
      recommendedList: null,
      lastListPrice: 700_000,
      closedSalesCount: null,
      monthsOfSupply: 2.95,
      city: 'Bend',
    })
    expect(bare.subject).toBe('An analysis of your home')
    expect(bare.bodyText.startsWith('Hi there,')).toBe(true)
    expect(bare.bodyText).toContain('Your home came off the market recently, so we put together an analysis we thought might be useful.')
    expect(bare.bodyText).not.toContain('Your home at ')
    expect(bare.bodyText).not.toContain('support a value')
    expect(bare.bodyText).not.toContain('last list price')
    expect(bare.bodyText).toContain('Bend is at 3.0 months of supply right now.')
    expect(bare.bodyText).toContain("where we'd price it")
    expect(bare.bodyText).not.toContain('We would list it at')
  })
})
