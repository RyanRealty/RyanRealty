/**
 * The printed band after the 2026-10-07 trimmed-range ruling, as the review of
 * that change found it, pinned so it cannot come back:
 *
 *  1. A same-street twin that is an end of the adjusted sales is set aside
 *     like any end sale and does not cap the price (Matt 2026-10-08, 915
 *     Saginaw, "Trim normally"; this replaced the 2026-10-07 release of the
 *     twin back into the range), and a recommendation under the printed band
 *     low is a hold (when the failed-ask ceiling put it there) or a build
 *     failure (anything else).
 *  2. Set-aside rows are matched by listing key, so a kept unit at the same
 *     unit-less street address stays in the band.
 *  3. After the pin the failed ask reads exactly one of below / inside (the
 *     rule 22 hold) / above on the printed band.
 *  Wild Rose and Saginaw: the failed-ask ceiling under every sale that set the
 *  price is the 'ask-below-band' hold, never a printed price and never a
 *  pricing failure.
 */
import { describe, expect, it } from 'vitest'
import { failedAskPulledUnderSaleSet, pinPrintedBandToSettingSales, priceCmaSet } from '@/lib/pricing/estimate'
import {
  evaluateLetterConsistencyContract,
  recommendedAtOrAboveBandLowCheck,
} from '@/lib/cma/letter-consistency'
import { setAsideCompIndexes, setAsideEntryFor, setAsideRows } from '@/lib/cma/set-aside'
import { tableAdjustedBand } from '@/lib/cma/cover-value'
import {
  ASK_BELOW_BAND_KIND,
  applyAskBelowBandHold,
  applyAskInBandHold,
  recommendationGapHold,
  storedHoldDecided,
  storedHoldKind,
} from '@/lib/cma/gap-hold'
import { failedAskBelowRangeNote, reclassifyFailedAskOnPrintedBand } from '@/lib/cma/expired-audit'
import { cmaQueueHoldLine, cmaQueueListReason, cmaQueueWhy, CMA_QUEUE_WHY_LABEL } from '@/lib/cma/queue-view'
import { REVIEW_REASONS } from '@/lib/pricing/review'
import { pricingPage, whatItsWorthLead } from '@/lib/cma/render-pricing-page'
import { HELD_PRICE_HEADLINE, coverValueBlockHtml, letterCoverPayoffHtml } from '@/lib/cma/cover-value'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'

function subjectOf(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'S',
    mlsNumber: null,
    streetAddress: '100 Benaiah Ln',
    city: 'Bend',
    state: 'OR',
    postalCode: null,
    subdivision: 'Tanglewood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1998,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Closed',
    lastListPrice: null,
    lastListDate: null,
    listingHistoryLine: null,
    ...over,
  } as unknown as CmaSubject
}

function sale(key: string, address: string, adj: number, over: Partial<CmaAdjustedComp> = {}): CmaAdjustedComp {
  const sqft = (over.sqft as number | undefined) ?? 2000
  return {
    listingKey: key,
    address,
    city: 'Bend',
    subdivision: 'Tanglewood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.2,
    yearBuilt: 1996,
    closePrice: adj,
    closeDate: '2026-09-01',
    listPrice: adj,
    originalListPrice: adj,
    monthsSinceClose: 1,
    timeAdjustment: 0,
    timeAdjustedPrice: adj,
    ppsfTimeAdjusted: adj / sqft,
    sizeAdjustment: 0,
    adjustedPrice: adj,
    weight: 1,
    mlsNumber: null,
    propertySubType: 'Single Family Residence',
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    domTotal: 10,
    ...over,
  } as unknown as CmaAdjustedComp
}

function price(subject: CmaSubject, adjusted: CmaAdjustedComp[], holdFailedAskUnderSaleSet = false) {
  return priceCmaSet({
    subject,
    adjusted,
    market: null,
    input: { priceOverride: null },
    selection: { pricingSales: [], tiersUsed: ['subdivision-3mo'] },
    marketIndex: [],
    asOf: '2026-10-07',
    holdFailedAskUnderSaleSet,
  })
}

