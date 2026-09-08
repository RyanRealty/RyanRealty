/**
 * The /sell answer: its shaping, and the contract the wiring has to keep.
 *
 * Site queue SITE-02 + SITE-10 + SITE-05. Every assertion here is a rule that
 * came from a ruling or a gate, not a restatement of the implementation:
 * no dollar figure, months of supply arrives formatted, the claim is a
 * sentence, the timeframe is asked AFTER the answer, and the ask stamps its
 * source without touching the `source` key that already means something else.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  sellAnswerClaim,
  sellAnswerHasSubstance,
  sellAnswerReadings,
  sellSupplyBars,
  sellSupplySentence,
  type SellAnswerData,
} from './sell-answer'
import { splitSellAddress } from './sell-answer'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const form = read('app/sell/_v3/SellValueForm.tsx')
const page = read('app/sell/page.tsx')
const body = read('app/sell/_v3/SellAnswer.tsx')
const action = read('app/sell/_v3/sell-answer-actions.ts')

/** Bend, detached, as market_metric held it on 2026-09-08 (mt-v1). */
const BEND: SellAnswerData = {
  address: '2732 NW Ordway Ave, Bend, OR 97703',
  street: '2732 NW Ordway Ave',
  placeLabel: 'Bend',
  grain: 'city',
  placeHref: '/housing-market/bend',
  verdictLabel: "seller's market",
  monthsOfSupply: '3.9',
  activeCount: 671,
  salesPerMonth: 671 / 3.88610038610039,
  daysToPending: 23,
  cashSharePct: 27.76708373436,
  compCount: 6,
  subjectFound: true,
  subjectSummary: '4 bed, 3 bath, 2,410 sq ft, built 2006',
  comps: [
    {
      id: 'k1',
      street: '2515 NW Crossing Dr',
      where: 'NorthWest Crossing',
      facts: '4 bed · 3 bath · 2,388 sq ft · built 2005',
      when: 'Closed July 2026',
      proximity: '0.4 miles NW',
    },
  ],
  asOfLabel: 'Sep 8, 2026',
  trace: ['months of supply 3.9 (seller’s market) — market_metric city:bend'],
}

describe('the answer says something, in a sentence, with no price', () => {
  it('leads with the verdict as a claim', () => {
    expect(sellAnswerClaim(BEND)).toBe("Bend is a seller's market right now.")
  })

  it('still makes a claim when the place publishes no verdict', () => {
    const thin: SellAnswerData = { ...BEND, verdictLabel: null, monthsOfSupply: null }
    expect(sellAnswerClaim(thin)).toContain('6 recent Bend sales')
  })

  it('never prints a dollar figure anywhere in the body it renders', () => {
    const rendered = [
      sellAnswerClaim(BEND),
      sellSupplySentence(BEND) ?? '',
      ...sellAnswerReadings(BEND).flatMap((r) => [r.value, r.label, r.sentence, r.detail]),
    ].join(' ')
    expect(rendered).not.toMatch(/\$/)
    // And the component itself carries no money formatter.
    expect(body).not.toMatch(/formatPrice/)
  })
})

