/**
 * Pure leftover HUD + pace snapshot for /buy/leverage. Oct 13 2026 published
 * cells are the fixture so same-day pages stay aligned.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { DetachedOverlay, SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import {
  asOfFromIso,
  buildLeverageSnapshot,
  daysNumber,
  mosLabel,
  shareLabel,
  WEEK_DROP_MAX_PCT,
  weekDropPctsForMedian,
} from './leverage-data'

const AS_OF = '2026-10-13T19:00:00.000Z'

function headlines(mos: number, active: number): SellBendMarket {
  return {
    activeCount: active,
    monthsOfSupply: mos,
    mosLabel: mosLabel(mos) ?? String(mos),
    verdictKind: mos <= 4 ? 'sellers' : mos >= 6 ? 'buyers' : 'balanced',
    verdictLabel: mos <= 4 ? "Seller's market" : mos >= 6 ? "Buyer's market" : 'Balanced market',
    medianListPrice: 500000,
    computedAt: AS_OF,
    completeThrough: '2026-10-12',
  }
}

function overlay(mos: number, active: number): DetachedOverlay {
  return {
    headlines: headlines(mos, active),
    inventory: { activeCount: active, medianListPrice: 500000, computedAt: AS_OF },
    supplyFloor: null,
  }
}

function pace(over: Partial<PublicPaceRow>): PublicPaceRow {
  return { ...EMPTY_PUBLIC_PACE, ...over }
}

describe('leverage formatters', () => {
  it('prints leftover HUD shares the way /housing-market/bend does', () => {
    expect(shareLabel(0.454)).toBe('45.4%')
    expect(shareLabel(0.056)).toBe('5.6%')
    expect(shareLabel(0.971)).toBe('97.1%')
    expect(shareLabel(0.992)).toBe('99.2%')
    expect(shareLabel(null)).toBeNull()
    expect(mosLabel(3.5)).toBe('3.5')
    expect(mosLabel(4)).toBe('4.0')
    expect(daysNumber(33.4)).toBe(33)
    expect(asOfFromIso(AS_OF)).toBe('Oct 13, 2026')
    expect(asOfFromIso('not-a-date')).toBeNull()
  })
})

describe('buildLeverageSnapshot', () => {
  it('binds Bend, the region, and the six towns from leftover HUD + pace', () => {
    const overlays = new Map<string, DetachedOverlay>([
      ['city:bend', overlay(3.5, 714)],
      ['city:redmond', overlay(4.0, 200)],
      ['city:sisters', overlay(6.2, 80)],
      ['city:sunriver', overlay(5.1, 90)],
      ['city:prineville', overlay(7.5, 70)],
      [
        'city:la-pine',
        {
          headlines: null,
          inventory: { activeCount: 40, medianListPrice: 415000, computedAt: AS_OF },
          supplyFloor: { closedSixMonths: 20, minN: 30, completeThrough: '2026-10-12', computedAt: AS_OF },
        },
      ],
      ['region:central-oregon', overlay(4.7, 1771)],
    ])
    const paces = new Map<string, PublicPaceRow>([
      [
        'city:bend',
        pace({
          priceCutShare: 0.454,
          medianPriceCut: 0.056,
          saleToOriginal: 0.971,
          saleToFinal: 0.992,
          daysToPending90d: 33,
          daysToContract: 28,
          daysToClose: 64,
          medianAgeActive: 68,
        }),
      ],
      ['city:redmond', pace({ priceCutShare: 0.447, daysToPending90d: 33 })],
      ['city:sisters', pace({ priceCutShare: 0.362, daysToPending90d: 18 })],
      ['city:sunriver', pace({ priceCutShare: 0.492, daysToPending90d: 31 })],
      ['city:prineville', pace({ priceCutShare: 0.49, daysToPending90d: 69 })],
      ['city:la-pine', pace({ priceCutShare: 0.562, daysToPending90d: 53 })],
      ['region:central-oregon', pace({ priceCutShare: 0.459, daysToPending90d: 36 })],
    ])

    const snap = buildLeverageSnapshot({
      overlays,
      paces,
      weekDrops: {
        drops: [{ lastDropPct: 3.1 }, { lastDropPct: 3.3 }, { lastDropPct: 3.5 }],
        total: 42,
        fetchedAt: AS_OF,
        degraded: false,
      },
    })

    expect(snap.bend.monthsSupplyLabel).toBe('3.5')
    expect(snap.bend.priceCutShareLabel).toBe('45.4%')
    expect(snap.bend.medianPriceCutLabel).toBe('5.6%')
    expect(snap.bend.saleToFirstAskLabel).toBe('97.1%')
    expect(snap.bend.saleToFinalListLabel).toBe('99.2%')
    expect(snap.bend.daysToOffer90).toBe(33)
    expect(snap.bend.daysToOffer12mo).toBe(28)
    expect(snap.bend.asOfLabel).toBe('Oct 13, 2026')
    expect(snap.region.monthsSupplyLabel).toBe('4.7')
    expect(snap.region.priceCutShareLabel).toBe('45.9%')
    expect(snap.weekDrops?.count).toBe(42)
    expect(snap.weekDrops?.medianDropLabel).toBe('3.3%')
    expect(snap.areas.find((a) => a.slug === 'redmond')?.note).toMatch(/Little leverage/)
    expect(snap.areas.find((a) => a.slug === 'sisters')?.note).toMatch(/Mixed/)
    expect(snap.areas.find((a) => a.slug === 'la-pine')?.monthsSupplyLabel).toBeNull()
    expect(snap.areas.find((a) => a.slug === 'la-pine')?.note).toBe('Cuts and pace give buyers room')
    expect(JSON.stringify(snap)).not.toContain('68.5')
    expect(JSON.stringify(snap)).not.toContain('2.97')
    expect(JSON.stringify(snap)).not.toMatch(/\b471\b/)
  })

  it('excludes asking-price drops over 50% from the week median', () => {
    // $16.49M listed as $1.649M is a 90% "drop": a typo correction, not a cut.
    const drops = [{ lastDropPct: 2.1 }, { lastDropPct: 3.3 }, { lastDropPct: 90 }]
    expect(weekDropPctsForMedian(drops, WEEK_DROP_MAX_PCT)).toEqual([2.1, 3.3, null])
    const snap = buildLeverageSnapshot({
      overlays: new Map(),
      paces: new Map(),
      weekDrops: { drops, total: 42, fetchedAt: AS_OF, degraded: false },
    })
    expect(snap.weekDrops?.count).toBe(42)
    expect(snap.weekDrops?.medianDropLabel).toBe('2.7%')
    const unfiltered = buildLeverageSnapshot({
      overlays: new Map(),
      paces: new Map(),
      weekDrops: { drops, total: 42, fetchedAt: AS_OF, degraded: false },
      maxDropPct: 100,
    })
    expect(unfiltered.weekDrops?.medianDropLabel).toBe('3.3%')
  })

  it('does not copy Bend pace into a town or region with no pace row', () => {
    const snap = buildLeverageSnapshot({
      overlays: new Map([
        ['city:bend', overlay(3.5, 714)],
        ['city:redmond', overlay(4.0, 200)],
      ]),
      paces: new Map([
        ['city:bend', pace({ priceCutShare: 0.454, daysToPending90d: 33 })],
      ]),
      weekDrops: null,
    })
    expect(snap.bend.priceCutShareLabel).toBe('45.4%')
    expect(snap.areas.find((a) => a.slug === 'redmond')?.priceCutShareLabel).toBeNull()
    expect(snap.region.priceCutShareLabel).toBeNull()
  })

  it('hides this week when the price-drop read is degraded', () => {
    const snap = buildLeverageSnapshot({
      overlays: new Map(),
      paces: new Map(),
      weekDrops: { drops: [], total: 0, fetchedAt: AS_OF, degraded: true },
    })
    expect(snap.weekDrops?.degraded).toBe(true)
    expect(snap.weekDrops?.count).toBe(0)
    expect(snap.bend.priceCutShareLabel).toBeNull()
  })
})