describe('1. the street-anchor twin stays in the price (120 Benaiah)', () => {
  // The twin at $500,000 and five sales at $600,000 to $680,000. Every sale
  // stays (Matt 2026-10-09). The twin is the low, so the same-street cap
  // holds the list at $550,000, inside $500,000 to $680,000.
  const adjusted = [
    sale('T', '120 Benaiah Ln', 500_000),
    sale('A', '1 Other St', 600_000),
    sale('B', '2 Other St', 620_000),
    sale('C', '3 Other St', 640_000),
    sale('D', '4 Other St', 660_000),
    sale('E', '5 Other St', 680_000),
  ]

  it('keeps the twin in the weights and caps the list inside the full spread', () => {
    const p = price(subjectOf(), adjusted)
    expect(p).not.toBeNull()
    expect(p!.setAside ?? []).toEqual([])
    expect(p!.streetAnchor).toMatchObject({ listingKeys: ['T'], setAside: false, capped: true, ceiling: 550_000, after: 550_000 })
    expect(p!.recommended).toBe(550_000)
    expect(p!.reconciliation?.weights.map((w) => w.listingKey)).toContain('T')
    expect(p!.rangeRule?.rule).toBe('min-max')
    expect(p!.rangeRule?.n).toBe(6)
    expect(p!.rangeRule?.kept).toBe(6)

    const pinned = pinPrintedBandToSettingSales(p!, adjusted)
    expect(pinned.valueLow).toBe(500_000)
    expect(pinned.valueHigh).toBe(680_000)
    expect(pinned.recommended).toBe(550_000)
    expect(pinned.recommended).toBeGreaterThanOrEqual(pinned.valueLow)
    expect(setAsideRows(pinned, adjusted)).toEqual([])

    const letter = evaluateLetterConsistencyContract({
      html: '<p></p>',
      names: null,
      identity: null,
      pricing: pinned,
      closedComps: adjusted,
    })
    const byId = new Map(letter.checks.map((c) => [c.id, c]))
    expect(byId.get('recommended-at-or-above-band-low')?.pass).toBe(true)
    expect(byId.get('band-overlaps-closed-comps')?.pass).toBe(true)
  })

  it('a recommendation under the printed band low with no failed-ask ceiling fails the build and the letter', () => {
    // The pre-fix shape: $550,000 under a $600,000 to $660,000 band, no clamp.
    const pricing = {
      valueLow: 600_000,
      valueHigh: 660_000,
      recommended: 550_000,
      conservative: 550_000,
      highEnd: 660_000,
      needsReview: false,
      reviewReason: null,
      notes: [],
      failedAsk: null,
      clamp: null,
      hold: null,
    } as unknown as CmaPricing
    const res = applyAskBelowBandHold(pricing, { lastListPrice: null, auditVerdict: 'pass' })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toContain('$550,000')
      expect(res.error).toContain('$600,000 to $660,000')
      // The queue files a failed build with this phrase as "Price outside the sales".
      expect(res.error).toContain('outside the sales')
    }
    expect(pricing.hold ?? null).toBeNull()
    const check = recommendedAtOrAboveBandLowCheck(pricing)
    expect(check.severity).toBe('hard')
    expect(check.pass).toBe(false)
  })

  it('a recommendation on the printed low is not under it', () => {
    // $893,000 under an exact $893,412 low reads $893,000 on the page.
    const check = recommendedAtOrAboveBandLowCheck({ recommended: 893_000, valueLow: 893_412, valueHigh: 951_000 })
    expect(check.pass).toBe(true)
  })
})

