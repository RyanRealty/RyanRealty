import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { DetachedInventory } from '@/lib/data/market-truth/getSellBendMarket'

const { inventoriesMock, paceMock } = vi.hoisted(() => ({
  inventoriesMock: vi.fn(),
  paceMock: vi.fn(),
}))

vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedInventories: (...args: unknown[]) => inventoriesMock(...args),
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

import {
  assembleGolfCommunityKpi,
  formatCurrencyToThousands,
  loadGolfCommunityKpis,
  pickGolfCommunityInventory,
  pickGolfCommunityLeftover,
} from './community-kpis'

const SRC = readFileSync(resolve('data/golf/community-kpis.ts'), 'utf8')

const EMPTY_LEFTOVER: PublicPaceRow = { ...EMPTY_PUBLIC_PACE }

const SUNRIVER_LEFTOVER: PublicPaceRow = {
  ...EMPTY_PUBLIC_PACE,
  medianClose: 885_000,
  closedCount: 117,
  daysToContract: 40,
}

const SUNRIVER_INVENTORY: DetachedInventory = {
  activeCount: 56,
  medianListPrice: 989_000,
  computedAt: '2026-08-23T00:00:00.000Z',
}

describe('community-kpis source', () => {
  it('reads leftover and detached inventory, not market_stats_cache', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/getDetachedInventories/)
    expect(SRC).toMatch(/geoType: 'neighborhood'/)
    expect(SRC).toMatch(/geoType: 'city'/)
    expect(SRC).toMatch(/leftover\.medianClose/)
    expect(SRC).toMatch(/leftover\.closedCount/)
    expect(SRC).toMatch(/medianDom: null/)
    expect(SRC).not.toMatch(/from\('market_stats_cache'\)/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/createServiceClient/)
    expect(SRC).not.toMatch(/median_sale_price/)
    expect(SRC).not.toMatch(/sold_count/)
    expect(SRC).not.toMatch(/end_of_period_inventory/)
    expect(SRC).not.toMatch(/median_dom/)
  })
})

describe('pickGolfCommunityInventory', () => {
  it('prefers neighborhood actives, then same-slug city, never invents 0', () => {
    const both = new Map<string, DetachedInventory>([
      ['neighborhood:sunriver', { activeCount: 40, medianListPrice: null, computedAt: 'n' }],
      ['city:sunriver', SUNRIVER_INVENTORY],
    ])
    expect(pickGolfCommunityInventory('sunriver', both)?.activeCount).toBe(40)
    expect(pickGolfCommunityInventory('sunriver', new Map([['city:sunriver', SUNRIVER_INVENTORY]]))?.activeCount).toBe(56)
    expect(pickGolfCommunityInventory('tetherow', new Map())).toBeNull()
  })
})

describe('pickGolfCommunityLeftover', () => {
  it('does not keep cache and does not fill neighborhood miss with empty city', () => {
    const city = SUNRIVER_LEFTOVER
    expect(pickGolfCommunityLeftover(EMPTY_LEFTOVER, city)).toEqual(city)
    expect(pickGolfCommunityLeftover(EMPTY_LEFTOVER, EMPTY_LEFTOVER).closedCount).toBeNull()
    expect(pickGolfCommunityLeftover({ ...EMPTY_PUBLIC_PACE, closedCount: 12 }, city).closedCount).toBe(12)
  })
})

