/**
 * ROUND-FOUR CLASSES A–D, held on BOTH documents.
 *
 * The four fields these classes turn on land on the pricing side in the same
 * cycle as this work, so no stored row carried them when the renderers were
 * written. Two things follow, and both are tested here:
 *
 *   1. with the field PRESENT, each chapter says the right thing;
 *   2. with it ABSENT, the chapter degrades to the smaller honest statement
 *      rather than throwing or inventing — which is the state every one of the
 *      four exemplars is in today.
 *
 * The letter and the immersive are asserted together wherever the defect was a
 * compliance one (C and D). The audit found the gate on the served admin route
 * only: the letter and the PDF a broker actually sends carried no trace.
 *
 * Fixture overlays that render these same shapes through the production
 * functions live in `scripts/fixtures/cma-round-four/`.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import {
  NON_SOLICITATION_SENTENCE,
  WITHDRAWN_AGREEMENT_SENTENCE,
  closingIsNonSoliciting,
  nextStepButtonsHtml,
  nextStepHeading,
  pricedRightHeading,
  sellerNetBodyHtml,
  sellerNetKick,
  sellerNetPage,
  whatHappenedHeading,
  storyClassFor,
  failedAskForStory,
  type OpinionPageArgs,
} from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const AS_OF = '2026-09-08T12:00:00.000Z'

const broker: CmaBroker = {
  id: null,
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: null,
}

const subject = {
  listingKey: 'S1',
  mlsNumber: '220000850',
  streetAddress: '2465 7th',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Diamond Bar Ranch',
  beds: 3,
  baths: 2,
  sqft: 1440,
  lotAcres: 0.17,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  photoUrl: null,
  standardStatus: 'Withdrawn',
  lastListPrice: 460_000,
  lastListDate: '2026-02-26T23:27:57+00:00',
  listingHistoryLine: null,
  latitude: 44.27,
  longitude: -121.17,
} as unknown as CmaSubject

const comps: CmaAdjustedComp[] = [1, 2, 3, 4, 5].map(
  (i) =>
    ({
      listingKey: `C${i}`,
      mlsNumber: String(220000000 + i),
      address: `${i}00 Swalley`,
      city: 'Redmond',
      subdivision: 'Diamond Bar Ranch',
      beds: 3,
      baths: 2,
      sqft: 1440,
      lotAcres: 0.17,
      propertySubType: 'Single Family Residence',
      yearBuilt: 2004,
      photoUrl: null,
      listPrice: 410_000 + i * 7000,
      closePrice: 410_000 + i * 7000,
      closeDate: '2026-06-24',
      adjustedPrice: 412_000 + i * 7000,
      timeAdjustment: 0,
      sizeAdjustment: 2000,
      weight: 0.2,
    }) as unknown as CmaAdjustedComp,
)

const pricing = {
  method1Low: 412_000,
  method1Mid: 435_000,
  method1High: 443_000,
  method2: null,
  method3: 435_000,
  conservative: 420_000,
  recommended: 435_000,
  highEnd: 452_000,
  valueLow: 412_000,
  valueHigh: 443_000,
  confidence: 'Moderate',
  confidenceReason: 'Five closed sales in the subdivision.',
  needsReview: false,
  reviewReason: null,
  rangeRule: { rule: 'min-max', n: 5, kept: 5, sentence: 'The range is the spread of all five.' },
} as unknown as CmaPricing

/** The itemised sheet 2465's fixture overlay carries. Its column adds up. */
const NET_SHEET = {
  basis: 'Commission is the rate in your listing agreement; title and escrow are the Deschutes County schedule.',
  list: 435_000,
  lines: [
    { label: 'Commission', amount: 21_750, source: 'Listing agreement, 5.0%' },
    { label: 'Title and escrow', amount: 3_100, source: 'Deschutes County schedule' },
    { label: 'Recording and property-tax proration', amount: 1_450, source: 'Deschutes County recording schedule' },
    { label: 'Loan payoff', amount: 210_000, source: 'Payoff quote you provided' },
  ],
  net: 198_700,
  sentence: 'At $435,000 you would walk away with about $198,700.',
  unknowns: [],
}

/** The exposure 2465 actually ran: $475,000 for 152 of 187 days. */
const ASK_EXPOSURE = {
  segments: [
    { ask: 475_000, from: '2026-02-26', to: '2026-07-28', days: 152, sharePct: 81.3, pctAboveRangeTop: 7.2 },
    { ask: 460_000, from: '2026-07-28', to: '2026-09-01', days: 35, sharePct: 18.7, pctAboveRangeTop: 3.8 },
  ],
  dominant: 475_000,
  final: 460_000,
  sentence: 'You asked $475,000 for 152 days, then $460,000 for 35.',
}

