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
import { buildAnswerFigures, salesPerMonthFrom } from '@/lib/site/answer-figures'
import {
  sellAnswerClaim,
  sellAnswerHasSubstance,
  sellAnswerReadings,
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
  figures: [],
  asOfLabel: 'Sep 8, 2026',
  trace: ['months of supply 3.9 (seller’s market) — market_metric city:bend'],
}

/**
 * Six comparable closes, address-free and price-free, as the ladder hands them
 * over. Six is the floor the strip draws at (V3_DRAWING_MIN_STRIP), so this is
 * the smallest honest distribution.
 */
const MARKS = [
  { id: 'k1', closeDate: '2026-07-14', sqft: 2388, beds: 4, baths: 3, proximity: '0.4 miles NW' },
  { id: 'k2', closeDate: '2026-07-02', sqft: 2510, beds: 4, baths: 3, proximity: '0.6 miles N' },
  { id: 'k3', closeDate: '2026-06-19', sqft: 2295, beds: 3, baths: 2, proximity: '0.3 miles W' },
  { id: 'k4', closeDate: '2026-05-30', sqft: 2440, beds: 4, baths: 3, proximity: null },
  { id: 'k5', closeDate: '2026-04-11', sqft: 2360, beds: 4, baths: 2, proximity: '1.1 miles S' },
  { id: 'k6', closeDate: '2026-03-27', sqft: 2470, beds: 4, baths: 3, proximity: '0.8 miles E' },
]

const FIGURES = () =>
  buildAnswerFigures({
    placeLabel: 'Bend',
    street: '2732 NW Ordway Ave',
    monthsOfSupply: '3.9',
    verdictLabel: "seller's market",
    activeCount: 671,
    salesPerMonth: salesPerMonthFrom(671, 3.88610038610039),
    daysToPending: 23,
    cityDaysToPending: null,
    cityLabel: null,
    compMarks: MARKS,
    compCount: MARKS.length,
    subjectFound: true,
    subjectSummary: '4 bed, 3 bath, 2,410 sq ft, built 2006',
    asOfLabel: 'Sep 8, 2026',
    sources: {
      supply: 'months of supply 3.9 — market_metric city:bend',
      pace: 'days to pending 23 — market_metric city:bend',
      comps: 'comparable closes 6 — Ryan Realty CMA comp ladder',
    },
    unmatchedSentence: 'We could not match it on the first pass. A broker does that by hand.',
  })

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
      ...FIGURES().flatMap((f) => [
        f.claim,
        f.caption,
        f.verdict ?? '',
        f.emptyReason ?? '',
        ...(f.bars ?? []).flatMap((b) => [b.name, b.label, b.note ?? '']),
        ...(f.points ?? []).flatMap((p) => [p.tick, p.label]),
      ]),
      ...sellAnswerReadings(BEND).flatMap((r) => [r.value, r.label, r.sentence, r.detail]),
    ].join(' ')
    expect(rendered).not.toMatch(/\$/)
    // And the component itself carries no money formatter.
    expect(body).not.toMatch(/formatPrice/)
  })
})

/*
 * SITE-02b moved the three drawn figures out of this module and into
 * lib/site/answer-figures.ts, which is the ONE shaping the community ask and
 * /sell both call — so the assertions that used to run against sellSupplyBars /
 * sellSupplySentence / sellBarReading (all three deleted with the hand-rolled
 * bars they fed) now run against buildAnswerFigures. The RULES they check did
 * not change: the pace recovery is still exact, the shorter bar is still read
 * against the taller one, one missing side still draws nothing, and the months
 * figure is still printed exactly as the server formatted it.
 */