describe('assembleGolfCommunityKpi', () => {
  it('overlays leftover median/sold and inventory actives when publishable', () => {
    const row = assembleGolfCommunityKpi({
      geoSlug: 'sunriver',
      leftover: SUNRIVER_LEFTOVER,
      inventory: SUNRIVER_INVENTORY,
    })
    expect(row).toEqual({
      geoSlug: 'sunriver',
      medianSalePrice: 885_000,
      soldCount12mo: 117,
      activeInventory: 56,
      medianDom: null,
      computedAt: '2026-08-23T00:00:00.000Z',
      methodologyVersion: 'mt-v1',
    })
  })

  it('omits sold and median on leftover miss — does not keep cache, does not print 0', () => {
    const row = assembleGolfCommunityKpi({
      geoSlug: 'tetherow',
      leftover: EMPTY_LEFTOVER,
      inventory: { activeCount: 14, medianListPrice: 1_850_000, computedAt: '2026-08-23T00:00:00.000Z' },
    })
    expect(row?.medianSalePrice).toBeNull()
    expect(row?.soldCount12mo).toBeNull()
    expect(row?.activeInventory).toBe(14)
    expect(row?.medianDom).toBeNull()
    expect(row?.soldCount12mo).not.toBe(0)
  })

  it('omits inventory on miss and does not map leftover days-to-contract onto medianDom', () => {
    const row = assembleGolfCommunityKpi({
      geoSlug: 'tetherow',
      leftover: SUNRIVER_LEFTOVER,
      inventory: null,
    })
    expect(row?.activeInventory).toBeNull()
    expect(row?.medianSalePrice).toBe(885_000)
    expect(row?.soldCount12mo).toBe(117)
    expect(row?.medianDom).toBeNull()
    expect(row?.medianDom).not.toBe(40)
  })

  it('returns null when leftover and inventory both miss', () => {
    expect(
      assembleGolfCommunityKpi({
        geoSlug: 'crosswater',
        leftover: EMPTY_LEFTOVER,
        inventory: null,
      }),
    ).toBeNull()
  })
})

describe('loadGolfCommunityKpis', () => {
  beforeEach(() => {
    inventoriesMock.mockReset()
    paceMock.mockReset()
    paceMock.mockResolvedValue({ ...EMPTY_PUBLIC_PACE })
    inventoriesMock.mockResolvedValue(new Map())
  })

  it('batches neighborhood + city inventories and reads leftover per slug', async () => {
    inventoriesMock.mockResolvedValue(new Map([['city:sunriver', SUNRIVER_INVENTORY]]))
    paceMock.mockImplementation(async (opts: { geoType: string; geoSlug: string }) => {
      if (opts.geoType === 'city' && opts.geoSlug === 'sunriver') return SUNRIVER_LEFTOVER
      return { ...EMPTY_PUBLIC_PACE }
    })

    const kpis = await loadGolfCommunityKpis()
    expect(inventoriesMock).toHaveBeenCalledTimes(1)
    const keys = inventoriesMock.mock.calls[0]?.[0] as Array<{ geoType: string; geoSlug: string }>
    expect(keys.filter((k) => k.geoType === 'neighborhood')).toHaveLength(12)
    expect(keys.filter((k) => k.geoType === 'city')).toHaveLength(12)
    expect(keys).toEqual(
      expect.arrayContaining([
        { geoType: 'neighborhood', geoSlug: 'sunriver' },
        { geoType: 'city', geoSlug: 'sunriver' },
        { geoType: 'neighborhood', geoSlug: 'tetherow' },
      ]),
    )
    expect(paceMock).toHaveBeenCalledWith({ geoType: 'neighborhood', geoSlug: 'sunriver' })
    expect(paceMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'sunriver' })

    expect(kpis.sunriver?.activeInventory).toBe(56)
    expect(kpis.sunriver?.soldCount12mo).toBe(117)
    expect(kpis.sunriver?.medianSalePrice).toBe(885_000)
    expect(kpis.sunriver?.medianDom).toBeNull()
    expect(kpis.tetherow).toBeNull()
  })

  it('inventory miss plus leftover miss omits the card KPI', async () => {
    const kpis = await loadGolfCommunityKpis()
    expect(kpis.sunriver).toBeNull()
    expect(kpis.tetherow).toBeNull()
  })
})

describe('formatCurrencyToThousands', () => {
  it('rounds to thousands and omits a null', () => {
    expect(formatCurrencyToThousands(884_750)).toBe('$885,000')
    expect(formatCurrencyToThousands(null)).toBeNull()
  })
})