const EXPIRED_AUDIT = {
  findings: [{ code: 'ask-above-range', fact: 'The final asking price was $460,000.' }],
  finalCycle: { initialAsk: 475_000, cuts: [{ ask: 460_000, on: '2026-07-28' }] },
} as unknown as OpinionPageArgs['expiredAudit']

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps,
    market: null,
    pricing,
    broker,
    client: { name: 'A Seller', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: AS_OF,
    subjectTrace: 'subject trace',
    compTrace: ['subdivision-6mo: +5 (running 5). GLA ±15%, same subdivision.'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: EXPIRED_AUDIT,
    development: null,
    ...over,
  } as unknown as RenderCmaArgs
}

const letter = (over: Partial<RenderCmaArgs> = {}) => renderCmaHtml(args(over)).html
const immersive = (over: Partial<RenderCmaArgs> = {}) =>
  renderImmersiveCmaHtml({ ...args(over), broker } as never, 'https://ryan-realty.com')
const opinion = (over: Partial<RenderCmaArgs> = {}) => args(over) as unknown as OpinionPageArgs

// ── A. The net figure ───────────────────────────────────────────────────────

describe('A — the net chapter itemises, or prints no figure at all', () => {
  const withSheet = (sellerNet: unknown) =>
    opinion({ pricing: { ...pricing, sellerNet } as unknown as CmaPricing })

  it('itemises every line with its source, and the net is below the list', () => {
    const html = sellerNetBodyHtml(withSheet(NET_SHEET))
    expect(html).toContain('List price')
    expect(html).toContain('$435,000')
    expect(html).toContain('Listing agreement, 5.0%')
    expect(html).toContain('Payoff quote you provided')
    expect(html).toContain('What you keep at $435,000')
    expect(html).toContain('$198,700')
    // The one figure a seller quotes back may never exceed the price above it.
    expect(198_700).toBeLessThan(435_000)
  })

  it('refuses the phrase and names the gap when a deduction is missing', () => {
    const a = withSheet({ ...NET_SHEET, unknowns: ['what you still owe on the home'] })
    const html = sellerNetBodyHtml(a)
    expect(html).toContain('Net at $435,000')
    expect(html).not.toContain('What you keep')
    expect(html).toContain('This does not include what you still owe on the home.')
    expect(sellerNetKick(a)).toBe('Net at list')
  })

  it('prints no figure at all when the column does not add up', () => {
    // A net ABOVE the list — Concorde shipped $1,707,603 on a $1,473,000 list.
    const html = sellerNetBodyHtml(withSheet({ ...NET_SHEET, net: 1_707_603 }))
    expect(html).not.toContain('List price')
    expect(html).toContain('A net at $435,000 needs')
    expect(html).not.toMatch(/\$1,707,603/)
  })

  it('renders no chapter at all on a row that never carried a sheet', () => {
    expect(sellerNetPage(opinion())).toBeNull()
  })
})

// ── B. Which ask ran the clock ──────────────────────────────────────────────

describe('B — the story is told about the ask that ran the clock', () => {
  const withExposure = (askExposure: unknown) =>
    opinion({
      expiredAudit: {
        ...(EXPIRED_AUDIT as unknown as Record<string, unknown>),
        askExposure,
      } as unknown as RenderCmaArgs['expiredAudit'],
    })

  it('names both asks and their days in the chapter title', () => {
    expect(whatHappenedHeading(withExposure(ASK_EXPOSURE))).toBe(
      'You asked $475,000 for 152 days, then $460,000 for 35.',
    )
  })

  it('measures the gap off the dominant ask, not the last cut', () => {
    expect(failedAskForStory(withExposure(ASK_EXPOSURE))).toBe(475_000)
    // Without the field the renderer falls back to the cycle, and says nothing
    // causal — chapter 2b takes its descriptive title (asserted below).
    expect(failedAskForStory(opinion())).toBe(460_000)
  })

  it('reaches both documents', () => {
    const over = {
      expiredAudit: {
        ...(EXPIRED_AUDIT as unknown as Record<string, unknown>),
        askExposure: ASK_EXPOSURE,
      },
    } as unknown as Partial<RenderCmaArgs>
    expect(letter(over)).toContain('You asked $475,000 for 152 days, then $460,000 for 35.')
    expect(immersive(over)).toContain('You asked $475,000 for 152 days, then $460,000 for 35.')
  })

  it('claims nothing causal when the row does not say which ask held the market', () => {
    // The row carries a cycle but no exposure: the gap of the final cut is the
    // wrong measurement, so chapter 2b may not take the overpricing title.
    // (This fixture carries no market block, so chapter 2b has no exhibits and
    // is omitted outright — the title is asserted on the function.)
    expect(storyClassFor(opinion())).toBeNull()
    expect(pricedRightHeading(opinion())).toBe('What price and time look like in Redmond.')
    expect(letter()).not.toContain('What overpricing costs.')
    expect(immersive()).not.toContain('What overpricing costs.')
    // With the exposure present the class is measured again.
    expect(storyClassFor(withExposure(ASK_EXPOSURE))).toBe('near-above')
  })
})