describe('months of supply is drawn, not asserted', () => {
  const supply = () => FIGURES().find((f) => f.key === 'supply')

  it('recovers the monthly pace exactly: active / MOS is the six-month close pace', () => {
    // market_metric 2026-09-08: active 671, MOS 3.88610038610039 over sample_n
    // 1036 closes in six months. 1036 / 6 = 172.67, and 671 / 3.886 = 172.67.
    expect(Math.round(salesPerMonthFrom(671, 3.88610038610039) ?? 0)).toBe(173)
    expect(Math.round((1036 / 6) * 100) / 100).toBe(172.67)
    expect(supply()?.bars?.map((b) => b.value)).toEqual([671, 173])
  })

  it('draws two named counts on one scale, never one bar and never a tile', () => {
    const bars = supply()?.bars ?? []
    expect(bars).toHaveLength(2)
    expect(bars[0]?.name).toBe('For sale right now')
    expect(bars[1]?.name).toBe('Under contract in a month')
    // The verdict is the figure's CAPTION, which is the whole point of drawing
    // it: no tile anywhere says "3.9" on its own.
    expect(supply()?.verdict).toBe(
      "That is 3.9 months of homes on the market, which is a seller's market.",
    )
  })

  it('draws nothing when either side is missing', () => {
    const noActive = buildAnswerFigures({
      placeLabel: 'Bend',
      street: 'x',
      monthsOfSupply: '3.9',
      verdictLabel: "seller's market",
      activeCount: null,
      salesPerMonth: 173,
      daysToPending: null,
      cityDaysToPending: null,
      cityLabel: null,
      compMarks: [],
      compCount: null,
      subjectFound: false,
      subjectSummary: null,
      asOfLabel: null,
      sources: { supply: 'trace' },
      unmatchedSentence: 'no match',
    })
    expect(noActive.find((f) => f.key === 'supply')).toBeUndefined()
    expect(salesPerMonthFrom(671, null)).toBeNull()
    expect(salesPerMonthFrom(671, 0)).toBeNull()
  })

  it('prints the months figure exactly as the server formatted it (G68)', () => {
    expect(supply()?.verdict).toContain('3.9 months')
    // Nothing in the answer path rounds or reclassifies the figure itself.
    for (const src of [
      body,
      read('app/sell/_v3/sell-answer.ts'),
      read('lib/site/answer-figures.ts'),
    ]) {
      expect(src).not.toMatch(/monthsOfSupply[A-Za-z0-9_$.?]*\.toFixed\(/)
      // The classifier is imported and called on the SERVER only. Neither the
      // shaping modules nor the rendered body may reach for it.
      expect(src).not.toMatch(/from ['"]@\/lib\/market\/classify['"]/)
      expect(src).not.toMatch(/from ['"]@\/lib\/format\/months-of-supply['"]/)
    }
  })
})

describe('the pace and the comparable sales are drawings, not rows', () => {
  it('puts days to pending on a 0-to-120 rule with the city median as context', () => {
    const withCity = buildAnswerFigures({
      placeLabel: 'NorthWest Crossing',
      street: '2732 NW Ordway Ave',
      monthsOfSupply: null,
      verdictLabel: null,
      activeCount: null,
      salesPerMonth: null,
      daysToPending: 23,
      cityDaysToPending: 31,
      cityLabel: 'Bend',
      compMarks: [],
      compCount: null,
      subjectFound: false,
      subjectSummary: null,
      asOfLabel: null,
      sources: { pace: 'days to pending 23 — market_metric neighborhood:northwest-crossing' },
      unmatchedSentence: 'no match',
    })
    const pace = withCity.find((f) => f.key === 'pace')
    expect(pace?.draw).toBe('rule')
    expect(pace?.axis).toEqual({
      min: 0,
      max: 120,
      ticks: [
        { at: 0, label: '0' },
        { at: 30, label: '30' },
        { at: 60, label: '60' },
        { at: 90, label: '90' },
        { at: 120, label: '120 days' },
      ],
    })
    expect(pace?.context).toEqual({ value: 31, label: 'Bend 31' })
    expect(pace?.points?.[0]?.at).toBe(23)
  })

  it('grows the rule rather than pinning a slower market to its end', () => {
    const slow = buildAnswerFigures({
      placeLabel: 'Brasada Ranch',
      street: 'x',
      monthsOfSupply: null,
      verdictLabel: null,
      activeCount: null,
      salesPerMonth: null,
      daysToPending: 148,
      cityDaysToPending: null,
      cityLabel: null,
      compMarks: [],
      compCount: null,
      subjectFound: false,
      subjectSummary: null,
      asOfLabel: null,
      sources: { pace: 'trace' },
      unmatchedSentence: 'no match',
    })
    expect(slow.find((f) => f.key === 'pace')?.axis?.max).toBe(150)
  })

  it('plots every comparable close by its month, with no address and no price', () => {
    const comps = FIGURES().find((f) => f.key === 'comps')
    expect(comps?.draw).toBe('strip')
    expect(comps?.points).toHaveLength(6)
    // Oldest first: March 2026 on the left.
    expect(comps?.points?.[0]?.tick).toBe('March 2026')
    // The two July closes share one x, which is the point of a strip: they
    // stack in lanes instead of overprinting each other.
    expect(comps?.points?.slice(4).map((p) => p.tick)).toEqual(['July 2026', 'July 2026'])
    expect(comps?.points?.map((p) => p.label).join(' ')).toContain('2,388 sq ft')
    for (const point of comps?.points ?? []) {
      expect(point.label).not.toMatch(/\$/)
      // No street line reaches a mark: the ladder's rows arrive as
      // PlaceCompMark, which has no address field to render.
      expect(point.label).not.toMatch(/\b(Ave|Dr|Ln|St|Rd|Loop|Ct)\b/)
    }
  })

  it('says so plainly when the address did not match a sales record', () => {
    const unmatched = buildAnswerFigures({
      placeLabel: 'Bend',
      street: '2732 NW Ordway Ave',
      monthsOfSupply: null,
      verdictLabel: null,
      activeCount: null,
      salesPerMonth: null,
      daysToPending: null,
      cityDaysToPending: null,
      cityLabel: null,
      compMarks: [],
      compCount: null,
      subjectFound: false,
      subjectSummary: null,
      asOfLabel: null,
      sources: { comps: 'comparable closes unmatched — the address did not resolve' },
      unmatchedSentence: 'We could not match 2732 NW Ordway Ave to a sales record on the first pass.',
    })
    const comps = unmatched.find((f) => f.key === 'comps')
    expect(comps?.claim).toContain('could not match')
    // The claim says what happened; the quiet line says what happens next. It
    // used to repeat the claim word for word under itself (browser, 2026-09-08).
    expect(comps?.emptyReason).toContain('by hand')
    expect(comps?.emptyReason).not.toContain('could not match')
    expect(comps?.points).toHaveLength(0)
  })

  it('every drawn figure carries its own section-0 source', () => {
    for (const figure of FIGURES()) {
      expect(figure.source.trim().length).toBeGreaterThan(10)
      expect(figure.claim.trim().length).toBeGreaterThan(10)
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

  it('keeps only the figures that have no drawing of their own', () => {
    // Pace and the comparable-sales count are DRAWN now (SITE-02b). A figure
    // said twice on one screen is the repetition TASTE.md calls a wall of text.
    expect(sellAnswerReadings(BEND).map((r) => r.key)).toEqual(['cash'])
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
    expect(page).toContain('stickyAskVerdict(bendPulse')
    // /sell publishes Market Truth DETACHED, never the mixed-type live pulse
    // bucket — the rule lib/data/market-truth/getSellBendMarket.test.ts asserts.
    expect(page).toContain('getSellBendMarket')
    // …and the tail's source line must name THAT read. The control shipped
    // printing "Source: market_pulse_live" for a market_metric figure on
    // 2026-09-08; the source is a caller argument now, so this page states it.
    expect(page).toContain("stickyAskVerdict(bendPulse, 'market_metric, Bend detached (Market Truth)')")
    expect(page).not.toContain('market_pulse_live')
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
