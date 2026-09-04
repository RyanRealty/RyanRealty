import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact, composeCmaFirstContactSubject } from '@/lib/cma/first-contact'
import type { CmaOrigin } from '@/lib/cma/origin'

const FACTS = {
  address: '1005 Butler Market',
  firstName: 'Michelle',
  valueLow: 585_000,
  valueHigh: 625_000,
  recommendedList: 605_000,
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
    const all = `${c.subject} ${c.bodyText}`.toLowerCase()
    for (const word of ['agent', 'realtor', 'broker', 'overpriced', 'mistake', 'failed you']) {
      expect(all).not.toContain(word)
    }
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