describe('2. set-aside rows match by listing key, not by a unit-less address', () => {
  const unitSubject = subjectOf({
    streetAddress: '9 Subject Way',
    subdivision: 'Kenwood',
    beds: 2,
    sqft: 1200,
    propertySubType: 'Townhouse',
  } as Partial<CmaSubject>)
  const unitSale = (key: string, address: string, adj: number) =>
    sale(key, address, adj, { sqft: 1200, beds: 2, subdivision: 'Kenwood', propertySubType: 'Townhouse' } as Partial<CmaAdjustedComp>)
  const adjusted = [
    unitSale('U1', '100 Main St', 500_000),
    unitSale('U2', '100 Main St', 470_000),
    unitSale('A', '1 Other St', 440_000),
    unitSale('B', '2 Other St', 450_000),
    unitSale('C', '3 Other St', 460_000),
    unitSale('D', '4 Other St', 420_000),
  ]

  it('keeps both homes at the same address in the pinned band', () => {
    const p = price(unitSubject, adjusted)
    expect(p).not.toBeNull()
    expect(p!.setAside ?? []).toEqual([])
    const pinned = pinPrintedBandToSettingSales(p!, adjusted)
    expect(pinned.valueLow).toBe(420_000)
    expect(pinned.valueHigh).toBe(500_000)
    expect([...setAsideCompIndexes(pinned, adjusted)]).toEqual([])
    expect(tableAdjustedBand(adjusted, pinned)).toEqual({ low: 420_000, high: 500_000 })
    const letter = evaluateLetterConsistencyContract({
      html: '<p></p>',
      names: null,
      identity: null,
      pricing: pinned,
      closedComps: adjusted,
    })
    expect(letter.checks.find((c) => c.id === 'band-overlaps-closed-comps')?.pass).toBe(true)
  })

  it('falls back to the address only for an entry stored without a key', () => {
    const named = [{ listingKey: null, address: '100 Main St', reason: null, adjustedPrice: 500_000 }]
    expect(setAsideEntryFor(named, { listingKey: 'U2', address: '100 Main St' })).not.toBeNull()
    const keyed = [{ listingKey: 'U1', address: '100 Main St', reason: null, adjustedPrice: 500_000 }]
    expect(setAsideEntryFor(keyed, { listingKey: 'U2', address: '100 Main St' })).toBeNull()
    expect(setAsideEntryFor(keyed, { listingKey: 'U1', address: '100 Main St' })).not.toBeNull()
  })
})

describe('3. the failed ask reads one of below / inside / above on the printed band', () => {
  function pinned(over: Partial<CmaPricing> = {}): CmaPricing {
    return {
      valueLow: 893_412,
      valueHigh: 951_000,
      recommended: 915_000,
      conservative: 893_412,
      highEnd: 951_000,
      needsReview: false,
      reviewReason: null,
      notes: [],
      failedAsk: null,
      failedAskBelowRange: false,
      clamp: null,
      hold: null,
      ...over,
    } as unknown as CmaPricing
  }

  it('the cap read below, the pinned band puts the ask inside: the hold only', () => {
    const ask = 900_000
    const p = pinned({ failedAsk: ask, failedAskBelowRange: true, notes: [failedAskBelowRangeNote(ask)] })
    expect(reclassifyFailedAskOnPrintedBand(p, ask)).toBe('inside')
    expect(p.failedAskBelowRange).toBe(false)
    expect(p.notes).not.toContain(failedAskBelowRangeNote(ask))
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: ask, auditVerdict: 'pass' })
    expect(p.hold?.kind).toBe('ask-in-band')
  })

  it('the cap read inside, the pinned low rose over the ask: below only, no hold', () => {
    const ask = 880_000
    const p = pinned({ failedAsk: ask, valueLow: 893_412 })
    expect(reclassifyFailedAskOnPrintedBand(p, ask)).toBe('below')
    expect(p.failedAskBelowRange).toBe(true)
    expect(p.notes).toContain(failedAskBelowRangeNote(ask))
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: ask, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
  })

  it('an ask on the printed low is inside, never below', () => {
    const ask = 893_000
    const p = pinned({ failedAsk: ask, failedAskBelowRange: true, notes: [failedAskBelowRangeNote(ask)] })
    expect(reclassifyFailedAskOnPrintedBand(p, ask)).toBe('inside')
    expect(p.failedAskBelowRange).toBe(false)
  })

  it('an ask above the band is neither', () => {
    const ask = 975_000
    const p = pinned({ failedAsk: ask })
    expect(reclassifyFailedAskOnPrintedBand(p, ask)).toBe('above')
    expect(p.failedAskBelowRange).toBe(false)
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: ask, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
  })
})

