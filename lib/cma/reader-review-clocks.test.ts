/**
 * Reader review of four drafts, 2026-10-07 (3037 Purcell, 2382 Jackson,
 * 3177 Coho, 20676 Wild Rose). One clock per sale, a "never got one" only when
 * the subject's days earn it, and the small wording calls that carry logic.
 */
import { describe, expect, it } from 'vitest'
import { closedSaleDaysToOffer } from '@/lib/cma/listing-history-line'
import { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'
import { closedEntries, pinFactsFor } from '@/lib/cma/matrix-entry'
import { domCell } from '@/lib/cma/comp-matrix'
import { pinRevealLine } from '@/lib/cma/comp-pin-map'
import { preserveHydratedClosedCompDom } from '@/lib/pricing/estimate'
import {
  mosWindowMonths,
  renderDaysToOfferHtml,
  renderInventoryBoardHtml,
  renderOfferTimingHtml,
  subjectDaysAgainst,
} from '@/lib/cma/market-area-chapters'
import { timelineEndLabel } from '@/lib/cma/market-charts'
import { askStoryReading } from '@/lib/cma/ask-story'
import { placePricingStoryHtml } from '@/lib/cma/place-pricing-story'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

// ── 1. one clock per sale ───────────────────────────────────────────────────

describe('the offer clock and the days on market share one start', () => {
  it('moves a relist-day offer count back to the first list (3169 Coho)', () => {
    // Listed Jun 1, 2024, relisted later; the record's 3 days counted from the
    // relist. Pending on Sep 23 is 114 days from the first list.
    expect(
      closedSaleDaysToOffer({
        daysToOffer: 3,
        measuredFrom: '2024-09-20',
        firstListDate: '2024-06-01',
        domTotal: 146,
      }),
    ).toBe(114)
  })

  it('drops an offer count longer than the run to close (2107 Carrie, 67 of 66)', () => {
    expect(closedSaleDaysToOffer({ daysToOffer: 67, domTotal: 66 })).toBeNull()
    expect(closedSaleDaysToOffer({ daysToOffer: 66, domTotal: 66 })).toBe(66)
    expect(closedSaleDaysToOffer({ daysToOffer: -1, domTotal: 66 })).toBeNull()
    expect(closedSaleDaysToOffer({ daysToOffer: 12 })).toBe(12)
  })

  it('drops an offer count whose start is after an undated earlier listing', () => {
    // The MLS counts 146 days, the row's dates only 35: an earlier listing the
    // row has no date for. Shifting by the gap would be an estimate.
    expect(
      closedSaleDaysToOffer({ daysToOffer: 3, firstListDate: '2024-09-20', closeDate: '2024-10-25', domTotal: 146 }),
    ).toBeNull()
    // Dated, the same sale keeps its (shifted) count.
    expect(
      closedSaleDaysToOffer({
        daysToOffer: 3,
        measuredFrom: '2024-09-20',
        firstListDate: '2024-06-01',
        closeDate: '2024-10-25',
        domTotal: 146,
      }),
    ).toBe(114)
  })

  it('stamps the shifted offer count with the first-list DOM, once', () => {
    const comp = {
      listingKey: 'K',
      closeDate: '2024-10-25',
      onMarketDate: '2024-09-20',
      daysToOffer: 3,
      domTotal: 35,
      listPrice: 620000,
      originalListPrice: 650000,
      closePrice: 599000,
    } as unknown as CmaComp
    const once = stampClosedCompDom(comp, { originalEntryTimestamp: '2024-06-01T10:00:00Z' })
    expect(once.onMarketDate).toBe('2024-06-01')
    expect(once.domTotal).toBe(146)
    expect(once.daysToOffer).toBe(114)
    // Idempotent: a second stamp starts from the first list already.
    const twice = stampClosedCompDom(once, { originalEntryTimestamp: '2024-06-01T10:00:00Z' })
    expect(twice.daysToOffer).toBe(114)
  })

  it('keeps the hydrated offer count through a pricing rebuild', () => {
    const rebuilt = { daysToOffer: 3, domTotal: 35, onMarketDate: '2024-09-20' } as unknown as CmaComp
    const hydrated = { daysToOffer: 114, domTotal: 146, onMarketDate: '2024-06-01', listingHistoryLine: null }
    expect(preserveHydratedClosedCompDom(rebuilt, hydrated).daysToOffer).toBe(114)
    // A hydrate that dropped a broken count keeps it dropped.
    expect(preserveHydratedClosedCompDom(rebuilt, { ...hydrated, daysToOffer: null }).daysToOffer).toBeNull()
    // An older hydrate without the field leaves the rebuilt one.
    const { daysToOffer: _drop, ...older } = hydrated
    void _drop
    expect(preserveHydratedClosedCompDom(rebuilt, older).daysToOffer).toBe(3)
  })

  const sale = (over: Partial<CmaAdjustedComp>): CmaAdjustedComp =>
    ({
      listingKey: 'S',
      address: '3169 Coho',
      city: 'Bend',
      closePrice: 599000,
      closeDate: '2024-10-25',
      sqft: 1701,
      adjustedPrice: 551876,
      weight: 1,
      ...over,
    }) as unknown as CmaAdjustedComp

  it('prints the same count in the row, the outcome and the pin', () => {
    const [row] = closedEntries([sale({ daysToOffer: 114, domTotal: 146 })])
    expect(row!.domDays).toBe(114)
    expect(row!.cdomDays).toBe(114)
    expect(row!.domMeasure).toBe('offer')
    expect(row!.outcome).toContain('offer in 114 days')
    expect(domCell(row!, row!.domDays)).toBe('114 days')
    const [pin] = pinFactsFor([row!])
    expect(pinRevealLine(pin!)).toContain('114 days on market')
    expect(row!.outcome).not.toContain('146')
  })

  it('names first list to close when that is the only count (never as days on market)', () => {
    const [row] = closedEntries([sale({ daysToOffer: 67, domTotal: 66, address: '2107 Carrie' })])
    expect(row!.domDays).toBe(66)
    expect(row!.domMeasure).toBe('listed-to-closed')
    expect(row!.outcome).toContain('listed to closed, 66 days')
    expect(row!.outcome).not.toContain('offer in')
    expect(domCell(row!, row!.domDays)).toBe('66 days, listed to closed')
    const [pin] = pinFactsFor([row!])
    expect(pinRevealLine(pin!)).toContain('66 days listed to closed')
    expect(pinRevealLine(pin!)).not.toContain('on market')
  })

  it('charts only the offer counts the table prints', () => {
    const html = renderDaysToOfferHtml({
      subject: { streetAddress: 'x', city: 'Bend', standardStatus: 'Closed' } as unknown as CmaSubject,
      comps: [
        sale({ address: '1 A', daysToOffer: 10, domTotal: 30 }),
        sale({ address: '2 B', daysToOffer: 20, domTotal: 40 }),
        sale({ address: '3 C', daysToOffer: 30, domTotal: 50 }),
        sale({ address: '4 D', daysToOffer: 67, domTotal: 66 }),
      ],
      market: null,
    })
    // The caption counts the bars actually drawn, and "within" is true of the
    // slowest bar sitting exactly on the figure (reader review 2026-10-08).
    expect(html).toContain('All three sales shown had an offer within 30 days.')
    expect(html).not.toContain('67 days')
    // The sale left off is named under the chart rather than skipped silently.
    expect(html).toContain(
      'Sale 4, 4 D, is not on the chart: its recorded offer date does not fit its listing and closing dates.',
    )
  })
})

// ── 2. "never got one" only when the days earn it ───────────────────────────

describe('the subject\'s days against the figures beside them', () => {
  const market = {
    geoLabel: 'Bend',
    medianDom: 26,
    offerTiming: {
      city: 'Bend',
      windowMonths: 12,
      n: 188,
      medianDays: 26,
      points: [
        { days: 7, pct: 34 },
        { days: 14, pct: 55 },
        { days: 30, pct: 72 },
      ],
    },
  } as unknown as CmaMarketContext
  const subject = (status: string, days: number) =>
    ({
      streetAddress: '20676 Wild Rose',
      city: 'Bend',
      standardStatus: status,
      listingHistoryLine: `Listed Sep 3, 2026 at $625,000, came off ${status.toLowerCase()} · ${days} days on market.`,
    }) as unknown as CmaSubject
  const comps = [4, 4, 43, 4, 15].map(
    (d, i) => ({ address: `${i + 1} Oak`, daysToOffer: d, domTotal: 90 }) as unknown as CmaAdjustedComp,
  )

  it('says the plain fact when the subject sat less than the figures it is set beside (Wild Rose)', () => {
    const html = renderDaysToOfferHtml({ subject: subject('Withdrawn', 25), comps, market })
    expect(html).toContain('All five sales shown had an offer within 43 days.')
    expect(html).toContain('median is 26.')
    expect(html).toContain('Yours was withdrawn after 25 days.')
    expect(html).not.toContain('never got one')
    expect(html).toContain('25 days, withdrawn')
    const expired = renderDaysToOfferHtml({ subject: subject('Expired', 25), comps, market })
    expect(expired).toContain('Yours expired after 25 days.')
    expect(expired).not.toContain('never got one')
  })

  it('keeps the contrast when the subject outran every figure (3177 Coho)', () => {
    const html = renderDaysToOfferHtml({ subject: subject('Expired', 302), comps, market })
    // The contrast says what the MLS status says. It does not record whether an
    // offer came in, so nothing says "never got one" (reader review 2026-10-08).
    expect(html).toContain('Yours sat 302 days and did not sell.')
    expect(html).toContain('302 days, expired')
    expect(html).not.toContain('never got one')
    expect(html).not.toContain('no offer')
    const withdrawnLong = renderDaysToOfferHtml({ subject: subject('Withdrawn', 302), comps, market })
    // A long run tested the market, withdrawn or not.
    expect(withdrawnLong).toContain('Yours sat 302 days and did not sell.')
    expect(withdrawnLong).toContain('302 days, withdrawn')
  })

  it('gates the offer-timing line the same way', () => {
    expect(renderOfferTimingHtml({ market, subject: subject('Withdrawn', 25) })).toContain(
      'Yours was withdrawn after 25 days.',
    )
    expect(renderOfferTimingHtml({ market, subject: subject('Expired', 40) })).toContain(
      'Yours sat 40 days and did not sell.',
    )
  })

  it('does not call a run under the median a sit in chapter 1 either', () => {
    const base = { ask: 640000, rangeLow: 600000, rangeHigh: 650000, city: 'Bend', marketMedianDom: 26 }
    const short = askStoryReading({ ...base, days: 25, status: 'Withdrawn' })
    expect(short).toContain('Your listing was withdrawn after 25 days.')
    expect(short).not.toContain('without an offer')
    expect(short).not.toContain('that long')
    const long = askStoryReading({ ...base, days: 120, status: 'Expired' })
    expect(long).toContain('Your home sat 120 days and did not sell.')
    expect(long).not.toContain('without an offer')
  })

  it('counts only figures that are there', () => {
    expect(subjectDaysAgainst({ days: 25, status: 'Expired', figures: [43, 26] })?.outran).toBe(false)
    expect(subjectDaysAgainst({ days: 44, status: 'Expired', figures: [43, 26] })?.outran).toBe(true)
    expect(subjectDaysAgainst({ days: 44, status: 'Expired', figures: [null] })?.outran).toBe(false)
    expect(subjectDaysAgainst({ days: 0, status: 'Expired', figures: [1] })).toBeNull()
    expect(subjectDaysAgainst({ days: 9, status: 'Canceled', figures: [10] })?.plain).toBe(
      'Yours was canceled after 9 days.',
    )
  })
})

// ── 3. wording with logic in it ─────────────────────────────────────────────

describe('wording a person would use', () => {
  it('ends the listing line in plain words', () => {
    const base = { steps: [], rangeLow: 1, rangeHigh: 2, rangeLabel: '', caption: '', offMarketDate: '2026-09-28' }
    expect(timelineEndLabel({ ...base, status: 'withdrawn', days: 25 } as never)).toBe('withdrawn after 25 days')
    expect(timelineEndLabel({ ...base, status: 'Expired', days: 1 } as never)).toBe('expired after 1 day')
    expect(timelineEndLabel({ ...base, status: 'cancelled', days: 40 } as never)).toBe('canceled after 40 days')
    expect(timelineEndLabel({ ...base, status: null, days: null } as never)).toBe('came off')
    expect(timelineEndLabel({ ...base, offMarketDate: null, status: null, days: 12 } as never)).toBe(
      'on the market 12 days',
    )
  })

  it('rounds a median of days to whole days', () => {
    const story: PlacePricingStory = {
      placeName: 'Mountain View',
      placeKind: 'neighborhood',
      windowMonths: 12,
      asOf: '2026-10-07',
      listedHomes: 266,
      didNotSell: 40,
      droppedPrice: 0,
      typicalCutShare: null,
      gaveConcessions: 0,
      typicalConcessionShare: null,
      heldAskCount: 20,
      heldAskMedianDays: 6,
      cutPriceCount: 30,
      cutPriceMedianDays: 65.5,
      sourceNote: '',
    }
    const html = placePricingStoryHtml(story, 'letter')
    expect(html).toContain('Homes that cut the price took 66 days.')
    expect(html).not.toContain('65.5')
  })

  it('names the window the monthly pace averages over', () => {
    expect(mosWindowMonths('getMetric months_of_supply mt-v1 detached MLS-city (same path as /sell)')).toBe(6)
    expect(mosWindowMonths('getMetric months_of_supply_12mo mt-v1')).toBe(12)
    expect(mosWindowMonths(null)).toBe(6)
    const html = renderInventoryBoardHtml({
      geoLabel: 'Bend',
      activeCount: 707,
      monthsOfSupply: 3.47704918032787,
      mosFormula: 'getMetric months_of_supply mt-v1 detached MLS-city (same path as /sell)',
    } as unknown as CmaMarketContext)
    // 707 / 3.477 = 203.3 a month, the six-month close pace the figure divides by.
    expect(html).toContain('707 single-family homes are for sale in Bend right now. Over the last six months, an average of 203 sold each month.')
    expect(html).not.toContain('typical month')
  })
})
