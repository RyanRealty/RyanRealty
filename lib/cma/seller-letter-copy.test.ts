/**
 * Seller letter shapes Matt refused on 2026-10-02. Anonymized. No owner names.
 */
import { describe, expect, it } from 'vitest'
import { buildCompSearch, rungLabel } from '@/lib/pricing/comp-search'
import { describeRangeSentence } from '@/lib/pricing/estimate'
import { walkTheHouseSentence } from '@/lib/cma/ask-story'
import { adminReviewBannerHtml } from '@/lib/cma/review-banner'
import { REVIEW_REASONS } from '@/lib/pricing/review'
import { newHomeRateParagraph } from '@/lib/cma/new-home-rate'
import { subjectEntry, unsoldEntries } from '@/lib/cma/matrix-entry'
import {
  cityDateCutsFightFlatLocal,
  compsWithoutCityDateMove,
  pricingWithoutCityDateMove,
} from '@/lib/cma/flat-date-story'
import {
  roomAdjustmentWords,
  scrubSellerLetterHtml,
  sellerLetterDefects,
  sellerLetterStillDirty,
  sellerOffMarketDate,
  withoutNegligibleWeight,
} from '@/lib/cma/seller-letter-copy'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'

const BAD = [
  'Four of the five sales are in North Plat. One more was added from own-street-24mo.',
  'The range is the spread of the four of the five sale prices adjusted for date and size: $599,000 to $659,000.',
  'We would walk it with you before saying what.',
  'The sales support more than the price that already failed to sell, so a broker confirms the asking price before this goes out. pass',
].join(' ')

describe('seller letter refuses the shapes that shipped', () => {
  it('names each defect on an anonymized letter', () => {
    const ids = sellerLetterDefects(BAD, { recommended: 625_000, failedAsk: 650_000 }).map((d) => d.id)
    expect(ids).toEqual([
      'internal-search-slug',
      'unfinished-sentence',
      'the-n-of-the-m',
      'review-token',
      'support-contradicts-recommendation',
    ])
  })

  it('scrubs them so own-street-24mo cannot render', () => {
    const html = `<p>${BAD}</p>`
    const clean = scrubSellerLetterHtml(html, { recommended: 625_000, failedAsk: 650_000 })
    expect(clean).not.toContain('own-street-24mo')
    expect(clean).not.toMatch(/the four of the five/)
    expect(clean).not.toContain('before saying what')
    expect(clean).not.toMatch(/\bpass\b/)
    expect(clean).not.toContain('support more than')
    expect(sellerLetterStillDirty(html, { recommended: 625_000, failedAsk: 650_000 })).toEqual([])
  })
})

