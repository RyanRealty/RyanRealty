/**
 * ONE days-on-market for the subject (CLAUDE.md §0 rule 5 — every sentence must
 * agree with the number it sits next to; §7 — never publish a list-to-close
 * span as DOM).
 *
 * The 2026-09-07 look pass on cma-2465-7th-redmond-97756 printed the subject's
 * time on market twice, from two different definitions:
 *
 *   - the comps matrix read the DOM baked into `subject.listingHistoryLine`,
 *     which lib/cma/subject.ts builds from the MLS row's
 *     CumulativeDaysOnMarket (a list-to-close, across-relists count) → 192;
 *   - the "your last listing" review computed the final cycle's own exposure,
 *     list date to off-market date → 186.
 *
 * One fact, two numbers. The defensible definition for a subject that came off
 * the market unsold is the final listing period's own span, so THAT number is
 * computed once (finalCycleDaysOnMarket) and stamped onto the field the
 * renderer already reads (`subject.listingHistoryLine`).
 */
import { describe, expect, it } from 'vitest'
import { buildFailureFindings, finalCycleDaysOnMarket, stampFinalCycleDom } from './expired-audit'
import { renderCompMatrixHtml } from './comp-matrix'
import { listingHistoryLine } from './listing-history-line'
import type { BpoListingCycle, BpoListingHistory } from '@/lib/bpo/types'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

/** 2026-01-06 → 2026-07-11 is 186 days; the MLS row carried 192 cumulative. */
const CYCLE: BpoListingCycle = {
  listingKey: 'K-SUBJ',
  mlsNumber: '220100777',
  status: 'Expired',
  listAgentName: null,
  listOfficeName: null,
  listDate: '2026-01-06',
  offMarketDate: '2026-07-11',
  originalListPrice: 499000,
  finalListPrice: 479000,
  closePrice: null,
  daysOnMarket: 192,
  priceCutCount: 1,
  totalPriceChangeAmt: -20000,
  wasRelisted: false,
  outcome: 'expired',
}

function subjectFromMlsRow(): CmaSubject {
  // Exactly what lib/cma/subject.ts rowToSubject produces: the history line
  // carries CumulativeDaysOnMarket, not the final cycle's own span.
  const line = listingHistoryLine({
    listPrice: 479000,
    originalListPrice: 499000,
    status: 'Expired',
    onMarketDate: CYCLE.listDate,
    daysOnMarket: CYCLE.daysOnMarket,
  })
  return {
    listingKey: 'K-SUBJ',
    mlsNumber: '220100777',
    streetAddress: '2465 7th St',
    city: 'Redmond',
    state: 'OR',
    postalCode: '97756',
    subdivision: 'Diamond Bar Ranch',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1600,
    lotAcres: 0.18,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Well kept single level home.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 479000,
    lastListDate: CYCLE.listDate,
    listingHistoryLine: line ? `${line}.` : null,
  }
}

function history(cycle: BpoListingCycle): BpoListingHistory {
  return {
    cycles: [cycle],
    attemptsCount: 1,
    failedAttemptsCount: 1,
    currentCycle: cycle,
    currentIsActive: false,
    currentDaysOnMarket: cycle.daysOnMarket,
    currentListPrice: cycle.finalListPrice,
    currentOriginalListPrice: cycle.originalListPrice,
    currentCutFromOriginalPct: null,
    peakAskingPrice: cycle.originalListPrice,
    totalDeclineFromPeakPct: null,
    lastSalePrice: null,
    lastSaleDate: null,
    signals: [],
    listingPressureAdjustmentPct: 0,
    trace: [],
  }
}

const PRICING: CmaPricing = {
  recommended: 465000,
  conservative: 450000,
  highEnd: 480000,
  confidence: 'medium',
  method: 'adjusted-comps',
  notes: [],
} as unknown as CmaPricing

const MARKET = { geoLabel: 'Redmond', medianDom: 21 } as unknown as CmaMarketContext

/**
 * Five closed comps, deliberately carrying no DOM of their own so the only
 * "N days on market" string in the rendered matrix is the SUBJECT's.
 * (renderCompMatrixHtml fails closed below MIN_COMPS.)
 */
