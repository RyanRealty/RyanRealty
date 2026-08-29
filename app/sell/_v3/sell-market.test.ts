import { describe, expect, it } from 'vitest'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import {
  sellBendChart,
  sellBendFigures,
  sellBendHeadline,
  sellBendHud,
  sellBendSentence,
  sellBendTrace,
} from './sell-market'

const BEND: SellBendMarket = {
  activeCount: 775,
  monthsOfSupply: 4.45402298850575,
  mosLabel: '4.5',
  verdictKind: 'balanced',
  verdictLabel: 'balanced market',
  medianListPrice: 915000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-22',
}

describe('sellBendHud', () => {
  it('maps the locked Bend row onto leftover HUD headlines', () => {
    const hud = sellBendHud(BEND, EMPTY_PUBLIC_PACE)
    expect(hud.active).toBe(775)
    expect(hud.medianList).toBe(915000)
    expect(hud.monthsSupply).toBe(4.45402298850575)
  })
})

describe('sellBendFigures', () => {
  it('keeps five live figures and drops extra leftover cells', () => {
    const hud = sellBendHud(BEND, {
      ...EMPTY_PUBLIC_PACE,
      pendingCount: 200,
      closedCount: 1100,
      closedCount30d: 40,
      saleToOriginal: 0.972,
      daysToPending90d: 41,
    })
    expect(sellBendFigures(hud).map((figure) => String(figure.label))).toEqual([
      'median list price',
      'detached homes for sale',
      'sale to original list · 12 months',
      'median to pending · 90 days',
      'months of supply',
    ])
  })
})

describe('sellBendChart', () => {
  it('names the Bend monthly close series without leftover copy', () => {
    const chart = sellBendChart([
      {
        year: 2024,
        points: [
          { m: 1, value: 700_000, soldCount: 40 },
          { m: 2, value: 710_000, soldCount: 38 },
        ],
      },
      {
        year: 2025,
        points: [
          { m: 1, value: 720_000, soldCount: 36 },
          { m: 2, value: 730_000, soldCount: 34 },
        ],
      },
    ])
    expect(chart?.caption).toBe('Median close by month, single-family, Bend')
    expect(String(chart?.caption ?? '')).not.toMatch(/leftover|Market Truth/i)
  })
})

describe('sellBendSentence', () => {
  it('uses the live Bend sentence', () => {
    expect(sellBendSentence('4.5', 'balanced market')).toBe(
      'Bend has 4.5 months of supply, which is a balanced market.',
    )
    expect(sellBendSentence(null, 'balanced market')).toBeNull()
  })
})

describe('sellBendHeadline', () => {
  it('is How tight Bend is, not a leftover buyer-or-seller H2', () => {
    expect(sellBendHeadline(true)).toBe('How tight Bend is')
    expect(sellBendHeadline(false)).toBe('The Bend market')
    expect(sellBendHeadline(true)).not.toMatch(/buyer|seller/i)
  })
})

describe('sellBendTrace', () => {
  it('names regional MLS / Oregon Data Share and withholds leftover labels', () => {
    const trace = sellBendTrace(true)
    expect(trace).toMatch(/regional MLS through Oregon Data Share/)
    expect(trace).not.toMatch(/leftover|sample-gated|Market Truth leftover|Market Truth cells/i)
  })
})
