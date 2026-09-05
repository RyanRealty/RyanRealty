import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import { blamesPriorAgent } from '@/lib/crm/first-touch-copy'
import {
  cmaFirstContactFactsFromRow,
  composeCmaFirstContact,
  composeCmaFirstContactSubject,
} from '@/lib/cma/first-contact'
import type { CmaOrigin } from '@/lib/cma/origin'

const FACTS = {
  address: '1005 Butler Market',
  firstName: 'Michelle',
  valueLow: 585_000,
  valueHigh: 625_000,
  recommendedList: 605_000,
  brokerName: 'Matt Ryan',
  city: 'Bend',
}

const ORIGINS: CmaOrigin[] = ['expired', 'fsbo', 'seller-valuation', 'lead-form', 'broker', 'internal', 'unknown']

describe('first-contact copy', () => {
  it('does not assume a request was made when none was', () => {
    // The old single body opened "The number for X, and the sales that set it"
    // for everyone, including a homeowner who never asked. That reads as a
    // reply to a request they did not make.
    const expired = composeCmaFirstContact('expired', FACTS)
    expect(expired.plan).toContain('came off the market without a sale')
    expect(expired.plan).not.toContain('The number for')

    const fsbo = composeCmaFirstContact('fsbo', FACTS)
    expect(fsbo.plan).toContain('selling 1005 Butler Market yourself')

    const asked = composeCmaFirstContact('seller-valuation', FACTS)
    expect(asked.plan).toBe('The number for 1005 Butler Market, and the sales that set it.')
  })

  it('carries the same verified numbers whatever the origin', () => {
    // Origin changes the opening only. A different price by origin would be a
    // different valuation for the same house.
    const bodies = ORIGINS.map((o) => composeCmaFirstContact(o, FACTS).numbers)
    for (const n of bodies) {
      expect(n).toContain('$585,000')
      expect(n).toContain('$625,000')
      expect(n).toContain('$605,000')
    }
    expect(new Set(bodies).size).toBe(1)
  })

  it('names the failed last list on an expired send', () => {
    const expired = composeCmaFirstContact('expired', { ...FACTS, lastListPrice: 650_000 })
    expect(expired.numbers).toContain('Last list was $650,000')
    expect(expired.numbers).toContain('Closed sales nearby')
    expect(expired.numbers).not.toContain('1005 Butler Market')
  })

  it('subjects say why we are writing', () => {
    expect(composeCmaFirstContactSubject('expired', '2240 Oak')).toBe('2240 Oak, and what sold while it was listed')
    expect(composeCmaFirstContactSubject('fsbo', '2240 Oak')).toBe('2240 Oak, and what it is competing with')
    expect(composeCmaFirstContactSubject('seller-valuation', '2240 Oak')).toBe('Your report on 2240 Oak')
  })

  it('keeps close verbatim inside bodyText so the rail can splice the report URL', () => {
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      expect(c.bodyText).toContain(c.close)
      expect(c.bodyText.replace(c.close, `${c.close} https://x`)).toContain('https://x')
    }
  })

  it('obeys the voice punctuation law on every origin', () => {
    // VOICE.md: no em dash, no en dash, no semicolon, no exclamation. Colon
    // only as a label, which "Recommended list:" is.
    for (const o of ORIGINS) {
      const c = composeCmaFirstContact(o, FACTS)
      const all = `${c.subject} ${c.previewText} ${c.bodyText}`
      expect(all).not.toMatch(/[—–;!]/)
    }
  })

  it('never blames the prior agent on an expired', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    expect(blamesPriorAgent(`${c.subject} ${c.bodyText}`)).toBe(false)
    const all = `${c.subject} ${c.bodyText}`.toLowerCase()
    expect(all).not.toContain('overpriced')
    expect(all).not.toContain('failed you')
    expect(all).not.toContain('your last agent')
  })

  it('introduces the brokerage, invites a talk, and links about and reviews on an expired send', () => {
    const c = composeCmaFirstContact('expired', FACTS)
    expect(c.bodyText).toContain('This is Matt Ryan, owner of Ryan Realty in Bend')
    expect(c.bodyText).toContain('came off the market without a sale')
    expect(c.bodyText).toContain('Reply or call to walk through the numbers')
    expect(c.bodyText).toContain('https://ryan-realty.com/reviews')
    expect(c.bodyText).toContain('https://ryan-realty.com/about')
    expect(c.bodyText).toContain('Call anytime')
    expect(c.bodyText).not.toMatch(/\bCMA\b/)
    const voice = checkBrandVoice(c.bodyText)
    expect(voice.ok, JSON.stringify(voice.violations)).toBe(true)
  })

  it('names the neighborhood page when one is on the subject', () => {
    const c = composeCmaFirstContact('expired', {
      ...FACTS,
      neighborhoodName: 'Riverwest',
      neighborhoodSlug: 'riverwest',
    })
    expect(c.bodyText).toContain('what is selling in Riverwest')
    expect(c.bodyText).toMatch(/\/cities\/bend\/riverwest/)
    expect(c.bodyText).not.toContain('what is selling in Bend')
  })

  it('falls back to the city page when there is no neighborhood', () => {
    const c = composeCmaFirstContact('expired', { ...FACTS, city: 'Redmond' })
    expect(c.bodyText).toContain('what is selling in Redmond')
    expect(c.bodyText).toMatch(/\/cities\/redmond/)
  })

  it('does not invent a place link when the city is unknown', () => {
    const c = composeCmaFirstContact('expired', {
      address: '1005 Butler Market',
      firstName: 'Michelle',
      valueLow: 585_000,
      valueHigh: 625_000,
      recommendedList: 605_000,
    })
    expect(c.bodyText).not.toContain('what is selling in')
  })

  it('does not pitch a relist on an asked report', () => {
    const c = composeCmaFirstContact('seller-valuation', FACTS)
    expect(c.bodyText).not.toContain('came off the market')
    expect(c.bodyText).not.toContain('If you list again')
    expect(c.bodyText).toContain('This is Matt Ryan')
    expect(c.bodyText).toContain('Reply or call to walk through the numbers')
  })

  it('reads city and neighborhood off a cmas row without inventing them', () => {
    const facts = cmaFirstContactFactsFromRow(
      {
        subject_address: '2465 7th',
        subject_city: 'Redmond',
        subject_subdivision: 'Diamond Bar Ranch',
        client_name: 'Blair Auld',
        value_low: 378000,
        value_high: 407000,
        recommended_list: 392000,
        render_args: {
          market: { geoLabel: 'Redmond', geoSlug: 'redmond' },
          subject: { city: 'Redmond', subdivision: 'Diamond Bar Ranch' },
        },
      },
      { brokerName: 'Matt Ryan', lastListPrice: 460000 },
    )
    expect(facts.city).toBe('Redmond')
    expect(facts.subdivision).toBe('Diamond Bar Ranch')
    expect(facts.firstName).toBe('Blair')
    expect(facts.lastListPrice).toBe(460000)
    const letter = composeCmaFirstContact('expired', facts)
    expect(letter.bodyText).toContain('what is selling in Diamond Bar Ranch')
    expect(letter.bodyText).toMatch(/\/subdivisions\/diamond-bar-ranch/)
    expect(letter.bodyText).not.toContain('what is selling in Redmond')
  })

  it('keeps the letter on the send rail instead of a model rewrite', () => {
    const src = readFileSync(new URL('./send.ts', import.meta.url), 'utf8')
    expect(src).toContain('composeCmaFirstContact')
    expect(src).not.toContain('generateGrokText')
  })

  it('falls back cleanly with no name and no address', () => {
    const c = composeCmaFirstContact('expired', {
      address: null,
      firstName: null,
      valueLow: null,
      valueHigh: null,
      recommendedList: null,
    })
    expect(c.greeting).toBe('Hi there,')
    expect(c.subject).toBe('Your report on this home')
    // No numbers clause rather than an invented one.
    expect(c.numbers).toBeNull()
    expect(c.bodyText).not.toContain('null')
  })
})