describe('the failed-ask ceiling under the band is a hold: 20676 Wild Rose', () => {
  // Ask $599,900, recommendation $593,000, printed band $610,150 to $678,983,
  // clamp failed-ask $661,000 to $593,000, hold_kind null, and the letter
  // printed $593,000.
  function wildRose(): CmaPricing {
    return {
      valueLow: 610_150,
      valueHigh: 678_983,
      recommended: 593_000,
      conservative: 593_000,
      highEnd: 593_000,
      needsReview: true,
      reviewReason: 'The sales support more than the price that already failed to sell.',
      notes: [],
      failedAsk: 599_900,
      failedAskBelowRange: true,
      clamp: {
        kind: 'failed-ask',
        appliedTo: 'recommended',
        before: 661_000,
        after: 593_000,
        basis: { ratio: 0.99, source: 'test' },
        applications: [
          { tier: 'recommended', before: 661_000, after: 593_000, ratio: 0.99, phrase: null },
          { tier: 'highEnd', before: 678_000, after: 593_000, ratio: 0.99, phrase: null },
        ],
        sentence: 'The sales supported $661,000.',
      },
      hold: null,
    } as unknown as CmaPricing
  }

  it('holds for Matt with the ask, the price and the band', () => {
    const p = wildRose()
    expect(reclassifyFailedAskOnPrintedBand(p, 599_900)).toBe('below')
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: 599_900, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
    const res = applyAskBelowBandHold(p, { lastListPrice: 599_900, auditVerdict: 'pass' })
    expect(res.ok).toBe(true)
    expect(p.hold?.kind).toBe(ASK_BELOW_BAND_KIND)
    expect(p.hold?.ask).toBe(599_900)
    expect(p.hold?.recommended).toBe(593_000)
    expect(p.hold?.bandLow).toBe(610_000)
    expect(p.hold?.bandHigh).toBe(679_000)
    expect(p.hold?.reason).toBe(
      'The recommended price of $593,000 sits under the sales range of $610,000 to $679,000, because the last ask of $599,900 did not sell and the price was pulled under that ask. A price under every sale that set it has not been approved. It stays with you. It was not queued and it was not sent.',
    )
    expect(p.hold?.reason).not.toMatch(/[—–]/)
    expect(p.needsReview).toBe(true)
    expect(p.reviewReason).toContain(p.hold!.reason)
    expect(p.review?.reasons).toContain(REVIEW_REASONS.askBelowBand)
    // The letter contract lets a held below-band price through; nothing sends it.
    expect(recommendedAtOrAboveBandLowCheck(p).pass).toBe(true)
  })

  it('is refused at every send gate, and the queue names it', () => {
    const p = wildRose()
    applyAskBelowBandHold(p, { lastListPrice: 599_900, auditVerdict: 'pass' })
    const summary = { hold_kind: p.hold!.kind, hold_reason: p.hold!.reason, hold_measured: false }
    expect(storedHoldKind(summary)).toBe(ASK_BELOW_BAND_KIND)
    expect(storedHoldDecided(summary)).toBe(true)
    const gap = recommendationGapHold(593_000, 599_900, {
      low: 610_150,
      high: 678_983,
      holdKind: ASK_BELOW_BAND_KIND,
      holdDecided: true,
      origin: 'expired',
    })
    expect(gap.hold).toBe(true)
    if (gap.hold) expect(gap.reason).toContain('$593,000 sits under the sales range of $610,000 to $679,000')

    const row = { state: 'flagged' as const, reviewReason: p.reviewReason, holdKind: ASK_BELOW_BAND_KIND }
    expect(cmaQueueWhy(row)).toBe('ask-below-band')
    expect(CMA_QUEUE_WHY_LABEL['ask-below-band']).toBe('Price under the range')
    expect(cmaQueueListReason(row).startsWith('The recommended price of $593,000')).toBe(true)
    expect(cmaQueueHoldLine(row)).toMatch(/^Price under the range\. The recommended price of \$593,000/)
  })
})

