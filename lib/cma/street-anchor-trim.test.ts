/**
 * TRIM NORMALLY (Matt 2026-10-08, 915 Saginaw).
 *
 * The printed range is always the trimmed range. A sale on the subject's own
 * street that is the lowest (or highest) adjusted sale is set aside like any
 * end sale: it is not released back into the range, the same-street cap does
 * not set the price, and the street floor does not set the bottom of the
 * band. One sale never decides the price.
 *
 * The reader review of cma-915-saginaw: five sales adjusted to 536 Saginaw
 * $727,148 (own street), 2068 Cascade View $987,577, 335 17th $1,053,909,
 * 628 Portland $1,113,820 and 2258 6th $1,298,050. The trim set aside both
 * ends, then the anchor released 536 Saginaw, redrew the band to $727,148 to
 * $1,113,820 and capped the cover at $727,148 x 1.10 = $800,000 under a
 * canceled $925,000 ask. After the ruling the range is the three middle
 * sales, the price is the failed-ask pull, and that price sits under every
 * sale that set it: the rule 26 ask-below-band hold.
 *
 * A same-street sale INSIDE the kept set still anchors (23 Benaiah).
 */
import { describe, expect, it } from 'vitest'
import { applyStreetAnchor, computePricing, streetAnchorHolds } from '@/lib/cma/pricing'
import { pinPrintedBandToSettingSales, priceCmaSet } from '@/lib/pricing/estimate'
import { applyAskBelowBandHold, applyAskInBandHold, ASK_BELOW_BAND_KIND } from '@/lib/cma/gap-hold'
import { applyFailedAskCap, reclassifyFailedAskOnPrintedBand } from '@/lib/cma/expired-audit'
import { setAsideRows } from '@/lib/cma/set-aside'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

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
    asOf: '2026-10-08',
    holdFailedAskUnderSaleSet,
  })
}