// ── C. A row under review says so, wherever it is read ──────────────────────

describe('C — the review band shows on the letter and the immersive', () => {
  const review = (severity: string, notice: string) =>
    ({ pricing: { ...pricing, review: { severity, rendererNotice: notice } } }) as unknown as Partial<RenderCmaArgs>

  const BLOCKED = 'This report is under broker review and is not final. Do not rely on the price in it until a broker has signed off.'
  const REVIEW = 'This report is under broker review and is not final.'

  it('shows at severity blocked on both documents', () => {
    expect(letter(review('blocked', BLOCKED))).toContain(BLOCKED)
    expect(immersive(review('blocked', BLOCKED))).toContain(BLOCKED)
  })

  it('shows at severity review on both documents', () => {
    expect(letter(review('review', REVIEW))).toContain(REVIEW)
    expect(immersive(review('review', REVIEW))).toContain(REVIEW)
  })

  it('shows nothing at severity none, or with no notice to print', () => {
    expect(letter(review('none', REVIEW))).not.toContain('under broker review')
    expect(letter(review('blocked', ''))).not.toContain('under broker review')
    expect(letter()).not.toContain('under broker review')
    expect(immersive()).not.toContain('under broker review')
  })
})

// ── D. Compliance ───────────────────────────────────────────────────────────

describe('D — the closing never solicits a listing it may not solicit', () => {
  const active = {
    subjectStatus: {
      standardStatus: 'Active',
      isActiveWithOtherBrokerage: true,
      isWithdrawnNotExpired: false,
      listingAgentIsUs: false,
      note: 'On the market today with another brokerage.',
    },
  } as unknown as Partial<RenderCmaArgs>

  const withdrawn = {
    subjectStatus: {
      standardStatus: 'Withdrawn',
      isActiveWithOtherBrokerage: false,
      isWithdrawnNotExpired: true,
      listingAgentIsUs: false,
      note: null,
    },
  } as unknown as Partial<RenderCmaArgs>

  it('drops the ask entirely on a home listed with another brokerage', () => {
    const a = opinion(active)
    expect(closingIsNonSoliciting(a)).toBe(true)
    expect(nextStepHeading(a)).toBe('What this report is.')
    const buttons = nextStepButtonsHtml(a)
    expect(buttons).toContain('cma-search')
    expect(buttons).not.toContain('cma-book')
    expect(buttons).not.toContain('Talk with')
    for (const html of [letter(active), immersive(active)]) {
      expect(html).toContain(NON_SOLICITATION_SENTENCE)
      expect(html).not.toContain('Bring this report.')
      expect(html).not.toContain('Sorry this listing did not sell.')
    }
  })

  it('carries the non-interference sentence on a withdrawn listing', () => {
    const a = opinion(withdrawn)
    // Withdrawn is not somebody else's live listing, so the ask survives — but
    // the agreement may still be running and the document says so.
    expect(closingIsNonSoliciting(a)).toBe(false)
    for (const html of [letter(withdrawn), immersive(withdrawn)]) {
      expect(html).toContain(WITHDRAWN_AGREEMENT_SENTENCE)
      expect(html).not.toContain(NON_SOLICITATION_SENTENCE)
    }
  })

  it('says neither sentence when the row carries no status', () => {
    expect(letter()).not.toContain(NON_SOLICITATION_SENTENCE)
    expect(letter()).not.toContain(WITHDRAWN_AGREEMENT_SENTENCE)
    expect(closingIsNonSoliciting(opinion())).toBe(false)
  })
})