describe('the failed-ask ceiling under every setter is a hold, not a pricing failure: 915 Saginaw shape', () => {
  // A home that failed at $890,000 beside six sales at $905,000 to $960,000.
  // The comps reconcile above the ask, the ceiling pulls the price under the
  // ask, and that is under every sale that set it.
  const subject = subjectOf({ standardStatus: 'Expired', lastListPrice: 890_000 } as Partial<CmaSubject>)
  const adjusted = [
    sale('A', '1 Saginaw Ave', 905_000),
    sale('B', '2 Other St', 915_000),
    sale('C', '3 Other St', 925_000),
    sale('D', '4 Other St', 935_000),
    sale('E', '5 Other St', 945_000),
    sale('F', '6 Other St', 960_000),
  ]

  it('fails pricing for every caller but the build', () => {
    expect(price(subject, adjusted, false)).toBeNull()
  })

  it('reaches the build, which holds it after the pin', () => {
    const p = price(subject, adjusted, true)
    expect(p).not.toBeNull()
    expect(p!.recommended).toBeLessThan(890_000)
    expect(p!.recommended).toBeLessThan(905_000)
    expect(failedAskPulledUnderSaleSet(p!, adjusted.map((c) => c.adjustedPrice))).toBe(true)
    const pinned = pinPrintedBandToSettingSales(p!, adjusted)
    reclassifyFailedAskOnPrintedBand(pinned, 890_000)
    expect(pinned.failedAskBelowRange).toBe(true)
    applyAskInBandHold(pinned, { lastCycleFailed: true, lastListPrice: 890_000, auditVerdict: 'pass' })
    expect(pinned.hold ?? null).toBeNull()
    const res = applyAskBelowBandHold(pinned, { lastListPrice: 890_000, auditVerdict: 'pass' })
    expect(res.ok).toBe(true)
    expect(pinned.hold?.kind).toBe(ASK_BELOW_BAND_KIND)
    expect(pinned.hold?.reason).toContain('because the last ask of $890,000 did not sell')
  })

  it('a price under every setter with no failed-ask ceiling is still not a price', () => {
    expect(
      failedAskPulledUnderSaleSet(
        { recommended: 880_000, clamp: null } as unknown as CmaPricing,
        adjusted.map((c) => c.adjustedPrice),
      ),
    ).toBe(false)
  })
})

