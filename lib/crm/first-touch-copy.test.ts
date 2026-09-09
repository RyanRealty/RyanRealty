import { describe, expect, it } from 'vitest'
import {
  EXPIRED_FIRST_TOUCH_SEED_V1,
  EXPIRED_FIRST_TOUCH_TEMPLATE_V2,
  EXPIRED_FIRST_TOUCH_TEMPLATE_V3,
  FSBO_FIRST_TOUCH_SEED_V1,
  FSBO_FIRST_TOUCH_TEMPLATE_V2,
  FSBO_FIRST_TOUCH_TEMPLATE_V3,
  blamesPriorAgent,
  buildExpiredFirstTouchSms,
  buildFirstTouchSms,
  buildFsboFirstTouchSms,
  composeThisHomeMarketClause,
  emptyFirstTouchFacts,
  firstTouchFactsFromProspect,
  isCanonicalFirstTouchBody,
  isWorthQuestionCopy,
} from './first-touch-copy'

const FULL = {
  ...emptyFirstTouchFacts(),
  address: '1842 NW Foo St',
  listPrice: 895000,
  daysOnMarket: 87,
  originalListPrice: 925000,
  finalListPrice: 895000,
  priceCutCount: 2,
  senderFirstName: 'Matt',
  cmaLink: 'https://ryan-realty.com/cma/1842-nw-foo-st',
}

function assertCBar(body: string, address: string | null) {
  expect(isWorthQuestionCopy(body)).toBe(false)
  expect(blamesPriorAgent(body)).toBe(false)
  expect(body).not.toMatch(/ryan-realty\.com\/sell/i)
  expect(body).not.toMatch(/a little about us/i)
  expect(body).not.toMatch(/want me to send it over/i)
  expect(body).not.toMatch(/\bI (saw|put)\b/)
  if (address) expect(body).toContain(address)
}

describe('first-touch SMS — expired', () => {
  it('never recites the owner\'s own list price, DOM, or price cuts — Matt 2026-09-07 (said twice)', () => {
    // Matt: "no one says the ask, fucking no one" + "i did just tell you not
    // to tell them about their listing." The message states only that it did
    // not sell — never their price, their days on market, or their cuts —
    // regardless of what facts are on hand.
    const body = buildExpiredFirstTouchSms(FULL)
    assertCBar(body, '1842 NW Foo St')
    expect(body).toBe(
      "Hi, Matt with Ryan Realty. We noticed 1842 NW Foo St came off the market without selling, and we're sorry it didn't. We put together a market analysis for 1842 NW Foo St. We would like the opportunity to earn your business should you decide to relist. https://ryan-realty.com/cma/1842-nw-foo-st",
    )
    expect(body).not.toMatch(/\$\d/)
    expect(body).not.toMatch(/\d+ days/)
    expect(body).not.toMatch(/\bcuts?\b/i)
    expect(body).not.toMatch(/\bthe ask\b/i)
  })

  it('does not invent an address', () => {
    const body = buildExpiredFirstTouchSms(emptyFirstTouchFacts())
    assertCBar(body, null)
    expect(body).toContain('your home came off')
    expect(body).not.toMatch(/\d{3,}/)
  })
})

describe('first-touch SMS — FSBO', () => {
  it('names THIS address and markets this home, not /sell — never recites price or DOM', () => {
    const body = buildFsboFirstTouchSms({
      ...FULL,
      originalListPrice: null,
      finalListPrice: null,
      priceCutCount: null,
      daysOnMarket: 14,
    })
    assertCBar(body, '1842 NW Foo St')
    expect(body).toContain('is for sale by owner. We respect that.')
    expect(body).toContain('no charge and no strings')
    expect(body).not.toContain('good luck')
    expect(body).not.toContain('sorry')
    expect(body).not.toMatch(/\$\d/)
    expect(body).not.toMatch(/\d+ days/)
  })

  it('is the same message whether or not price/DOM facts exist', () => {
    const body = buildFsboFirstTouchSms({
      ...emptyFirstTouchFacts(),
      address: '9 Pine Rd',
    })
    assertCBar(body, '9 Pine Rd')
    expect(body).toBe(
      "We noticed 9 Pine Rd is for sale by owner. We respect that. We put together a market analysis for 9 Pine Rd. If a second set of numbers helps, it's yours, no charge and no strings.",
    )
  })
})

