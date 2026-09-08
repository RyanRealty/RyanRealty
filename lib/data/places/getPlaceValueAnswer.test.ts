import { beforeEach, describe, expect, it, vi } from 'vitest'

const overlays = vi.fn()
const pace = vi.fn()

vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedOverlays: (...args: unknown[]) => overlays(...args),
}))
vi.mock('@/lib/data/market-truth/public-pace', () => ({
  getPublicDetachedPace: (...args: unknown[]) => pace(...args),
}))

import { getPlaceValueAnswer } from './getPlaceValueAnswer'

const headlines = {
  activeCount: 42,
  monthsOfSupply: 3.9,
  mosLabel: '3.9 months',
  verdictKind: 'sellers',
  verdictLabel: "seller's market",
  medianListPrice: 950000,
  computedAt: '2026-09-07T16:28:00Z',
  completeThrough: '2026-08-31',
}

describe('getPlaceValueAnswer', () => {
  beforeEach(() => {
    overlays.mockReset()
    pace.mockReset()
  })

  it('publishes the verdict from months of supply and carries pace and cash share with traces', async () => {
    overlays.mockResolvedValue(
      new Map([['neighborhood:brasada-ranch', { headlines, inventory: { activeCount: 42, medianListPrice: 950000, computedAt: headlines.computedAt } }]]),
    )
    pace.mockResolvedValue({ daysToPending90d: 23, cashShare: 0.41, saleToOriginal: 0.972, closedCount: 88 })
    const a = await getPlaceValueAnswer({ geoType: 'neighborhood', geoSlug: 'Brasada-Ranch' })
    expect(overlays).toHaveBeenCalledWith([{ geoType: 'neighborhood', geoSlug: 'brasada-ranch' }])
    expect(a.geoSlug).toBe('brasada-ranch')
    expect(a.monthsOfSupply).toBe(3.9)
    expect(a.verdict?.kind).toBe('sellers')
    expect(a.daysToPending).toBe(23)
    expect(a.cashShare).toBe(0.41)
    expect(a.saleToOriginal).toBe(0.972)
    expect(a.activeCount).toBe(42)
    expect(a.closedCount).toBe(88)
    expect(a.asOf).toBe(headlines.computedAt)
    expect(a.hasFigures).toBe(true)
    expect(a.trace.join('\n')).toContain('months of supply 3.9')
    expect(a.trace.join('\n')).toContain('days to pending 23')
    expect(a.trace.join('\n')).toContain('cash share 41.0%')
    // Verdict thresholds are the canon's: <= 4 is a seller's market.
    expect(a.verdict?.label).toBe("seller's market")
  })

  it('reports no figures, no verdict, and an empty trace when the metric layer has nothing', async () => {
    overlays.mockResolvedValue(new Map())
    pace.mockResolvedValue(null)
    const a = await getPlaceValueAnswer({ geoType: 'neighborhood', geoSlug: 'nowhere' })
    expect(a.verdict).toBeNull()
    expect(a.monthsOfSupply).toBeNull()
    expect(a.daysToPending).toBeNull()
    expect(a.cashShare).toBeNull()
    expect(a.hasFigures).toBe(false)
    expect(a.trace).toEqual([])
  })

  it('survives a failing read instead of throwing on a public page', async () => {
    overlays.mockRejectedValue(new Error('timeout'))
    pace.mockResolvedValue({ daysToPending90d: 31, cashShare: null, saleToOriginal: null, closedCount: 12 })
    const a = await getPlaceValueAnswer({ geoType: 'city', geoSlug: 'bend' })
    expect(a.verdict).toBeNull()
    expect(a.daysToPending).toBe(31)
    expect(a.hasFigures).toBe(true)
  })

  it('classifies a balanced and a buyer market by the canon thresholds', async () => {
    overlays.mockResolvedValue(new Map([['city:bend', { headlines: { ...headlines, monthsOfSupply: 5.2 }, inventory: null }]]))
    pace.mockResolvedValue(null)
    const balanced = await getPlaceValueAnswer({ geoType: 'city', geoSlug: 'bend' })
    expect(balanced.verdict?.kind).toBe('balanced')
    overlays.mockResolvedValue(new Map([['city:bend', { headlines: { ...headlines, monthsOfSupply: 7.5 }, inventory: null }]]))
    const buyers = await getPlaceValueAnswer({ geoType: 'city', geoSlug: 'bend' })
    expect(buyers.verdict?.kind).toBe('buyers')
  })
})