describe('rule 26: the held letter says both, once (Matt 2026-10-07, "Hold, letter says both")', () => {
  // Strings a held letter must never print: the contradictory pair Wild Rose
  // printed, the pointer to a section that does not exist, and the clamp's
  // "sales support a value of" figure that appears nowhere else on the page.
  const FORBIDDEN = [
    'List in that range',
    'capped below this range',
    'How we got the price',
    'below the sales band',
    'sits on the sales',
    'support a value of',
    '$661,000',
    // Buyer intent no record holds (reader review 2026-10-08, 20676 Wild Rose).
    'Buyers passed',
    'without an offer',
  ]

  function heldPricing(over: Partial<CmaPricing>): CmaPricing {
    const p = {
      recommended: 593_000,
      conservative: 593_000,
      highEnd: 593_000,
      needsReview: true,
      reviewReason: null,
      notes: [],
      priceOverride: null,
      failedAskBelowRange: true,
      clamp: {
        kind: 'failed-ask',
        appliedTo: 'recommended',
        before: 661_000,
        after: 593_000,
        basis: { ratio: 0.99, source: 'test' },
        applications: [{ tier: 'recommended', before: 661_000, after: 593_000, ratio: 0.99, phrase: null }],
        sentence: 'The sales support a value of $661,000. Because $599,900 already failed to sell, we recommend the price on the cover, which stays under that ask.',
      },
      hold: null,
      ...over,
    } as unknown as CmaPricing
    return p
  }

  describe('20676 Wild Rose: withdrawn after 25 days at $599,900 under $610,150 to $678,983', () => {
    const subject = subjectOf({
      streetAddress: '20676 Wild Rose Ln',
      standardStatus: 'Withdrawn',
      lastListPrice: 599_900,
    } as Partial<CmaSubject>)
    const comps = [
      sale('W1', '1 Rose St', 610_150),
      sale('W2', '2 Rose St', 631_400),
      sale('W3', '3 Rose St', 648_000),
      sale('W4', '4 Rose St', 662_500),
      sale('W5', '5 Rose St', 678_983),
    ]
    const finalCycle = {
      listDate: '2026-08-20',
      initialAsk: 599_900,
      cuts: [],
      offMarketDate: '2026-09-14',
      status: 'Withdrawn',
      days: 25,
    } as unknown as ExpiredFinalCycle
    function held(): CmaPricing {
      const p = heldPricing({ valueLow: 610_150, valueHigh: 678_983, failedAsk: 599_900 })
      const res = applyAskBelowBandHold(p, { lastListPrice: 599_900, auditVerdict: 'pass' })
      expect(res.ok).toBe(true)
      expect(p.hold?.kind).toBe(ASK_BELOW_BAND_KIND)
      return p
    }

    it('chapter 3 states the band, then the failed ask, how long and how it came off', () => {
      const lead = whatItsWorthLead(subject, held(), { asOfIso: '2026-10-07', hasFinalCycle: true }, comps, finalCycle)
      expect(lead).toBe(
        'The five sales that set the range support $610,150 to $678,983. Your home did not sell at its last ask of $599,900. The listing sat 25 days and was withdrawn.',
      )
      for (const bad of FORBIDDEN) expect(lead).not.toContain(bad)
      expect(lead).not.toMatch(/[—–]/)
      // Every dollar is a table figure: the kept sales' ends and the subject's own ask.
      const dollars = lead.match(/\$[\d,]+/g) ?? []
      const table = new Set(['$610,150', '$678,983', '$599,900'])
      for (const d of dollars) expect(table.has(d)).toBe(true)
    })

    it('the chapter prints no clamp sentence, and the cover labels the price as under review', () => {
      const p = held()
      const page = pricingPage({ subject, comps, market: null, pricing: p, finalCycle, askCtx: { asOfIso: '2026-10-07', hasFinalCycle: true } })
      for (const bad of FORBIDDEN) expect(page.body).not.toContain(bad)
      expect(page.body).toContain('The five sales that set the range support $610,150 to $678,983.')
      expect(page.body.match(/support \$610,150 to \$678,983/g)?.length).toBe(1)
      const cover = letterCoverPayoffHtml(p, comps)
      expect(cover).toContain(HELD_PRICE_HEADLINE)
      expect(cover).not.toContain('Our Recommended List Price')
      const block = coverValueBlockHtml({ pricing: p, subject, comps, tiersUsed: [], market: null } as never)
      expect(block).toContain(HELD_PRICE_HEADLINE)
      for (const bad of FORBIDDEN) expect(block).not.toContain(bad)
      expect(block).not.toContain('The sales support')
    })

    it('an unheld letter keeps its own label', () => {
      const p = heldPricing({ valueLow: 580_000, valueHigh: 640_000, recommended: 600_000, clamp: null, failedAskBelowRange: false })
      expect(letterCoverPayoffHtml(p, null)).toContain('Our Recommended List Price')
    })
  })

  describe('915 Saginaw: every sale that set the price adjusts above the $925,000 failed ask', () => {
    const subject = subjectOf({
      streetAddress: '915 Saginaw Ave',
      standardStatus: 'Expired',
      lastListPrice: 925_000,
    } as Partial<CmaSubject>)
    const adjusted = [
      sale('G1', '1 Saginaw Ave', 935_000),
      sale('G2', '2 Other St', 942_000),
      sale('G3', '3 Other St', 950_000),
      sale('G4', '4 Other St', 958_000),
      sale('G5', '5 Other St', 966_000),
      sale('G6', '6 Other St', 975_000),
    ]
    const finalCycle = {
      listDate: '2026-05-01',
      initialAsk: 925_000,
      cuts: [],
      offMarketDate: '2026-08-29',
      status: 'Expired',
      days: 120,
    } as unknown as ExpiredFinalCycle

    it('builds as a hold whose letter says both, never a pricing failure', () => {
      expect(price(subject, adjusted, false)).toBeNull()
      const priced = price(subject, adjusted, true)
      expect(priced).not.toBeNull()
      const p = pinPrintedBandToSettingSales(priced!, adjusted)
      expect(p.recommended).toBeLessThan(925_000)
      reclassifyFailedAskOnPrintedBand(p, 925_000)
      applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
      const res = applyAskBelowBandHold(p, { lastListPrice: 925_000, auditVerdict: 'pass' })
      expect(res.ok).toBe(true)
      expect(p.hold?.kind).toBe(ASK_BELOW_BAND_KIND)
      // All six sales sit above the failed ask, and all six set the band.
      expect(p.valueLow).toBe(935_000)
      expect(p.valueHigh).toBe(975_000)
      const lead = whatItsWorthLead(subject, p, { asOfIso: '2026-10-07', hasFinalCycle: true }, adjusted, finalCycle)
      expect(lead).toBe(
        'The six sales that set the range support $935,000 to $975,000. Your home did not sell at its last ask of $925,000. The listing sat 120 days and expired.',
      )
      for (const bad of FORBIDDEN) expect(lead).not.toContain(bad)
      const letter = evaluateLetterConsistencyContract({ html: `<p>${lead}</p>`, names: null, identity: null, pricing: p, closedComps: adjusted })
      expect(letter.checks.find((c) => c.id === 'recommended-at-or-above-band-low')?.pass).toBe(true)
      expect(letter.checks.find((c) => c.id === 'band-overlaps-closed-comps')?.pass).toBe(true)
    })
  })

  it('a broker override under the band is a person choosing the number: no hold, no failure', () => {
    const p = heldPricing({ valueLow: 610_150, valueHigh: 678_983, failedAsk: 599_900, clamp: null, priceOverride: 595_000, recommended: 595_000 })
    expect(applyAskBelowBandHold(p, { lastListPrice: 599_900, auditVerdict: 'pass' })).toEqual({ ok: true })
    expect(p.hold ?? null).toBeNull()
    expect(recommendedAtOrAboveBandLowCheck(p).pass).toBe(true)
  })
})