describe('the generators write plain English', () => {
  it('does not print an own-street slug when a sale comes from that rung', () => {
    expect(rungLabel('own-street-24mo', 'North Plat')).toBe('your own street')
    expect(rungLabel('community-12mo', null)).toBe('your community')
    const search = buildCompSearch({
      subdivision: 'North Plat',
      ladder: [
        { tier: 'subdivision-6mo', ran: true, monthsBack: 6, compsAdded: 4 },
        { tier: 'own-street-24mo', ran: true, monthsBack: 24, compsAdded: 1 },
      ],
      keptComps: [
        { subdivision: 'North Plat', selectionTier: 'subdivision-6mo' },
        { subdivision: 'North Plat', selectionTier: 'subdivision-6mo' },
        { subdivision: 'North Plat', selectionTier: 'subdivision-6mo' },
        { subdivision: 'North Plat', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Other Plat', selectionTier: 'own-street-24mo' },
      ],
    })
    expect(search?.sentence).toBe(
      'Four of the five sales are in North Plat. One more was added from Other Plat.',
    )
    expect(search?.sentence).not.toContain('your own street')
    expect(search?.sentence).not.toContain('own-street-24mo')
    expect(sellerLetterDefects(search?.sentence ?? '')).toEqual([])
  })

  it('does not say the N of the M', () => {
    const sentence = describeRangeSentence({
      rule: 'min-max',
      n: 5,
      kept: 4,
      printedLow: 599_000,
      printedHigh: 659_000,
      saleLow: 599_000,
      saleHigh: 659_000,
    })
    expect(sentence).toContain('four of the five')
    expect(sentence).not.toMatch(/the four of the five/)
    expect(sellerLetterDefects(sentence)).toEqual([])
  })

  it('finishes the walk sentence', () => {
    const sentence = walkTheHouseSentence('inside', 40)
    expect(sentence).toContain('before saying more')
    expect(sentence).not.toContain('before saying what')
    expect(sellerLetterDefects(sentence)).toEqual([])
  })

  it('does not leak a review token or contradict a lower recommendation', () => {
    const html = adminReviewBannerHtml({
      recommended: 625_000,
      review: {
        needsReview: true,
        reasons: [REVIEW_REASONS.failedAskCeiling, REVIEW_REASONS.auditFindings],
        auditVerdict: 'pass',
        severity: 'review',
      },
    })
    expect(html).not.toMatch(/\bpass\b/)
    expect(html).not.toContain('support more than')
    expect(html).toContain('A broker confirms the asking price before this goes out.')
    expect(sellerLetterDefects(html, { recommended: 625_000, failedAsk: 650_000 })).toEqual([])
  })

  it('does not label the list date as the off-market date', () => {
    expect(
      sellerOffMarketDate({ listDate: '2026-03-27', offMarketDate: '2026-03-27', days: null }),
    ).toBeNull()
    expect(
      sellerOffMarketDate({ listDate: '2026-03-27', offMarketDate: null, days: 40 }),
    ).toBe('2026-05-06')
    const subject = {
      streetAddress: '10 North Lane',
      city: 'Bend',
      standardStatus: 'Expired',
      lastListDate: '2026-03-27',
      photoUrl: null,
    } as CmaSubject
    const cycle = {
      listDate: '2026-03-27',
      offMarketDate: null,
      days: null,
      initialAsk: 650_000,
      cuts: [],
      status: 'Expired',
    } as unknown as ExpiredFinalCycle
    const row = subjectEntry({
      subject,
      finalCycle: cycle,
      domDays: null,
      printableAsk: 650_000,
    })
    expect(row.outcome).toMatch(/Came off/)
    expect(row.statusDate).toBeNull()
    const peer = {
      address: '20 North Lane',
      listPrice: 640_000,
      status: 'Expired',
      onMarketDate: '2026-03-27',
      daysOnMarket: 40,
    } as CmaExpiredPeer
    const unsold = unsoldEntries([peer])[0]!
    expect(unsold.statusDate).toBe('2026-05-06')
    expect(unsold.statusDate).not.toBe('2026-03-27')
  })

  it('counts the same new houses the table lists', () => {
    const text = newHomeRateParagraph({
      subjectYear: 2018,
      subjectSqft: 2000,
      asOfIso: '2026-10-02',
      rangeLow: 500_000,
      rangeHigh: 700_000,
      comps: [
        { address: '1 Older', yearBuilt: 2018, closePrice: 600_000, sqft: 2000 },
        { address: '2 Newer', yearBuilt: 2026, closePrice: 640_000, sqft: 2000 },
      ],
      rivals: [
        { address: '1 New', yearBuilt: 2026, listPrice: 604_000, sqft: 2000 },
        { address: '2 New', yearBuilt: 2026, listPrice: 410_400, sqft: 1200 },
        { address: '3 New', yearBuilt: 2026, listPrice: 618_000, sqft: 2000 },
        { address: '4 New', yearBuilt: 2026, listPrice: 646_000, sqft: 2000 },
      ],
    })
    expect(text).toContain('4 houses built in 2026')
    expect(text).toContain('$302, $342, $309, and $323 a square foot')
    expect(text).not.toContain('3 houses built in 2026')
  })

  it('does not move a sale for date when the local rate held flat', () => {
    const comps = [
      {
        listingKey: 'a',
        address: '30 North Lane',
        closePrice: 700_000,
        timeAdjustment: -45_000,
        timeAdjustedPrice: 655_000,
        adjustedPrice: 655_000,
      },
      {
        listingKey: 'b',
        address: '40 North Lane',
        closePrice: 620_000,
        timeAdjustment: 0,
        timeAdjustedPrice: 620_000,
        adjustedPrice: 620_000,
      },
    ]
    expect(cityDateCutsFightFlatLocal({ ppsfMove: 'held flat', comps })).toBe(true)
    const next = compsWithoutCityDateMove(comps)
    expect(next[0]!.timeAdjustment).toBe(0)
    expect(next[0]!.adjustedPrice).toBe(700_000)
    const pricing = pricingWithoutCityDateMove(
      {
        recommended: 625_000,
        valueLow: 599_000,
        valueHigh: 659_000,
        timeAdjustment: { sentence: 'Each sale is moved by the city index, a path that fell 8.0 percent.' },
        rangeRule: {
          rule: 'min-max',
          n: 2,
          kept: 2,
          sentence: 'old',
          adjustedLow: 599_000,
          adjustedHigh: 659_000,
        },
      } as unknown as CmaPricing,
      next,
    )
    expect(pricing.timeAdjustment?.sentence).toContain('held flat')
    expect(pricing.timeAdjustment?.sentence).not.toContain('fell 8.0')
    expect(pricing.rangeRule?.sentence).not.toContain('-$45,000')
    expect(pricing.valueLow).toBe(620_000)
    expect(pricing.valueHigh).toBe(700_000)
    expect(pricing.rangeRule?.sentence).toContain('$620,000 to $700,000')
    expect(pricing.rangeRule?.sentence).not.toContain('$599,000')
    expect(pricing.rangeRule?.sentence).not.toContain('printed range')
    expect(sellerLetterDefects(`${pricing.timeAdjustment?.sentence} ${pricing.rangeRule?.sentence}`)).toEqual([])
  })

  it('keeps a negligible-weight sale in the table and says the weight', () => {
    const weights = new Map<string, { weight: number | null }>([
      ['near', { weight: 40 }],
      ['far', { weight: 0.1 }],
    ])
    const out = withoutNegligibleWeight(
      [
        { listingKey: 'near', address: '30 North Lane' },
        { listingKey: 'far', address: '90 Far Lane' },
      ],
      weights,
    )
    expect(out.comps.map((c) => c.listingKey)).toEqual(['near', 'far'])
    expect(out.note).toContain('under one percent')
    expect(out.note).toContain('in this table')
    expect(out.note).not.toContain('not in this letter')
  })

  it('explains a bedroom difference instead of a zero', () => {
    expect(roomAdjustmentWords(['beds'])).toBe('One bedroom off yours. No dollar adjustment.')
    expect(roomAdjustmentWords(['beds'])).not.toContain('$0')
  })
})
