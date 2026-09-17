/**
 * Canter FlexMLS letter FLOW locks (Cos 2026-09-17 rebuild brief).
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/cma/canter-letter-flow.parity.json
 * Do not twin Cos picker tips. Immersive letter only.
 *
 * Matt 2026-09-17: actives + DOM in the letter (high DOM + overpriced ask =
 * overpricing signal with expireds). Actives never set Recommended (closed-
 * only). No story-adj from that signal. Never overt "you overpriced."
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

})
