import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_PUBLIC_PACE,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'

const { pulseMock, paceMock } = vi.hoisted(() => ({
  pulseMock: vi.fn(),
  paceMock: vi.fn(),
}))

vi.mock('@/lib/data', () => ({
  getMarketPulseRowForGeo: (...args: unknown[]) => pulseMock(...args),
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

const PULSE_BEND = {
  median_list_price: 799_000,
  median_close_price_90d: 750_000,
  median_days_to_pending: 18,
  median_sale_to_list: 0.99,
  sold_count_30d: 90,
  months_of_supply: 3.54,
  active_count: 488,
  new_count_30d: 51,
  market_health_label: 'Warm',
  updated_at: '2026-08-23T10:00:00Z',
}

function leftover(overrides: Partial<PublicPaceRow> = {}): PublicPaceRow {
  return { ...EMPTY_PUBLIC_PACE, ...overrides }
}

beforeEach(() => {
  pulseMock.mockReset()
  paceMock.mockReset()
  pulseMock.mockResolvedValue(PULSE_BEND)
  paceMock.mockResolvedValue(leftover())
})

describe('getBendMarketSnapshot leftover sale-to-list', () => {
  it('maps leftover saleToOriginal 0.969 to saleToListPct ~96.9', async () => {
    paceMock.mockResolvedValue(
      leftover({
        saleToOriginal: 0.969,
        daysToContract: 28,
        closedCount: 2095,
        medianClose: 760_000,
      }),
    )

    const snap = await getBendMarketSnapshot()
    expect(paceMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'bend' })
    expect(snap?.saleToListPct).toBeCloseTo(96.9, 5)
    expect(snap?.medianDaysToPending).toBe(18)
    expect(snap?.soldCount30d).toBe(90)
    expect(snap?.medianSold90d).toBe(750_000)
    expect(snap?.newCount30d).toBe(51)
  })

  it('omits saleToListPct on leftover miss even when pulse median_sale_to_list is 0.99', async () => {
    paceMock.mockResolvedValue(leftover({ saleToOriginal: null }))

    const snap = await getBendMarketSnapshot()
    expect(snap?.saleToListPct).toBeNull()
    expect(snap?.soldCount30d).toBe(90)
    expect(snap?.medianDaysToPending).toBe(18)
  })

  it('keeps pulse soldCount30d and medianDaysToPending when leftover throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    paceMock.mockRejectedValue(new Error('market_metric miss'))

    const snap = await getBendMarketSnapshot()
    expect(snap?.saleToListPct).toBeNull()
    expect(snap?.soldCount30d).toBe(90)
    expect(snap?.medianDaysToPending).toBe(18)
    expect(snap?.medianSold90d).toBe(750_000)
    warn.mockRestore()
  })
})

describe('seller LP leftover source contract', () => {
  it('reads leftover saleToOriginal and does not fall back to pulse SLT', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/leftoverSaleToListPct\(leftover\.saleToOriginal\)/)
    expect(SRC).not.toMatch(/row\['median_sale_to_list'\]/)
    expect(SRC).not.toMatch(/saleToList \* 100/)
  })

  it('labels sale-to-list as leftover 12-month and keeps pulse DTP / 30-day sold', () => {
    expect(PAGE).toMatch(/getPublicDetachedPace/)
    expect(PAGE).toMatch(/Median close vs original list, 12 months/)
    expect(PAGE).toMatch(/publishDaysLabel\(snap\?\.medianDaysToPending\)/)
    expect(PAGE).toMatch(/snap\?\.soldCount30d/)
    expect(PAGE).not.toMatch(/daysToContract/)
  })
})
