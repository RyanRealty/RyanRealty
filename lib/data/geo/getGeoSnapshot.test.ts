import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { pulseOnlyCitySnapshot } from './pulse-only-city-snapshot'

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

import {
  overlayPublishedInventory,
  placeInventorySlugs,
  type GeoSnapshot,
} from './getGeoSnapshot'
import type { DetachedInventory } from '@/lib/data/market-truth/getSellBendMarket'

function snap(
  partial: Partial<GeoSnapshot> & Pick<GeoSnapshot, 'geoType' | 'geoKey'>,
): GeoSnapshot {
  return {
    geoLabel: partial.geoLabel ?? partial.geoKey,
    activeSfrCount: 488,
    activeAllCount: 488,
    pendingCount: 12,
    medianListPrice: 111,
    communityCount: 3,
    refreshedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function mt(activeCount: number, medianListPrice: number | null = 899000): DetachedInventory {
  return {
    activeCount,
    medianListPrice,
    computedAt: '2026-08-23T00:00:00.000Z',
  }
}

describe('pulseOnlyCitySnapshot', () => {
  it('builds a Tumalo city door from pulse without borrowing Bend', () => {
    const row = pulseOnlyCitySnapshot('tumalo', {
      geo_slug: 'tumalo',
      geo_label: 'Tumalo',
      active_count: 0,
      pending_count: 0,
      median_list_price: null,
      updated_at: '2026-08-17T00:00:00.000Z',
    })
    expect(row.geoKey).toBe('tumalo')
    expect(row.geoLabel).toBe('Tumalo')
    expect(row.activeSfrCount).toBe(0)
    expect(row.medianListPrice).toBeNull()
  })
})

describe('placeInventorySlugs', () => {
  it('passes neighborhood geoKey through (bend-larkspur)', () => {
    expect(placeInventorySlugs('neighborhood', 'bend-larkspur')).toEqual(['bend-larkspur'])
  })

  it('maps community city:name to resolveNeighborhoodMetricSlug candidates', () => {
    expect(placeInventorySlugs('community', 'bend:tetherow')).toEqual([
      'tetherow',
      'bend-tetherow',
    ])
    expect(placeInventorySlugs('community', 'sunriver:sunriver')).toEqual([
      'sunriver',
      'sunriver-sunriver',
    ])
    expect(placeInventorySlugs('community', 'bend:northwest crossing')).toEqual([
      'northwest-crossing',
      'bend-northwest-crossing',
    ])
  })

  it('uses a community slug key as-is', () => {
    expect(placeInventorySlugs('community', 'tetherow')).toEqual(['tetherow'])
  })

  it('does not rewrite city keys here (cityDetachedSlug stays on the city overlay)', () => {
    expect(placeInventorySlugs('city', 'la pine')).toEqual([])
    expect(placeInventorySlugs('city', 'bend')).toEqual([])
  })
})

describe('overlayPublishedInventory', () => {
  it('overlays Bend city detached 774 and does not keep pulse 488', () => {
    const map = new Map<string, DetachedInventory>([['city:bend', mt(774)]])
    const out = overlayPublishedInventory(snap({ geoType: 'city', geoKey: 'bend' }), map)
    expect(out.activeSfrCount).toBe(774)
    expect(out.medianListPrice).toBe(899000)
    expect(out.pendingCount).toBe(12)
    expect(out.geoKey).toBe('bend')
  })

  it('hyphenates space city keys the way market_metric keys them', () => {
    const map = new Map<string, DetachedInventory>([['city:la-pine', mt(40, 425000)]])
    const out = overlayPublishedInventory(snap({ geoType: 'city', geoKey: 'la pine' }), map)
    expect(out.activeSfrCount).toBe(40)
    expect(out.medianListPrice).toBe(425000)
  })

  it('city miss nulls published inventory and keeps the snapshot door', () => {
    const out = overlayPublishedInventory(snap({ geoType: 'city', geoKey: 'bend' }), new Map())
    expect(out).not.toBeNull()
    expect(out.activeSfrCount).toBeNull()
    expect(out.medianListPrice).toBeNull()
    expect(out.pendingCount).toBe(12)
    expect(out.activeAllCount).toBe(488)
    expect(out.geoKey).toBe('bend')
  })

  it('community miss nulls inventory and does not copy pulse 488', () => {
    const out = overlayPublishedInventory(
      snap({ geoType: 'community', geoKey: 'bend:tetherow' }),
      new Map(),
    )
    expect(out.activeSfrCount).toBeNull()
    expect(out.medianListPrice).toBeNull()
    expect(out.pendingCount).toBe(12)
    expect(out.geoKey).toBe('bend:tetherow')
  })

  it('community bend:tetherow overlays neighborhood:tetherow', () => {
    const map = new Map<string, DetachedInventory>([
      ['neighborhood:tetherow', mt(16, 1_850_000)],
      ['neighborhood:bend-tetherow', mt(99, 1)],
    ])
    const out = overlayPublishedInventory(
      snap({ geoType: 'community', geoKey: 'bend:tetherow' }),
      map,
    )
    expect(out.activeSfrCount).toBe(16)
    expect(out.medianListPrice).toBe(1_850_000)
    expect(out.pendingCount).toBe(12)
  })

  it('community sunriver:sunriver prefers sunriver over sunriver-sunriver', () => {
    const map = new Map<string, DetachedInventory>([
      ['neighborhood:sunriver', mt(56, 750000)],
      ['neighborhood:sunriver-sunriver', mt(1, 1)],
    ])
    const out = overlayPublishedInventory(
      snap({ geoType: 'community', geoKey: 'sunriver:sunriver' }),
      map,
    )
    expect(out.activeSfrCount).toBe(56)
  })

  it('community slug-only key overlays that neighborhood slug', () => {
    const map = new Map<string, DetachedInventory>([['neighborhood:tetherow', mt(16)]])
    const out = overlayPublishedInventory(snap({ geoType: 'community', geoKey: 'tetherow' }), map)
    expect(out.activeSfrCount).toBe(16)
  })

  it('neighborhood bend-larkspur overlays neighborhood:bend-larkspur', () => {
    const map = new Map<string, DetachedInventory>([['neighborhood:bend-larkspur', mt(41, 625000)]])
    const out = overlayPublishedInventory(
      snap({ geoType: 'neighborhood', geoKey: 'bend-larkspur' }),
      map,
    )
    expect(out.activeSfrCount).toBe(41)
    expect(out.medianListPrice).toBe(625000)
  })

  it('neighborhood miss nulls published inventory', () => {
    const out = overlayPublishedInventory(
      snap({ geoType: 'neighborhood', geoKey: 'bend-larkspur' }),
      new Map(),
    )
    expect(out.activeSfrCount).toBeNull()
    expect(out.medianListPrice).toBeNull()
    expect(out.pendingCount).toBe(12)
  })
})

describe('getGeoSnapshot cache + overlay wiring', () => {
  const src = readFileSync(resolve('lib/data/geo/getGeoSnapshot.ts'), 'utf8')

  it('bumps cache keys and overlays community/neighborhood via getDetachedInventories', () => {
    expect(src).toMatch(/geo-snapshot-v8-mt-nbh-inventory/)
    expect(src).toMatch(/geo-snapshot-all-cities-v8-mt-nbh-inventory/)
    expect(src).toMatch(/geo-snapshot-all-communities-v8-mt-nbh-inventory/)
    expect(src).toMatch(/geo-snapshot-communities-v8-mt-nbh-inventory/)
    expect(src).toMatch(/resolveNeighborhoodMetricSlug/)
    expect(src).toMatch(/overlayPlaceSnapshotsInventory/)
    expect(src).toMatch(/geoType: 'neighborhood'/)
    expect(src).not.toMatch(/polygons unrepaired/)
  })
})
