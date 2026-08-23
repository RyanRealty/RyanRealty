/**
 * Admin city report builders: period sales stay on get_city_period_metrics;
 * live inventory + months of supply come from getCityDetachedMarket (same
 * path as /sell). An MT miss withholds — never the RPC mixed-type /12 MOS.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  getCityDetachedMarket: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ rpc: h.rpc }),
}))

vi.mock('@/lib/data', () => ({
  getAllCitySnapshots: vi.fn(),
}))

vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getCityDetachedMarket: (...args: unknown[]) => h.getCityDetachedMarket(...args),
}))

import { getReportMetrics } from '@/app/actions/reports'

const RPC_ROW = {
  sold_count: 120,
  median_price: 800_000,
  median_dom: 14,
  median_ppsf: 350.25,
  current_listings: 794,
  sales_12mo: 1800,
  inventory_months: 5.3,
}

const MT_HIT = {
  activeCount: 775,
  monthsOfSupply: 4.45402298850575,
  mosLabel: '4.5',
  verdictKind: 'balanced' as const,
  verdictLabel: 'balanced market',
  medianListPrice: 915_000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-21',
}

function reportsSrc() {
  return readFileSync(resolve('app/actions/reports.ts'), 'utf8')
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
  h.rpc.mockReset().mockResolvedValue({ data: { ...RPC_ROW }, error: null })
  h.getCityDetachedMarket.mockReset().mockResolvedValue(MT_HIT)
})

describe('getReportMetrics live inventory overlay', () => {
  it('replaces RPC current_listings / inventory_months with getCityDetachedMarket', async () => {
    const { data, error } = await getReportMetrics('Bend', '2026-01-01', '2026-03-31')
    expect(error).toBeUndefined()
    expect(h.rpc).toHaveBeenCalledWith(
      'get_city_period_metrics',
      expect.objectContaining({ p_city: 'Bend', p_period_start: '2026-01-01', p_period_end: '2026-03-31' }),
    )
    expect(h.getCityDetachedMarket).toHaveBeenCalledWith('Bend')
    expect(data).toEqual({
      sold_count: 120,
      median_price: 800_000,
      median_dom: 14,
      median_ppsf: 350.25,
      sales_12mo: 1800,
      current_listings: 775,
      inventory_months: 4.45402298850575,
    })
  })

  it('keeps RPC period sales when Market Truth misses, and withholds live inventory + MOS', async () => {
    h.getCityDetachedMarket.mockResolvedValue(null)
    const { data } = await getReportMetrics('Terrebonne', '2026-01-01', '2026-03-31')
    expect(data).toMatchObject({
      sold_count: 120,
      median_price: 800_000,
      median_dom: 14,
      median_ppsf: 350.25,
      sales_12mo: 1800,
      current_listings: null,
      inventory_months: null,
    })
    expect(data?.current_listings).not.toBe(794)
    expect(data?.inventory_months).not.toBe(5.3)
  })

  it('withholds live inventory + MOS when getCityDetachedMarket throws', async () => {
    h.getCityDetachedMarket.mockRejectedValue(new Error('market_metric down'))
    const { data, error } = await getReportMetrics('Bend', '2026-01-01', '2026-03-31')
    expect(error).toBeUndefined()
    expect(data?.sold_count).toBe(120)
    expect(data?.current_listings).toBeNull()
    expect(data?.inventory_months).toBeNull()
  })

  it('withholds live inventory + MOS for subdivision grain (MT is city-only)', async () => {
    const { data } = await getReportMetrics('Bend', '2026-01-01', '2026-03-31', null, 'Aubrey Butte')
    expect(h.getCityDetachedMarket).not.toHaveBeenCalled()
    expect(data?.sold_count).toBe(120)
    expect(data?.sales_12mo).toBe(1800)
    expect(data?.current_listings).toBeNull()
    expect(data?.inventory_months).toBeNull()
  })

  it('still returns RPC period fields when property-type filters are on', async () => {
    const { data } = await getReportMetrics('Bend', '2026-01-01', '2026-03-31', null, null, {
      includeCondoTown: true,
    })
    expect(h.rpc).toHaveBeenCalledWith(
      'get_city_period_metrics',
      expect.objectContaining({ p_include_condo_town: true }),
    )
    expect(data?.sold_count).toBe(120)
    expect(data?.current_listings).toBe(775)
    expect(data?.inventory_months).toBe(4.45402298850575)
  })
})

describe('admin city builders — source contracts', () => {
  it('overlays getCityDetachedMarket outside the RPC cache, never using RPC MOS as inventory months', () => {
    const src = reportsSrc()
    expect(src).toMatch(/getCityDetachedMarket/)
    expect(src).toMatch(/overlayReportLiveInventory/)
    expect(src).toMatch(/liveInventoryForCityReport/)
    expect(src).toMatch(/current_listings: mt \? mt\.activeCount : null/)
    expect(src).toMatch(/inventory_months: mt \? mt\.monthsOfSupply : null/)
    expect(src).toMatch(/mixed-type \/12 inventory_months/)
    expect(src).toMatch(/overlayReportLiveInventory\(data, mt\)/)
  })

  it('CityReportSection prints em dash when live inventory is withheld', () => {
    const src = readFileSync(
      resolve('app/admin/(protected)/analytics/_components/CityReportSection.tsx'),
      'utf8',
    )
    expect(src).toMatch(/m\.current_listings \?\? '—'/)
    expect(src).toMatch(/m\.inventory_months != null \? formatMonthsOfSupply\(m\.inventory_months\) : '—'/)
    expect(src).toMatch(/getCityDetachedMarket/)
    expect(src).not.toMatch(/get_city_period_metrics/)
  })

  it('CustomReportBuilder prints em dash when live inventory is withheld', () => {
    const src = readFileSync(
      resolve('app/admin/(protected)/reports/custom/CustomReportBuilder.tsx'),
      'utf8',
    )
    expect(src).toMatch(/m\.current_listings \?\? '—'/)
    expect(src).toMatch(/m\.inventory_months != null \? formatMonthsOfSupply\(m\.inventory_months\) : '—'/)
    expect(src).toMatch(/getCityDetachedMarket/)
    expect(src).not.toMatch(/get_city_period_metrics/)
  })
})