function comps(): CmaAdjustedComp[] {
  return Array.from({ length: 5 }, (_, i) => ({
    listingKey: `K${i}`,
    mlsNumber: `2201000${i}`,
    address: `${100 + i} SW Comp St`,
    city: 'Redmond',
    subdivision: 'Diamond Bar Ranch',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1580 + i * 10,
    lotAcres: 0.18,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2003,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 470000,
    closePrice: 460000 + i * 1000,
    closeDate: '2026-04-15',
    daysToOffer: null,
    domTotal: null,
    listingHistoryLine: `Sold at $${(460000 + i * 1000).toLocaleString('en-US')}.`,
    selectionTier: 'subdivision-1',
    monthsSinceClose: 4,
    timeAdjustment: 0,
    timeAdjustedPrice: 460000 + i * 1000,
    ppsfTimeAdjusted: 290,
    sizeAdjustment: 0,
    adjustedPrice: 460000 + i * 1000,
    weight: 1,
  }))
}

/** The number the comps matrix actually prints for the subject. */
function matrixSubjectDom(subject: CmaSubject): number | null {
  const html = renderCompMatrixHtml(subject, comps())
  const m = html.match(/(\d+)\s+days?\s+on\s+market/i)
  return m ? Number(m[1]) : null
}

/** The number the "your last listing" review prints. */
function reviewDom(subject: CmaSubject, cycle: BpoListingCycle): number | null {
  const findings = buildFailureFindings({
    subject,
    pricing: PRICING,
    market: MARKET,
    history: history(cycle),
    photosCount: 24,
    ownershipSince: null,
  })
  const f = findings.find((x) => x.lens === 'time-on-market')
  const m = f?.fact.match(/(\d+)\s+days?\s+on\s+market/i)
  return m ? Number(m[1]) : null
}

describe('subject days on market — one definition, one number', () => {
  it('measures the final listing period, list date to off-market date', () => {
    expect(finalCycleDaysOnMarket(CYCLE)).toBe(186)
  })

  it('falls back to the cycle DOM only when a date is missing', () => {
    expect(finalCycleDaysOnMarket({ ...CYCLE, offMarketDate: null })).toBe(192)
    expect(finalCycleDaysOnMarket({ ...CYCLE, listDate: null, daysOnMarket: null })).toBeNull()
    expect(finalCycleDaysOnMarket(null)).toBeNull()
  })

  it('differences calendar dates, so a keyed-in timestamp cannot move the count', () => {
    // The live shape on cma-2465-7th-redmond-97756: ListDate is a timestamp,
    // off_market_date is a bare date. 2026-02-26 → 2026-09-01 is 187 days
    // whatever time of day the listing was entered.
    const live = {
      listDate: '2026-02-26T23:27:57+00:00',
      offMarketDate: '2026-09-01',
      daysOnMarket: 186,
    }
    expect(finalCycleDaysOnMarket(live)).toBe(187)
    expect(finalCycleDaysOnMarket({ ...live, listDate: '2026-02-26T00:04:00+00:00' })).toBe(187)
    expect(finalCycleDaysOnMarket({ ...live, listDate: '2026-02-26' })).toBe(187)
  })

  it('never returns a negative span', () => {
    expect(finalCycleDaysOnMarket({ ...CYCLE, offMarketDate: '2025-12-01' })).toBe(192)
  })

  it('the raw MLS subject is the divergence this fixture reproduces', () => {
    const subject = subjectFromMlsRow()
    expect(matrixSubjectDom(subject)).toBe(192)
    expect(reviewDom(subject, CYCLE)).toBe(186)
  })

  it('stamping the final cycle makes the matrix and the review print one number', () => {
    const subject = subjectFromMlsRow()
    const stamped = stampFinalCycleDom(subject, CYCLE)
    expect(stamped).toBe(186)
    expect(matrixSubjectDom(subject)).toBe(186)
    expect(reviewDom(subject, CYCLE)).toBe(186)
    expect(matrixSubjectDom(subject)).toBe(reviewDom(subject, CYCLE))
  })

  it('keeps the rest of the history line truthful after the stamp', () => {
    const subject = subjectFromMlsRow()
    stampFinalCycleDom(subject, CYCLE)
    expect(subject.listingHistoryLine).toContain('$499,000')
    expect(subject.listingHistoryLine).toContain('$479,000')
    expect(subject.listingHistoryLine).toContain('186 days on market')
    expect(subject.listingHistoryLine).not.toContain('192')
  })

  it('leaves the line alone when the cycle proves no span', () => {
    const subject = subjectFromMlsRow()
    const before = subject.listingHistoryLine
    expect(stampFinalCycleDom(subject, { ...CYCLE, listDate: null, daysOnMarket: null })).toBeNull()
    expect(subject.listingHistoryLine).toBe(before)
  })
})