describe('buildFirstTouchSms', () => {
  it('routes both kinds', () => {
    expect(buildFirstTouchSms('expired', FULL)).toContain("came off the market without selling, and we're sorry it didn't")
    expect(buildFirstTouchSms('fsbo', FULL)).toContain('is for sale by owner')
  })
})

describe('canonical template detection', () => {
  it('recognizes the live seed, the v2 rewrite and the v3 register', () => {
    expect(isCanonicalFirstTouchBody('expired', EXPIRED_FIRST_TOUCH_SEED_V1)).toBe(true)
    expect(isCanonicalFirstTouchBody('expired', EXPIRED_FIRST_TOUCH_TEMPLATE_V2)).toBe(true)
    expect(isCanonicalFirstTouchBody('expired', EXPIRED_FIRST_TOUCH_TEMPLATE_V3)).toBe(true)
    expect(isCanonicalFirstTouchBody('fsbo', FSBO_FIRST_TOUCH_SEED_V1)).toBe(true)
    expect(isCanonicalFirstTouchBody('fsbo', FSBO_FIRST_TOUCH_TEMPLATE_V2)).toBe(true)
    expect(isCanonicalFirstTouchBody('fsbo', FSBO_FIRST_TOUCH_TEMPLATE_V3)).toBe(true)
    expect(isCanonicalFirstTouchBody('expired', 'Hi, custom Matt rewrite.')).toBe(false)
  })

  it('v3 templates carry the address token and the composed body, token for token', () => {
    for (const body of [EXPIRED_FIRST_TOUCH_TEMPLATE_V3, FSBO_FIRST_TOUCH_TEMPLATE_V3]) {
      expect(body).toContain('%address%')
      expect(body).toContain('%cma_link%')
      expect(body).not.toContain('listing video')
      expect(isWorthQuestionCopy(body)).toBe(false)
      expect(blamesPriorAgent(body)).toBe(false)
    }
    const merge = (tpl: string) =>
      tpl.replace(/%sender_first_name%/g, 'Matt').replace(/%address%/g, '1842 NW Foo St').replace(/%cma_link%/g, FULL.cmaLink)
    expect(merge(EXPIRED_FIRST_TOUCH_TEMPLATE_V3)).toBe(buildExpiredFirstTouchSms(FULL))
    expect(merge(FSBO_FIRST_TOUCH_TEMPLATE_V3)).toBe(buildFsboFirstTouchSms(FULL))
  })
})

describe('firstTouchFactsFromProspect', () => {
  it('uses explicit DOM and does not invent a cut count', () => {
    const facts = firstTouchFactsFromProspect({
      address: '1 A St',
      listPrice: 500000,
      daysOnMarket: 40,
      listedAt: '2026-01-01',
      expiredAt: '2026-06-01',
    })
    expect(facts.daysOnMarket).toBe(40)
    expect(facts.priceCutCount).toBeNull()
    expect(facts.listPrice).toBe(500000)
  })

  it('derives DOM from dates only when no explicit DOM exists', () => {
    const facts = firstTouchFactsFromProspect({
      listedAt: '2026-01-10T00:00:00Z',
      expiredAt: '2026-01-20T00:00:00Z',
    })
    expect(facts.daysOnMarket).toBe(10)
  })
})

describe('market clause', () => {
  it('names the address when provided', () => {
    expect(composeThisHomeMarketClause('1842 NW Foo St')).toContain('1842 NW Foo St')
  })
})