describe('915 Saginaw: the street sale is the lowest adjusted sale, so it is set aside and does not cap', () => {
  const subject = subjectOf({
    streetAddress: '915 Saginaw Ave',
    standardStatus: 'Canceled',
    lastListPrice: 925_000,
  } as Partial<CmaSubject>)
  // The grid's order, as the reader review printed it.
  const adjusted = [
    sale('K17', '335 17th St', 1_053_909),
    sale('KPO', '628 Portland Ave', 1_113_820),
    sale('KCV', '2068 Cascade View Dr', 987_577),
    sale('K6', '2258 6th St', 1_298_050),
    sale('S536', '536 Saginaw Ave', 727_148),
  ]

  it('sets both ends aside, keeps the three middle sales, and records an anchor that did not cap', () => {
    const p = price(subject, adjusted, true)
    expect(p).not.toBeNull()
    // Both ends, in the grid's order, each with the ordinary end reason.
    expect((p!.setAside ?? []).map((s) => [s.listingKey, s.end])).toEqual([
      ['K6', 'high'],
      ['S536', 'low'],
    ])
    expect(p!.setAside!.find((s) => s.listingKey === 'S536')!.reason).toContain('lowest of the adjusted sales')
    expect(p!.rangeRule?.rule).toBe('trimmed-one-each-end')
    expect(p!.rangeRule?.n).toBe(5)
    expect(p!.rangeRule?.kept).toBe(3)
    expect(p!.rangeRule?.sentence).toContain('Two of the five sales sat outside every one of them and were set aside')
    // The street sale carries none of the price.
    expect(p!.reconciliation?.weights.map((w) => w.listingKey).sort()).toEqual(['K17', 'KCV', 'KPO'])
    // The record says it was set aside and did not cap.
    expect(p!.streetAnchor).toMatchObject({
      addresses: ['536 Saginaw Ave'],
      listingKeys: ['S536'],
      anchor: 727_148,
      ceiling: 800_000,
      setAside: true,
      capped: false,
    })
    expect(streetAnchorHolds(p!.streetAnchor)).toBe(false)
    expect(p!.streetAnchor!.after).toBe(p!.streetAnchor!.before)
    expect(p!.streetAnchor!.after).toBe(p!.recommended)
    // Not the street cap, and no cap sentence naming a price the page does not print.
    expect(p!.recommended).not.toBe(800_000)
    expect(p!.recommended).toBeGreaterThan(800_000)
    expect(p!.recommended).toBeLessThan(925_000)
    expect(p!.notes.some((n) => /sits? on the same street/.test(n))).toBe(false)
    // The hero band never reaches down to the set-aside street sale.
    expect(p!.valueLow).toBeGreaterThan(727_148)
  })

  it('pins to $987,577 to $1,113,820 and holds as ask-below-band, not ask-in-band', () => {
    const priced = price(subject, adjusted, true)!
    // EXACTLY the build: the second failed-ask pass with the listing's own
    // facts (lib/cma/build.ts step 4; 138 days, first asked $1,050,000).
    applyFailedAskCap(priced, {
      lastFailedListPrice: 925_000,
      offMarketDate: null,
      daysOnMarket: 138,
      originalListPrice: 1_050_000,
    })
    const p = pinPrintedBandToSettingSales(priced, adjusted)
    expect(p.valueLow).toBe(987_577)
    expect(p.valueHigh).toBe(1_113_820)
    expect(p.recommended).toBeLessThan(925_000)
    expect(p.recommended).toBeLessThan(p.valueLow)
    expect(setAsideRows(p, adjusted).map((r) => r.address)).toEqual(['2258 6th St', '536 Saginaw Ave'])

    reclassifyFailedAskOnPrintedBand(p, 925_000)
    expect(p.failedAskBelowRange).toBe(true)
    applyAskInBandHold(p, { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
    // $925,000 is under the printed $987,000 low: not rule 22.
    expect(p.hold ?? null).toBeNull()
    const res = applyAskBelowBandHold(p, { lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(res.ok).toBe(true)
    expect(p.hold?.kind).toBe(ASK_BELOW_BAND_KIND)
    expect(p.hold).toMatchObject({ ask: 925_000, bandLow: 987_000, bandHigh: 1_115_000 })
    expect(p.hold?.reason).toContain('sits under the sales range of $987,000 to $1,115,000')
  })
})

describe('the street sale at the high end is set aside too', () => {
  const adjusted = [
    sale('A', '1 Other St', 600_000),
    sale('B', '2 Other St', 620_000),
    sale('C', '3 Other St', 640_000),
    sale('D', '4 Other St', 660_000),
    sale('E', '5 Other St', 680_000),
    sale('T', '120 Benaiah Ln', 720_000),
  ]

  it('sets it aside as the highest sale, prices from the kept four, and nothing anchors', () => {
    const p = price(subjectOf(), adjusted)
    expect(p).not.toBeNull()
    expect((p!.setAside ?? []).map((s) => [s.listingKey, s.end])).toEqual([
      ['A', 'low'],
      ['T', 'high'],
    ])
    expect(p!.setAside!.find((s) => s.listingKey === 'T')!.reason).toContain('highest of the adjusted sales')
    expect(p!.reconciliation?.weights.map((w) => w.listingKey)).not.toContain('T')
    expect(p!.streetAnchor ?? null).toBeNull()
    const pinned = pinPrintedBandToSettingSales(p!, adjusted)
    expect(pinned.valueLow).toBe(620_000)
    expect(pinned.valueHigh).toBe(680_000)
    expect(pinned.recommended).toBeGreaterThanOrEqual(620_000)
    expect(pinned.recommended).toBeLessThanOrEqual(680_000)
  })
})

describe('23 Benaiah: the street twin inside the kept set still anchors (unchanged)', () => {
  // A lower sale sits under the twin, so the twin is not an end. The trim
  // sets aside $480,000 and $680,000; the twin at $500,000 is kept, and the
  // cap holds the price to it plus a tenth.
  const subject = subjectOf({ streetAddress: '23 Benaiah Ln' } as Partial<CmaSubject>)
  const adjusted = [
    sale('L', '9 Other St', 480_000),
    sale('T', '31 Benaiah Ln', 500_000),
    sale('A', '1 Other St', 600_000),
    sale('B', '2 Other St', 620_000),
    sale('C', '3 Other St', 640_000),
    sale('D', '4 Other St', 660_000),
    sale('E', '5 Other St', 680_000),
  ]

  it('caps at the twin plus a tenth, keeps the twin in the weights, and sets aside only the two ends', () => {
    const p = price(subject, adjusted)
    expect(p).not.toBeNull()
    expect((p!.setAside ?? []).map((s) => s.listingKey)).toEqual(['L', 'E'])
    expect(p!.reconciliation?.weights.map((w) => w.listingKey)).toContain('T')
    expect(p!.streetAnchor).toMatchObject({
      addresses: ['31 Benaiah Ln'],
      listingKeys: ['T'],
      anchor: 500_000,
      ceiling: 550_000,
      floor: 500_000,
      after: 550_000,
      setAside: false,
      capped: true,
    })
    expect(streetAnchorHolds(p!.streetAnchor)).toBe(true)
    expect(p!.streetAnchor!.before).toBeGreaterThan(550_000)
    expect(p!.recommended).toBe(550_000)
    expect(p!.needsReview).toBe(true)
    expect(p!.notes.some((n) => n.includes('31 Benaiah Ln is the same size as this home and sits on the same street'))).toBe(true)
    // The street floor still draws the bottom of the band.
    expect(p!.valueLow).toBeLessThanOrEqual(500_000)
    const pinned = pinPrintedBandToSettingSales(p!, adjusted)
    expect(pinned.valueLow).toBe(500_000)
    expect(pinned.valueHigh).toBe(660_000)
    expect(pinned.recommended).toBe(550_000)
  })
})

describe('applyStreetAnchor reads only the kept same-street sales', () => {
  const subject = subjectOf({ streetAddress: '23 Benaiah Ln' } as Partial<CmaSubject>)
  const tiers = { conservative: 600_000, recommended: 640_000, highEnd: 680_000 }

  it('every street sale set aside and the cap would have bound: a record that moved nothing, and no note', () => {
    const twin = sale('T', '31 Benaiah Ln', 500_000)
    const notes: string[] = []
    const a = applyStreetAnchor(
      { subject, adjusted: [twin, sale('A', '1 Other St', 640_000)], notes, setAside: (c) => c === twin },
      tiers,
    )
    expect(a).toMatchObject({ setAside: true, capped: false, before: 640_000, after: 640_000, ceiling: 550_000 })
    expect(notes).toEqual([])
  })

  it('a set-aside street sale the cap would not have bound records nothing, as before', () => {
    const twin = sale('T', '31 Benaiah Ln', 700_000)
    const a = applyStreetAnchor(
      { subject, adjusted: [twin], notes: [], setAside: () => true },
      tiers,
    )
    expect(a).toBeNull()
  })

  it('with one street sale set aside and one kept, the kept one alone is the anchor', () => {
    const low = sale('T1', '29 Benaiah Ln', 450_000)
    const kept = sale('T2', '31 Benaiah Ln', 540_000)
    const a = applyStreetAnchor(
      { subject, adjusted: [low, kept], notes: [], setAside: (c) => c === low },
      { conservative: 600_000, recommended: 650_000, highEnd: 680_000 },
    )
    expect(a).toMatchObject({ addresses: ['31 Benaiah Ln'], listingKeys: ['T2'], anchor: 540_000, capped: true })
    expect(a!.after).toBe(595_000)
  })

  it('a set-aside record never carries forward as the prior of a later application', () => {
    const twin = sale('T', '31 Benaiah Ln', 500_000)
    const first = applyStreetAnchor(
      { subject, adjusted: [twin], notes: [], setAside: () => true },
      tiers,
    )
    expect(first?.setAside).toBe(true)
    // The same sale now kept and not binding: no record, not the stale one.
    const again = applyStreetAnchor(
      { subject, adjusted: [twin], notes: [], prior: first },
      { conservative: 500_000, recommended: 540_000, highEnd: 560_000 },
    )
    expect(again).toBeNull()
  })

  it('computePricing with the trimmed ends named: the set-aside twin neither caps nor flags review', () => {
    const adjusted = [
      sale('T', '31 Benaiah Ln', 500_000),
      sale('A', '1 Other St', 600_000),
      sale('B', '2 Other St', 620_000),
      sale('C', '3 Other St', 640_000),
      sale('D', '4 Other St', 660_000),
      sale('E', '5 Other St', 680_000),
    ]
    const capped = computePricing(subject, adjusted, null)!
    expect(capped.streetAnchor?.capped).toBe(true)
    expect(capped.recommended).toBe(capped.streetAnchor!.ceiling)
    const trimmed = computePricing(subject, adjusted, null, {
      streetAnchorSetAside: (c) => c.listingKey === 'T' || c.listingKey === 'E',
    })!
    expect(trimmed.streetAnchor).toMatchObject({ setAside: true, capped: false })
    expect(trimmed.recommended).toBe(trimmed.method3 != null ? Math.round(trimmed.method3 / 5000) * 5000 : NaN)
    expect(trimmed.recommended).toBeGreaterThan(capped.recommended)
    expect(trimmed.needsReview).toBe(false)
    expect(trimmed.notes.some((n) => /sits? on the same street/.test(n))).toBe(false)
  })
})
