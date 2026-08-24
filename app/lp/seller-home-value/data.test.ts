import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_PUBLIC_PACE,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'

const { overlayMock, paceMock } = vi.hoisted(() => ({
  overlayMock: vi.fn(),
  paceMock: vi.fn(),
}))

vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedOverlays: (...args: unknown[]) => overlayMock(...args),
}))

vi.mock('@/lib/data/market-truth/public-pace', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/public-pace')>(
    '@/lib/data/market-truth/public-pace',
  )
  return {
    ...actual,
    getPublicDetachedPace: (...args: unknown[]) => paceMock(...args),
  }
})

import { getBendMarketSnapshot } from './data'

const SRC = readFileSync(resolve('app/lp/seller-home-value/data.ts'), 'utf8')
const PAGE = readFileSync(resolve('app/lp/seller-home-value/page.tsx'), 'utf8')

const MT_BEND: SellBendMarket = {
  activeCount: 771,
  monthsOfSupply: 4.46,
  mosLabel: '4.5',
  verdictKind: 'balanced',
  verdictLabel: 'balanced market',
  medianListPrice: 925_000,
  computedAt: '2026-08-23T12:00:00Z',
  completeThrough: '2026-08-22',
}

function leftover(overrides: Partial<PublicPaceRow> = {}): PublicPaceRow {
  return { ...EMPTY_PUBLIC_PACE, ...overrides }
}

beforeEach(() => {
  overlayMock.mockReset()
  paceMock.mockReset()
  overlayMock.mockResolvedValue(
    new Map([
      [
        'city:bend',
        {
          headlines: MT_BEND,
          inventory: {
            activeCount: MT_BEND.activeCount,
            medianListPrice: MT_BEND.medianListPrice,
            computedAt: MT_BEND.computedAt,
          },
        },
      ],
    ]),
  )
  paceMock.mockResolvedValue(leftover())
})

describe('getBendMarketSnapshot leftover HUD', () => {
  it('prints leftover 30-day sold, 90-day DTP, and sale-to-list', async () => {
    paceMock.mockResolvedValue(
      leftover({
        saleToOriginal: 0.969,
        closedCount30d: 203,
        daysToPending90d: 19,
        closedCount: 2095,
        medianClose: 760_000,
      }),
    )

    const snap = await getBendMarketSnapshot()
    expect(paceMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'bend' })
    expect(overlayMock).toHaveBeenCalled()
    expect(snap?.saleToListPct).toBeCloseTo(96.9, 5)
    expect(snap?.medianDaysToPending).toBe(19)
    expect(snap?.soldCount30d).toBe(203)
    expect(snap?.activeCount).toBe(771)
    expect(snap?.medianListPrice).toBe(925_000)
    expect(snap?.medianSold90d).toBeNull()
    expect(snap?.newCount30d).toBeNull()
  })

  it('omits HUD-family fields on leftover miss rather than pulse fill', async () => {
    overlayMock.mockResolvedValue(new Map())
    paceMock.mockResolvedValue(leftover({ saleToOriginal: null }))

    const snap = await getBendMarketSnapshot()
    expect(snap?.saleToListPct).toBeNull()
    expect(snap?.soldCount30d).toBeNull()
    expect(snap?.medianDaysToPending).toBeNull()
    expect(snap?.medianSold90d).toBeNull()
    expect(snap?.newCount30d).toBeNull()
  })

  it('omits on leftover throw rather than pulse fill', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    paceMock.mockRejectedValue(new Error('market_metric miss'))

    const snap = await getBendMarketSnapshot()
    expect(snap?.saleToListPct).toBeNull()
    expect(snap?.soldCount30d).toBeNull()
    expect(snap?.medianDaysToPending).toBeNull()
    expect(snap?.medianSold90d).toBeNull()
    warn.mockRestore()
  })
})

describe('seller LP leftover source contract', () => {
  it('reads leftover HUD, not pulse rows', () => {
    expect(SRC).toMatch(/getDetachedOverlays/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).not.toMatch(/getMarketPulseRowForGeo/)
  })

  it('omits the 90-day median sale tile and labels leftover 90-day DTP', () => {
    expect(PAGE).toMatch(/last 90 days/)
    expect(PAGE).toMatch(/publishDaysLabel\(snap\.medianDaysToPending\)/)
    expect(PAGE).toMatch(/snap\?\.soldCount30d/)
    expect(PAGE).not.toMatch(/Closed in the last 90 days/)
    expect(PAGE).not.toMatch(/daysToContract/)
  })
})
