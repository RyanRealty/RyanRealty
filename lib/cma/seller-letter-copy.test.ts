/**
 * Seller letter shapes Matt refused on 2026-10-02. Anonymized. No owner names.
 */
import { describe, expect, it } from 'vitest'
import { buildCompSearch, rungLabel } from '@/lib/pricing/comp-search'
import { describeRangeSentence } from '@/lib/pricing/estimate'
import { askStoryReading, walkTheHouseSentence } from '@/lib/cma/ask-story'
import { cityMedianReconciliationHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { adminReviewBannerHtml } from '@/lib/cma/review-banner'
import { REVIEW_REASONS } from '@/lib/pricing/review'
import { newHomeRateParagraph } from '@/lib/cma/new-home-rate'
import { subjectEntry, unsoldEntries } from '@/lib/cma/matrix-entry'
import {
  cityDateCutsFightFlatLocal,
  compsWithoutCityDateMove,
  homesLikeYoursRangeLabel,
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
  it('does not leave the exclusive-pocket label on a stored method sentence', () => {
    const stored = [
      'These sales are the exclusive pocket.',
      'Date adjustment was applied to 3 sales. 2990 Wells Acres moved -2.4 percent, from $521,180 to $508,567.',
      'The Bend city index is not used to pump prices.',
      'Size and story class do not adjust.',
      'That index is sold and last-ask prices in this exclusive pocket.',
    ].join(' ')
    const clean = scrubSellerLetterHtml(`<p>${stored}</p>`)
    expect(clean).toContain('2990 Wells Acres moved -2.4 percent')
    expect(clean).not.toMatch(/exclusive pocket|pump prices|story class/i)
    expect(sellerLetterStillDirty(`<p>${stored}</p>`)).toEqual([])
  })

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
    // Size did not move, and the date cut was dropped. The sentence must not
    // invent an adjustment that the sales do not have.
    expect(pricing.rangeRule?.sentence).not.toContain('adjusted for')
    expect(sellerLetterDefects(`${pricing.timeAdjustment?.sentence} ${pricing.rangeRule?.sentence}`)).toEqual([])
  })

  it('names the unmoved sales once a flat local market drops the date cut', () => {
    const comps = compsWithoutCityDateMove([
      {
        listingKey: 'a',
        closePrice: 700_000,
        weight: 1,
        timeAdjustment: -45_000,
        timeAdjustedPrice: 655_000,
        adjustedPrice: 655_000,
        sizeAdjustment: 0,
        storyAdjustment: 0,
      },
      {
        listingKey: 'b',
        closePrice: 620_000,
        weight: 1,
        timeAdjustment: 0,
        timeAdjustedPrice: 620_000,
        adjustedPrice: 620_000,
        sizeAdjustment: 0,
        storyAdjustment: 0,
      },
    ])
    const pricing = pricingWithoutCityDateMove(
      {
        recommended: 625_000,
        valueLow: 599_000,
        valueHigh: 659_000,
        timeAdjustment: { sentence: 'Each sale is moved by the city index.' },
        rangeRule: {
          rule: 'min-max',
          n: 2,
          kept: 2,
          sentence: 'old',
          adjustedLow: 599_000,
          adjustedHigh: 659_000,
        },
        reconciliation: {
          weightedPrice: 637_500,
          weights: [
            {
              listingKey: 'a',
              address: '30 North',
              weight: 50,
              weightRaw: 1,
              adjustedPrice: 655_000,
              grossAdjustmentPct: 6.4,
              reason: 'moved for date',
            },
            {
              listingKey: 'b',
              address: '40 North',
              weight: 50,
              weightRaw: 1,
              adjustedPrice: 620_000,
              grossAdjustmentPct: 0,
              reason: 'did not move',
            },
          ],
          mostWeighted: null,
          sentence: null,
        },
        clamp: {
          kind: 'failed-ask',
          appliedTo: 'recommended',
          before: 637_500,
          after: 625_000,
          basis: { ratio: 0.985, source: 'test' },
          applications: [],
          sentence:
            'The sales support a value of $637,500. Because $700,000 already failed to sell, we recommend the price on the cover, which stays under that ask.',
        },
        reviewReason: 'Comp evidence supported $637,500 against the $700,000 asking that just failed.',
      } as unknown as CmaPricing,
      comps,
    )
    expect(pricing.clamp?.before).toBe(660_000)
    expect(pricing.clamp?.sentence).toContain('The sales support a value of $660,000')
    expect(pricing.clamp?.sentence).not.toContain('$637,500')
    expect(pricing.reconciliation?.weightedPrice).toBe(660_000)
    expect(pricing.reconciliation?.weights.find((w) => w.listingKey === 'a')?.grossAdjustmentPct).toBe(0)
    expect(pricing.reviewReason).toContain('$660,000')
    expect(pricing.reviewReason).not.toContain('$637,500')
  })

  it('keeps a size adjustment on the card after a flat market drops the date cut', () => {
    const comps = compsWithoutCityDateMove([
      {
        listingKey: 'a',
        closePrice: 700_000,
        weight: 1,
        timeAdjustment: -45_000,
        timeAdjustedPrice: 655_000,
        adjustedPrice: 725_000,
        sizeAdjustment: 70_000,
        storyAdjustment: 0,
      },
      {
        listingKey: 'b',
        closePrice: 620_000,
        weight: 1,
        timeAdjustment: 0,
        timeAdjustedPrice: 620_000,
        adjustedPrice: 620_000,
        sizeAdjustment: 0,
        storyAdjustment: 0,
      },
    ])
    const pricing = pricingWithoutCityDateMove(
      {
        recommended: 770_000,
        valueLow: 620_000,
        valueHigh: 770_000,
        timeAdjustment: { sentence: 'Each sale is moved by the city index.' },
        rangeRule: {
          rule: 'min-max',
          n: 2,
          kept: 2,
          sentence: 'old',
          adjustedLow: 620_000,
          adjustedHigh: 770_000,
        },
        reconciliation: {
          weightedPrice: 725_000,
          weights: [
            {
              listingKey: 'a',
              address: '30 North',
              weight: 50,
              weightRaw: 1,
              adjustedPrice: 725_000,
              grossAdjustmentPct: 16.4,
              reason: 'moved for date and size',
            },
            {
              listingKey: 'b',
              address: '40 North',
              weight: 50,
              weightRaw: 1,
              adjustedPrice: 620_000,
              grossAdjustmentPct: 0,
              reason: 'did not move',
            },
          ],
          mostWeighted: 'a',
          sentence: null,
        },
      } as unknown as CmaPricing,
      comps,
    )
    // $70,000 of size on a $700,000 sale is 10 percent. The date cut is gone.
    expect(pricing.reconciliation?.weights[0]?.grossAdjustmentPct).toBe(10)
    expect(pricing.rangeRule?.sentence).toContain('adjusted for size')
    expect(pricing.rangeRule?.sentence).not.toContain('date')
    expect(homesLikeYoursRangeLabel(comps)).toBe('where homes like yours sold, adjusted for size')
    expect(
      homesLikeYoursRangeLabel([{ timeAdjustment: -45_000, sizeAdjustment: -1_000 }]),
    ).toBe('where homes like yours sold, adjusted for date and size')
  })

  it('does not say the sales were adjusted for date when nothing moved them', () => {
    const html = cityMedianReconciliationHtml({
      comps: [
        {
          listingKey: 'a',
          address: '30 North',
          closePrice: 700_000,
          adjustedPrice: 700_000,
          weight: 1,
          timeAdjustment: 0,
          sizeAdjustment: 0,
          storyAdjustment: 0,
        },
        {
          listingKey: 'b',
          address: '40 North',
          closePrice: 620_000,
          adjustedPrice: 620_000,
          weight: 1,
          timeAdjustment: 0,
          sizeAdjustment: 0,
          storyAdjustment: 0,
        },
      ],
      pricing: {
        recommended: 660_000,
        valueLow: 620_000,
        valueHigh: 700_000,
        rangeRule: { rule: 'min-max', n: 2, kept: 2 },
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain('sold for $620,000 to $700,000')
    expect(html).not.toContain('adjust')
  })

  it('names a size adjustment when that is the only move', () => {
    const html = cityMedianReconciliationHtml({
      comps: [
        {
          listingKey: 'a',
          address: '30 North',
          closePrice: 700_000,
          adjustedPrice: 710_000,
          weight: 1,
          timeAdjustment: 0,
          sizeAdjustment: 10_000,
          storyAdjustment: 0,
        },
        {
          listingKey: 'b',
          address: '40 North',
          closePrice: 620_000,
          adjustedPrice: 620_000,
          weight: 1,
          timeAdjustment: 0,
          sizeAdjustment: 0,
          storyAdjustment: 0,
        },
      ],
      pricing: {
        recommended: 660_000,
        valueLow: 620_000,
        valueHigh: 710_000,
        rangeRule: { rule: 'min-max', n: 2, kept: 2 },
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain('before adjusting for size')
    expect(html).not.toContain('date')
  })

  it('does not say the days point away from the price when the cover was pulled under a failed ask', () => {
    const reading = askStoryReading({
      ask: 1_600_000,
      rangeLow: 1_560_000,
      rangeHigh: 1_720_700,
      days: 208,
      city: 'Bend',
      marketMedianDom: 26,
      priceCutForFailedAsk: true,
    })
    expect(reading).toContain('inside the range')
    expect(reading).not.toContain('something other than the number')
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
