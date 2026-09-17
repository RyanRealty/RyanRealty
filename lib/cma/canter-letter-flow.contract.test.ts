/**
 * Canter FlexMLS letter FLOW locks (Cos 2026-09-17 rebuild brief).
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/cma/canter-letter-flow.parity.json
 * Do not twin Cos picker tips. Immersive letter only.
 *
 * Matt 2026-09-17: actives + DOM in the letter (high DOM + overpriced ask =
 * overpricing signal with expireds). Actives never set Recommended (closed-
 * only). No story-adj from that signal. Never overt "you overpriced."
 * Every comparable row (closed/pending/active/expired) must show DOM +
 * listing/price history — Tip Ready refuse if missing.
 * Low/High from closed-comp band (valueLow/valueHigh); Recommended must stay
 * inside that band — Tip Ready refuse if Rec is outside Low/High.
 * Pending high-DOM 60+ = letter signal only; never sets Recommended (actives
 * may still nudge in-band). Canter first, then apply ALL locks to every CMA.
 */
import { describe, expect, it } from 'vitest'
import {
  immersiveHeroNumberHtml,
  letterCoverPayoffHtml,
} from '@/lib/cma/cover-value'
import { pinLegendHtml } from '@/lib/cma/comp-pin-map'
import {
  statusPriceBoardHtml,
  statusPriceSummaries,
} from '@/lib/cma/status-price-summary'
import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { didNotSellBodyHtml } from '@/lib/cma/did-not-sell'
import { storyAdjustment } from '@/lib/pricing/classes'
import { recommendedInsideClosedBand } from '@/lib/pricing/recommended-in-band'
import {
  isHighDomPendingLetterSignal,
  nudgeRecommendedDownForHighDomActives,
} from '@/lib/pricing/active-dom-nudge'
import {
  COMPARABLE_DOM_ROW_LABEL,
  COMPARABLE_PRICE_HISTORY_ROW_LABEL,
  comparableEntryHasDomAndPriceHistory,
  comparableSetHasDomAndPriceHistory,
  matrixHtmlHasDomAndPriceHistory,
} from '@/lib/cma/comparable-dom-history'
import { renderCompMatrixHtml, renderMatrixHtml } from '@/lib/cma/comp-matrix'
import { activeEntries, closedEntries, unsoldEntries } from '@/lib/cma/matrix-entry'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { CmaBandRival } from '@/lib/cma/band-rivals'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

function entry(over: Partial<MatrixEntry> & Pick<MatrixEntry, 'family' | 'key'>): MatrixEntry {
  return {
    address: over.address ?? '12 Pine',
    href: null,
    photoUrl: null,
    outcome: '',
    yearBuilt: 1999,
    remodelNote: null,
    remarksRead: false,
    sqft: over.sqft ?? 1600,
    lotAcres: 0.2,
    rooms: null,
    beds: 3,
    baths: 2,
    domDays: 20,
    priceChanges: 0,
    priceChangesExact: false,
    path: null,
    firstAsk: over.firstAsk ?? null,
    lastAsk: over.lastAsk ?? null,
    closePrice: over.closePrice ?? null,
    listPrice: over.listPrice ?? null,
    concessionsAmount: null,
    endLabel: '',
    latitude: null,
    longitude: null,
    sort: '',
    ...over,
  }
}

const subject = {
  streetAddress: '1130 E Canter',
  city: 'Sisters',
  subdivision: 'SaddleStone',
} as CmaSubject

const pricing = {
  method1Low: 649000,
  method1Mid: 659000,
  method1High: 675000,
  method2: 655000,
  method3: 662000,
  conservative: 649000,
  recommended: 659000,
  highEnd: 675000,
  valueLow: 649000,
  valueHigh: 675000,
  predictedClose: 655000,
  confidence: 'High',
  confidenceReason: 'Exclusive pocket.',
  notes: [],
} as unknown as CmaPricing

const coverArgs = {
  subject,
  comps: [{ address: '1025 E Horse Back', closePrice: 675000, adjustedPrice: 675000, weight: 1 }] as CmaAdjustedComp[],
  market: null,
  pricing,
  tiersUsed: ['pocket-6mo', 'pocket-12mo'],
}