describe('months of supply is drawn, not asserted', () => {
  it('recovers the monthly pace exactly: active / MOS is the six-month close pace', () => {
    // market_metric 2026-09-08: active 671, MOS 3.88610038610039 over sample_n
    // 1036 closes in six months. 1036 / 6 = 172.67, and 671 / 3.886 = 172.67.
    const bars = sellSupplyBars(BEND)
    expect(bars).not.toBeNull()
    expect(bars?.sold.count).toBe(173)
    expect(Math.round((1036 / 6) * 100) / 100).toBe(172.67)
  })

  it('scales the shorter bar against the taller one, never an invented ceiling', () => {
    const bars = sellSupplyBars(BEND)
    expect(bars?.forSale.pct).toBe(100)
    expect(bars?.sold.pct).toBeCloseTo((173 / 671) * 100, 1)
  })

  it('draws nothing when either side is missing', () => {
    expect(sellSupplyBars({ ...BEND, activeCount: null })).toBeNull()
    expect(sellSupplyBars({ ...BEND, salesPerMonth: null })).toBeNull()
  })

  it('prints the months figure exactly as the server formatted it (G68)', () => {
    expect(sellSupplySentence(BEND)).toContain('3.9 months')
    // Nothing in the answer path rounds or reclassifies the figure itself.
    for (const src of [body, read('app/sell/_v3/sell-answer.ts')]) {
      expect(src).not.toMatch(/monthsOfSupply[A-Za-z0-9_$.?]*\.toFixed\(/)
      // The classifier is imported and called on the SERVER only. Neither the
      // shaping module nor the rendered body may reach for it.
      expect(src).not.toMatch(/from ['"]@\/lib\/market\/classify['"]/)
      expect(src).not.toMatch(/from ['"]@\/lib\/format\/months-of-supply['"]/)
    }
  })
})

describe('the readings are sentences, not a KPI grid', () => {
  it('gives every reading a plain sentence and a definition behind it', () => {
    for (const reading of sellAnswerReadings(BEND)) {
      expect(reading.sentence.length).toBeGreaterThan(20)
      expect(reading.detail.length).toBeGreaterThan(20)
      expect(reading.sentence).toMatch(/[.!]$/)
    }
  })

  it('says so plainly when the address did not match a sales record', () => {
    const unmatched = sellAnswerReadings({ ...BEND, subjectFound: false, compCount: null })
    const comps = unmatched.find((r) => r.key === 'comps')
    expect(comps?.sentence).toContain('could not match')
    expect(comps?.sentence).toContain('by hand')
  })

  it('has substance only when a figure actually published', () => {
    expect(sellAnswerHasSubstance(BEND)).toBe(true)
    expect(
      sellAnswerHasSubstance({
        ...BEND,
        verdictLabel: null,
        monthsOfSupply: null,
        daysToPending: null,
        subjectFound: false,
        compCount: null,
      }),
    ).toBe(false)
  })
})

describe('the address splits into what the comp ladder wants', () => {
  it('reads a Places-formatted address', () => {
    expect(splitSellAddress('2732 NW Ordway Ave, Bend, OR 97703, USA')).toEqual({
      street: '2732 NW Ordway Ave',
      city: 'Bend',
      postalCode: '97703',
    })
  })

  it('survives an address typed by hand with no zip', () => {
    expect(splitSellAddress('61271 Kwinnum Dr, Bend, OR')).toEqual({
      street: '61271 Kwinnum Dr',
      city: 'Bend',
      postalCode: null,
    })
  })
})

describe('the form asks in the order the nodes fixed', () => {
  it('answers the address before it asks for contact (SITE-02)', () => {
    expect(form).toContain("answerSellValue")
    expect(form).toMatch(/setStep\(sellAnswerHasSubstance\(result\.answer\) \? 'answer' : 'qualify'\)/)
    // The answer step exists between address and qualify.
    expect(form).toMatch(/type Step = 'address' \| 'answer' \| 'qualify' \| 'when' \| 'success'/)
  })

  it('fires address_submit so the accept test has a denominator', () => {
    expect(form).toContain("trackEvent('address_submit', { form: 'get-value', surface: 'sell' })")
  })

  it('keeps email required and phone optional (Matt 2026-09-07)', () => {
    expect(form).toMatch(/id="sell-value-email"[\s\S]{0,220}required/)
    expect(form).not.toMatch(/id="sell-value-phone"[\s\S]{0,220}required/)
    expect(form).not.toMatch(/id="sell-value-name"[\s\S]{0,180}required/)
  })

  it('asks the timeframe AFTER the answer, and the choice is the submit (SITE-10)', () => {
    expect(form.indexOf("setStep('when')")).toBeGreaterThan(-1)
    expect(form).toContain('submit(opt.value)')
    // Every option carries a timeframe, so no submit can land without one.
    for (const v of ['ready-now', 'next-3-6', 'exploring']) {
      expect(form).toContain(`value: '${v}'`)
    }
    // The three read as a SCALE, not as three identical containers: the
    // horizon drives the mark and the weight (evaluator defects 3 and 9).
    expect(form).toContain('horizon')
    expect(form).toContain('--sell-when-horizon')
  })

  it('offers the near-term lane a booking, and only that lane', () => {
    expect(form).toContain('href="/book"')
    expect(form).toContain('bookLane')
    expect(form).toContain("const NEAR_TERM: SellerLPTimeline = 'ready-now'")
  })

  it('stamps the ask source without touching the source key (SITE-05)', () => {
    expect(form).toContain('readAskSource()')
    expect(form).toContain('withAskSource(')
    expect(form).toContain('askSource,')
    // `source` still means WHICH FORM.
    expect(form).toContain("source: 'seller_lp'")
  })

  it('never puts a price on the page for a typed address', () => {
    expect(form).not.toMatch(/value_low|valueLow|estimatedValue|priceRange/)
  })
})

describe('the page wires the two round-one primitives', () => {
  it('gives the hero the sentinel the sticky control watches', () => {
    expect(page).toContain('id="sell-hero"')
    expect(page).toContain('sentinelId="sell-hero"')
    expect(page).toContain('targetId="get-value"')
    expect(page).toContain('focusId="get-value-address"')
  })

  it('mounts the sticky control as a direct child of main', () => {
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'))
    expect(main).toContain('<V3StickyAsk')
  })

  it('feeds the sticky the same months of supply the Instrument prints', () => {
    expect(page).toContain('applyDetachedOverlay(')
    expect(page).toContain('stickyAskVerdict(bendPulse)')
    // /sell publishes Market Truth DETACHED, never the mixed-type live pulse
    // bucket — the rule lib/data/market-truth/getSellBendMarket.test.ts asserts.
    expect(page).toContain('getSellBendMarket')
  })

  it('ships the proof block with the outcome strips off until Matt rules', () => {
    expect(page).toContain('showOutcomes: false')
    expect(page).toContain("attribution: { surface: 'sell', place: 'bend', source: 'proof_block' }")
  })

  it('reaches the routed broker through the roster, never a phone literal (G38)', () => {
    expect(page).toContain('aboutFaceFromBroker')
    expect(page).toContain('`tel:${routedFace.tel}`')
    expect(page).toContain('`sms:${routedFace.tel}`')
    expect(page).not.toMatch(/tel:\+?1?5417033095/)
  })

  it('keeps one reviews surface on the page', () => {
    expect(page).not.toContain('<V3Proof\n')
    expect(page).not.toContain('id="reviews"')
    expect(page).toContain('V3ProofBlock')
  })

  it('answers ungated: no registration wall in front of the figures', () => {
    expect(action).not.toMatch(/requireAuth|getSession|signIn/)
    expect(action.toLowerCase()).toContain('honeypot')
    expect(action).toContain('input.company')
  })
})