describe('rule 22: a letter held because the ask sat inside the range tells one story (2382 Jackson, reader review 2026-10-08)', () => {
  // cma-2382-jackson as stored on b3132caf5: three price-setting sales
  // adjusted to $598,620 to $648,772, the last ask $639,000 inside that range
  // after 227 days, the failed-ask clamp $649,000 to $624,000. The opening
  // says the ask was inside the range and the days point at something other
  // than the number. The opinion chapter then said "List in that range" and
  // "The sales support a value of $649,000. Because $639,000 already failed
  // to sell, we recommend the price on the cover, which stays under that
  // ask": two stories and a figure printed nowhere else.
  const FORBIDDEN = ['List in that range', 'support a value of', '$649,000', 'already failed to sell', 'stays under that ask']
  const subject = subjectOf({
    streetAddress: '2382 Jackson',
    subdivision: 'Holliday Park',
    standardStatus: 'Expired',
    lastListPrice: 639_000,
    sqft: 2016,
  } as Partial<CmaSubject>)
  const comps = [
    sale('J1', '2254 Indigo', 598_620, { sqft: 2091 }),
    sale('J2', '2266 Jackson', 624_000, { sqft: 2002 }),
    sale('J3', '2591 Purcell', 648_772, { sqft: 1655 }),
  ]
  const finalCycle = {
    listDate: '2026-02-17',
    initialAsk: 639_000,
    cuts: [],
    offMarketDate: '2026-10-02',
    status: 'Expired',
    days: 227,
  } as unknown as ExpiredFinalCycle
  function jackson(): CmaPricing {
    const p = {
      recommended: 624_000,
      conservative: 624_000,
      highEnd: 629_000,
      valueLow: 598_620,
      valueHigh: 648_772,
      failedAsk: 639_000,
      needsReview: false,
      reviewReason: null,
      notes: [],
      priceOverride: null,
      clamp: {
        kind: 'failed-ask',
        appliedTo: 'recommended',
        before: 649_000,
        after: 624_000,
        basis: { ratio: 0.9843505477308294, source: 'test' },
        applications: [{ tier: 'recommended', before: 649_000, after: 624_000, ratio: 0.9843505477308294, phrase: null }],
        sentence: 'The sales support a value of $649,000. Because $639,000 already failed to sell, we recommend the price on the cover, which stays under that ask.',
      },
      hold: null,
    } as unknown as CmaPricing
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: 639_000, auditVerdict: 'pass' })
    expect(p.hold?.kind).toBe('ask-in-band')
    expect(p.hold?.ask).toBe(639_000)
    return p
  }

  it('the chapter prints the range once and no list instruction', () => {
    const lead = whatItsWorthLead(subject, jackson(), { asOfIso: '2026-10-07', hasFinalCycle: true }, comps, finalCycle)
    // Rule 22 says rule 26's two facts in rule 26's shape (reader review
    // 2026-10-08): the band the sales support, then the last ask, that it sat
    // inside that band and did not sell, and how the listing came off. The
    // failed-ask ceiling set this $624,000 cover, and a held letter prints no
    // clamp sentence, so the sales set the range (lib/cma/sales-role.ts,
    // reader review 2026-10-08, 62475 Woodsman).
    expect(lead).toBe(
      'The three sales that set the range support $598,620 to $648,772. The last ask of $639,000 was inside that range and did not sell. The listing expired after 227 days.',
    )
    for (const bad of FORBIDDEN) expect(lead).not.toContain(bad)
    expect(lead).not.toMatch(/[—–]/)
  })

  it('the page prints no clamp sentence, and every dollar on the lead is a table figure', () => {
    const p = jackson()
    const page = pricingPage({ subject, comps, market: null, pricing: p, finalCycle, askCtx: { asOfIso: '2026-10-07', hasFinalCycle: true } })
    for (const bad of FORBIDDEN) expect(page.body).not.toContain(bad)
    expect(page.body.match(/support \$598,620 to \$648,772/g)?.length).toBe(1)
    const lead = whatItsWorthLead(subject, p, { asOfIso: '2026-10-07', hasFinalCycle: true }, comps, finalCycle)
    const dollars = lead.match(/\$\d[\d,]*\d/g) ?? []
    const table = new Set(['$598,620', '$624,000', '$648,772', '$639,000'])
    for (const d of dollars) expect(table.has(d)).toBe(true)
  })

  it('the cover labels the price as the one Matt is reviewing and gives no list instruction', () => {
    const p = jackson()
    const cover = letterCoverPayoffHtml(p, comps)
    expect(cover).toContain(HELD_PRICE_HEADLINE)
    expect(cover).not.toContain('Our Recommended List Price')
    const block = coverValueBlockHtml({ pricing: p, subject, comps, tiersUsed: [], market: null } as never)
    expect(block).toContain(HELD_PRICE_HEADLINE)
    expect(block).not.toMatch(/\bList \$/)
  })

  it('an expired home whose ask sat above the range keeps the clamp sentence and the recommend label', () => {
    const p = {
      recommended: 624_000,
      conservative: 624_000,
      highEnd: 629_000,
      valueLow: 598_620,
      valueHigh: 648_772,
      failedAsk: 699_000,
      needsReview: false,
      reviewReason: null,
      notes: [],
      priceOverride: null,
      clamp: {
        kind: 'failed-ask',
        appliedTo: 'recommended',
        before: 649_000,
        after: 624_000,
        basis: { ratio: 0.9843505477308294, source: 'test' },
        applications: [{ tier: 'recommended', before: 649_000, after: 624_000, ratio: 0.9843505477308294, phrase: null }],
        sentence: 'The sales support a value of $649,000. Because $699,000 already failed to sell, we recommend the price on the cover, which stays under that ask.',
      },
      hold: null,
    } as unknown as CmaPricing
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: 699_000, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
    const page = pricingPage({ subject, comps, market: null, pricing: p, finalCycle, askCtx: { asOfIso: '2026-10-07', hasFinalCycle: true } })
    expect(page.body).toContain('already failed to sell')
    expect(letterCoverPayoffHtml(p, comps)).toContain('Our Recommended List Price')
  })
})