describe('1130 E Canter FlexMLS letter FLOW', () => {
  it('contract: split-closed-pending-active-summary-tables', () => {
    const closed = [
      entry({ key: '1', family: 'closed', closePrice: 675000 }),
      entry({ key: '2', family: 'closed', closePrice: 649000 }),
      entry({ key: '3', family: 'closed', closePrice: 659000 }),
    ]
    const active = [
      entry({ key: 'A', family: 'active', status: 'active', listPrice: 670000 }),
      entry({ key: 'B', family: 'active', status: 'pending', listPrice: 660000 }),
    ]
    const rows = statusPriceSummaries({ closed, active })
    expect(rows.map((r) => r.key)).toEqual(['closed', 'pending', 'active'])
    const html = statusPriceBoardHtml(rows)
    expect(html).toContain('Closed · Pending · Active')
    expect(html).toContain('Low')
    expect(html).toContain('Avg')
    expect(html).toContain('Median')
    expect(html).toContain('High')
    expect(html).toContain('data-status="pending"')
    expect(html).toContain('data-status="active"')
    expect(html).toContain('data-status="closed"')
  })

  it('contract: recommend-low-high-recommended-once', () => {
    const immersive = immersiveHeroNumberHtml(coverArgs)
    const cover = letterCoverPayoffHtml(pricing)
    for (const html of [immersive, cover]) {
      expect(html).toContain('hero-trio')
      expect(html).toContain('>Low<')
      expect(html).toContain('>High<')
      expect(html).toContain('>Recommended<')
      expect(html).toContain('$659,000')
      expect((html.match(/>Recommended</g) ?? []).length).toBe(1)
    }
  })

  it('contract: recommended-inside-closed-comp-band', () => {
    expect(
      recommendedInsideClosedBand({
        recommended: pricing.recommended,
        valueLow: pricing.valueLow,
        valueHigh: pricing.valueHigh,
      }),
    ).toBe(true)

    // Hero Low/High must print the closed-comp band, not list tiers that
    // drifted outside it (Canter live: value 675–705 vs highEnd 716).
    const drifted = {
      ...pricing,
      conservative: 686_000,
      highEnd: 716_000,
      valueLow: 675_000,
      valueHigh: 705_000,
      recommended: 701_000,
    } as typeof pricing
    const html = letterCoverPayoffHtml(drifted)
    expect(html).toContain('$675,000')
    expect(html).toContain('$705,000')
    expect(html).toContain('$701,000')
    expect(html).not.toContain('$716,000')
    expect(html).not.toContain('$686,000')

    expect(
      recommendedInsideClosedBand({
        recommended: 710_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }),
    ).toBe(false)
  })

  it('contract: pin-map-subject-comps-status-legend-class', () => {
    const legend = pinLegendHtml([
      {
        key: 'subj',
        family: 'closed',
        address: '1130 E Canter',
        outcome: null,
        latitude: 44.29,
        longitude: -121.55,
      },
      {
        key: 'c1',
        family: 'closed',
        address: '1025 E Horse Back',
        outcome: 'Sold $675,000',
        latitude: 44.291,
        longitude: -121.549,
      },
      {
        key: 'a1',
        family: 'active',
        address: '994 E Horse Back',
        outcome: 'Active $670,000',
        latitude: 44.292,
        longitude: -121.548,
      },
    ])
    expect(legend).toContain('pin-legend')
    expect(legend).toContain('Your home')
    expect(legend).toMatch(/is-closed/)
    expect(legend).toMatch(/is-active/)
  })

  it('contract: active-peers-dom-overpricing-signal-closed-only-recommend', () => {
    // Closed-only Recommended — active list prices must not become the hero $.
    const cover = letterCoverPayoffHtml(pricing)
    const immersive = immersiveHeroNumberHtml(coverArgs)
    for (const html of [cover, immersive]) {
      expect(html).toContain('$659,000')
      expect(html).not.toContain('$729,000')
    }

    // Competition: actives carry DOM; a cut + high DOM is the signal.
    const rivalsHtml = renderBandRivalsHtml({
      city: 'Sisters',
      lo: 649_000,
      hi: 675_000,
      activeCount: 1,
      pendingCount: 0,
      rivals: [
        {
          listingKey: 'A-1005',
          address: '1005 Horse Back',
          listPrice: 679_000,
          status: 'Active',
          daysOnMarket: 201,
          photoUrl: null,
          latitude: 44.293,
          longitude: -121.536,
          beds: 3,
          baths: 2,
          sqft: 1807,
          yearBuilt: 2019,
          lotAcres: 0.2,
          originalListPrice: 729_000,
          onMarketDate: '2026-02-27',
          listingHistoryLine: 'Listed Feb 27, 2026 at $729,000, now $679,000 · 201 days on market',
        },
      ],
      subject: {
        beds: 3,
        baths: 2,
        sqft: 1883,
        yearBuilt: 2025,
        lotAcres: 0.2,
        recommendedList: pricing.recommended,
        latitude: 44.292,
        longitude: -121.534,
        listingHistoryLine: null,
        daysOnMarket: null,
      },
    })
    expect(rivalsHtml).toContain('1005 Horse Back')
    expect(rivalsHtml).toMatch(/201 days on market/)
    expect(rivalsHtml.toLowerCase()).not.toContain('overprice')

    // Expired peers illustrate the same risk without mannered blame.
    const unsold = didNotSellBodyHtml({
      subject,
      comps: coverArgs.comps,
      market: null,
      peers: [
        {
          listingKey: 'E-1078',
          address: '1078 Black Butte',
          listPrice: 799_000,
          originalListPrice: 799_000,
          status: 'Expired',
          daysOnMarket: 120,
          onMarketDate: '2025-11-01',
          photoUrl: null,
          listingHistoryLine: 'Asked $799,000 · came off expired · 120 days on market',
          beds: 3,
          baths: 2,
          sqft: 1991,
          yearBuilt: 2018,
          lotAcres: 0.22,
          propertySubType: 'Single Family Residence',
          latitude: 44.294,
          longitude: -121.535,
        },
      ],
      finalCycle: null,
    })
    expect(unsold).toContain('1078 Black Butte')
    expect(unsold.toLowerCase()).not.toContain('overprice')

    // No story-adj from the active/expired signal.
    expect(storyAdjustment('one', 'one', 679_000)).toBe(0)
  })


  it('contract: pending-high-dom-letter-signal-never-sets-recommended', () => {
    const pendingRival = {
      listingKey: 'P-1100',
      address: '1100 Horse Back',
      listPrice: 729_000,
      status: 'Pending' as const,
      daysOnMarket: 95,
      photoUrl: null,
      latitude: 44.294,
      longitude: -121.535,
      beds: 3,
      baths: 2,
      sqft: 1900,
      yearBuilt: 2018,
      lotAcres: 0.2,
      originalListPrice: 749_000,
      onMarketDate: '2026-06-01',
      listingHistoryLine: 'Listed Jun 1, 2026 at $749,000, now $729,000 under contract · 95 days on market',
    }
    expect(
      isHighDomPendingLetterSignal({
        status: pendingRival.status,
        listPrice: pendingRival.listPrice,
        daysOnMarket: pendingRival.daysOnMarket,
      }),
    ).toBe(true)

    const rivalsHtml = renderBandRivalsHtml({
      city: 'Sisters',
      lo: 649_000,
      hi: 675_000,
      activeCount: 0,
      pendingCount: 1,
      rivals: [pendingRival],
      subject: {
        beds: 3,
        baths: 2,
        sqft: 1883,
        yearBuilt: 2025,
        lotAcres: 0.2,
        recommendedList: pricing.recommended,
        latitude: 44.292,
        longitude: -121.534,
        listingHistoryLine: null,
        daysOnMarket: null,
      },
    })
    expect(rivalsHtml).toContain('1100 Horse Back')
    expect(rivalsHtml).toMatch(/95 days on market/)
    // Pending ask must not become Recommended.
    expect(letterCoverPayoffHtml(pricing)).toContain('$659,000')
    expect(letterCoverPayoffHtml(pricing)).not.toContain('$729,000')

    const nudge = nudgeRecommendedDownForHighDomActives({
      recommended: pricing.recommended,
      bandLow: pricing.valueLow,
      bandHigh: pricing.valueHigh,
      actives: [
        {
          status: pendingRival.status,
          listPrice: pendingRival.listPrice,
          daysOnMarket: pendingRival.daysOnMarket,
        },
      ],
    })
    expect(nudge.nudged).toBe(false)
    expect(nudge.recommended).toBe(pricing.recommended)
  })

  it('contract: every-comparable-row-dom-and-price-history', () => {
    // Tip Ready refuse labels — must match SHARED_ROWS in comp-matrix.
    expect(COMPARABLE_DOM_ROW_LABEL).toBe('Days on market')
    expect(COMPARABLE_PRICE_HISTORY_ROW_LABEL).toContain('First ask')

    const closedComps = [
      {
        listingKey: 'C1',
        mlsNumber: '1',
        address: '1025 Horse Back',
        city: 'Sisters',
        closePrice: 675000,
        listPrice: 675000,
        originalListPrice: 689000,
        closeDate: '2026-04-21',
        onMarketDate: '2026-02-04',
        domTotal: 76,
        daysToOffer: 60,
        sqft: 1842,
        beds: 3,
        baths: 2,
        yearBuilt: 2019,
        lotAcres: 0.2,
        adjustedPrice: 675000,
        timeAdjustment: 0,
        sizeAdjustment: 0,
        weight: 1,
        listingHistoryLine: 'Listed Feb 4, 2026, sold Apr 21, 2026 at $675,000 · 76 days on market',
      },
      {
        listingKey: 'C2',
        mlsNumber: '2',
        address: '945 Horse Back',
        city: 'Sisters',
        closePrice: 690000,
        listPrice: 689000,
        originalListPrice: 739000,
        closeDate: '2025-11-24',
        onMarketDate: '2025-08-08',
        domTotal: 108,
        daysToOffer: 90,
        sqft: 1758,
        beds: 3,
        baths: 2,
        yearBuilt: 2018,
        lotAcres: 0.2,
        adjustedPrice: 690000,
        timeAdjustment: 0,
        sizeAdjustment: 0,
        weight: 1,
        listingHistoryLine: 'Listed Aug 8, 2025 at $739,000, cut to $689,000, sold Nov 24, 2025 at $690,000 · 108 days on market',
      },
      {
        listingKey: 'C3',
        mlsNumber: '3',
        address: '995 Horse Back',
        city: 'Sisters',
        closePrice: 705000,
        listPrice: 705000,
        originalListPrice: 705000,
        closeDate: '2025-06-12',
        onMarketDate: '2025-04-01',
        domTotal: 72,
        daysToOffer: 50,
        sqft: 1883,
        beds: 3,
        baths: 2,
        yearBuilt: 2020,
        lotAcres: 0.2,
        adjustedPrice: 705000,
        timeAdjustment: 0,
        sizeAdjustment: 0,
        weight: 1,
        listingHistoryLine: 'Sold Jun 12, 2025 at $705,000 · 72 days on market',
      },
    ] as CmaAdjustedComp[]

    const closedHtml = renderCompMatrixHtml(subject, closedComps)
    expect(matrixHtmlHasDomAndPriceHistory(closedHtml)).toBe(true)
    const closedPeers = closedEntries(closedComps)
    expect(comparableSetHasDomAndPriceHistory([{ family: 'subject', domDays: 0, firstAsk: null, lastAsk: null, listPrice: null, closePrice: null, outcome: '', endLabel: null }, ...closedPeers] as never)).toBe(true)
    expect(closedPeers.every(comparableEntryHasDomAndPriceHistory)).toBe(true)

    const expiredPeers: CmaExpiredPeer[] = [
      {
        listingKey: 'E1',
        address: '1078 Black Butte',
        listPrice: 799000,
        originalListPrice: 799000,
        status: 'Expired',
        daysOnMarket: 120,
        onMarketDate: '2025-11-01',
        photoUrl: null,
        listingHistoryLine: 'Asked $799,000 · came off expired · 120 days on market',
        beds: 3,
        baths: 2,
        sqft: 1991,
        yearBuilt: 2018,
        lotAcres: 0.22,
        propertySubType: 'Single Family Residence',
        latitude: 44.294,
        longitude: -121.535,
      },
    ]
    const unsold = [
      entry({ key: 'subject', family: 'subject', firstAsk: 700000, lastAsk: 700000, listPrice: 700000, domDays: 10, outcome: 'Your home' }),
      ...unsoldEntries(expiredPeers, null, 'Sisters'),
    ]
    expect(comparableSetHasDomAndPriceHistory(unsold)).toBe(true)
    const unsoldHtml = renderMatrixHtml({
      id: 'did-not-sell',
      family: 'unsold',
      heading: 'The listings near you that did not sell.',
      entries: unsold,
    })
    expect(matrixHtmlHasDomAndPriceHistory(unsoldHtml)).toBe(true)

    const rivals: CmaBandRival[] = [
      {
        listingKey: 'A1',
        address: '1005 Horse Back',
        listPrice: 679000,
        status: 'Active',
        daysOnMarket: 201,
        photoUrl: null,
        latitude: 44.293,
        longitude: -121.536,
        beds: 3,
        baths: 2,
        sqft: 1807,
        yearBuilt: 2019,
        lotAcres: 0.2,
        originalListPrice: 729000,
        onMarketDate: '2026-02-27',
        listingHistoryLine: 'Listed Feb 27, 2026 at $729,000, now $679,000 · 201 days on market',
      },
    ]
    const actives = [
      entry({ key: 'subject', family: 'subject', firstAsk: 700000, lastAsk: 700000, listPrice: 700000, domDays: 10, outcome: 'Your home' }),
      ...activeEntries(rivals, null, 'Sisters'),
    ]
    expect(comparableSetHasDomAndPriceHistory(actives)).toBe(true)
    const activeHtml = renderMatrixHtml({
      id: 'competition',
      family: 'active',
      heading: 'Who you would compete with',
      entries: actives,
    })
    expect(matrixHtmlHasDomAndPriceHistory(activeHtml)).toBe(true)

    // Tip Ready refuse: missing DOM fails the set.
    expect(
      comparableEntryHasDomAndPriceHistory({
        family: 'closed',
        domDays: null,
        firstAsk: 675000,
        lastAsk: 675000,
        listPrice: 675000,
        closePrice: 675000,
        outcome: 'Sold',
        endLabel: 'sold',
      }),
    ).toBe(false)
  })

})
