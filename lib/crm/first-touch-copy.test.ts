import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import {
  EXPIRED_FIRST_TOUCH_SEED_V1,
  EXPIRED_FIRST_TOUCH_TEMPLATE_V2,
  FSBO_FIRST_TOUCH_SEED_V1,
  FSBO_FIRST_TOUCH_TEMPLATE_V2,
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
  const voice = checkBrandVoice(body)
  expect(voice.ok, JSON.stringify(voice.violations)).toBe(true)
}

describe('first-touch SMS — expired', () => {
  it('names THIS address, ask, DOM, and cuts when those facts exist', () => {
    const body = buildExpiredFirstTouchSms(FULL)
    assertCBar(body, '1842 NW Foo St')
    expect(body).toContain('$895,000')
    expect(body).toContain('87 days')
    expect(body).toContain('$925,000')
    expect(body).toContain('2 cuts')
    expect(body).toContain('listing video')
    expect(body).toContain('1842 NW Foo St')
    expect(body).toContain(FULL.cmaLink!)
  })

  it('omits ask, DOM, and cuts when missing — and invents no digits', () => {
    const body = buildExpiredFirstTouchSms({
      ...emptyFirstTouchFacts(),
      address: '1842 NW Foo St',
      senderFirstName: 'Matt',
    })
    assertCBar(body, '1842 NW Foo St')
    expect(body).toContain('1842 NW Foo St came off the market without a sale')
    expect(body).not.toMatch(/\$\d/)
    expect(body).not.toMatch(/\d+ days/)
    expect(body).not.toMatch(/\d+ cuts/)
  })

  it('does not invent an address', () => {
    const body = buildExpiredFirstTouchSms(emptyFirstTouchFacts())
    assertCBar(body, null)
    expect(body).toContain('This home came off')
    expect(body).not.toMatch(/\d{3,}/)
  })
})

describe('first-touch SMS — FSBO', () => {
  it('names THIS address and the ask, and markets this home, not /sell', () => {
    const body = buildFsboFirstTouchSms({
      ...FULL,
      originalListPrice: null,
      finalListPrice: null,
      priceCutCount: null,
      daysOnMarket: 14,
    })
    assertCBar(body, '1842 NW Foo St')
    expect(body).toContain('listed by owner')
    expect(body).toContain('$895,000')
    expect(body).toContain('14 days')
    expect(body).toContain('listing video')
    expect(body).not.toContain('good luck')
  })

  it('omits price and days when missing', () => {
    const body = buildFsboFirstTouchSms({
      ...emptyFirstTouchFacts(),
      address: '9 Pine Rd',
    })
    assertCBar(body, '9 Pine Rd')
    expect(body).toBe(
      '9 Pine Rd is listed by owner. We built a market analysis for 9 Pine Rd and the plan we would run on that address: listing video, flyers, and a photo set made for this house.',
    )
  })
})

describe('buildFirstTouchSms', () => {
  it('routes both kinds', () => {
    expect(buildFirstTouchSms('expired', FULL)).toContain('came off without a sale')
    expect(buildFirstTouchSms('fsbo', FULL)).toContain('listed by owner')
  })
})

describe('canonical template detection', () => {
  it('recognizes the live seed and the v2 rewrite', () => {
    expect(isCanonicalFirstTouchBody('expired', EXPIRED_FIRST_TOUCH_SEED_V1)).toBe(true)
    expect(isCanonicalFirstTouchBody('expired', EXPIRED_FIRST_TOUCH_TEMPLATE_V2)).toBe(true)
    expect(isCanonicalFirstTouchBody('fsbo', FSBO_FIRST_TOUCH_SEED_V1)).toBe(true)
    expect(isCanonicalFirstTouchBody('fsbo', FSBO_FIRST_TOUCH_TEMPLATE_V2)).toBe(true)
    expect(isCanonicalFirstTouchBody('expired', 'Hi, custom Matt rewrite.')).toBe(false)
  })

  it('v2 templates name the address token and the this-home plan', () => {
    for (const body of [EXPIRED_FIRST_TOUCH_TEMPLATE_V2, FSBO_FIRST_TOUCH_TEMPLATE_V2]) {
      expect(body).toContain('%address%')
      expect(body).toContain('listing video')
      expect(isWorthQuestionCopy(body)).toBe(false)
      expect(blamesPriorAgent(body)).toBe(false)
    }
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
