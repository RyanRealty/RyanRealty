import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { resolveNeighborhoodMetricSlug } from '@/lib/data/market-truth/neighborhood-metric-slug'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'

type Recorded = {
  table: string
  eqs: Array<[string, unknown]>
  ins: Array<[string, unknown[]]>
}

function mockMetricRows(slugs: string[]) {
  const rec: Recorded = { table: '', eqs: [], ins: [] }
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = (col: string, val: unknown) => {
    rec.eqs.push([col, val])
    return chain
  }
  chain.in = (col: string, vals: unknown[]) => {
    rec.ins.push([col, vals as unknown[]])
    return chain
  }
  chain.then = (resolveThen: (v: unknown) => unknown, rejectThen?: (e: unknown) => unknown) =>
    Promise.resolve({
      data: slugs.map((geo_slug) => ({ geo_slug })),
      error: null,
    }).then(resolveThen, rejectThen)
  mockFrom.mockImplementation((table: string) => {
    rec.table = table
    return chain
  })
  return rec
}

describe('resolveNeighborhoodMetricSlug', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('prefers sunriver over sunriver-sunriver when the unprefixed slug has a row', async () => {
    const rec = mockMetricRows(['sunriver', 'sunriver-sunriver'])
    await expect(
      resolveNeighborhoodMetricSlug({ citySlug: 'sunriver', neighborhoodSlug: 'sunriver' }),
    ).resolves.toBe('sunriver')
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(rec.table).toBe('market_metric')
    expect(rec.eqs).toContainEqual(['definition_id', DEFINITION_ID])
    expect(rec.eqs).toContainEqual(['geo_type', 'neighborhood'])
    expect(rec.ins).toContainEqual(['geo_slug', ['sunriver', 'sunriver-sunriver']])
  })

  it('uses bend-larkspur when only the prefixed slug has a row', async () => {
    mockMetricRows(['bend-larkspur'])
    await expect(
      resolveNeighborhoodMetricSlug({ citySlug: 'bend', neighborhoodSlug: 'larkspur' }),
    ).resolves.toBe('bend-larkspur')
  })

  it('uses northwest-crossing when the unprefixed slug has a row', async () => {
    mockMetricRows(['northwest-crossing'])
    await expect(
      resolveNeighborhoodMetricSlug({
        citySlug: 'bend',
        neighborhoodSlug: 'northwest-crossing',
      }),
    ).resolves.toBe('northwest-crossing')
  })

  it('falls back to the prefixed GIS slug when neither candidate has a row', async () => {
    mockMetricRows([])
    await expect(
      resolveNeighborhoodMetricSlug({ citySlug: 'bend', neighborhoodSlug: 'old-bend' }),
    ).resolves.toBe('bend-old-bend')
  })
})

describe('nested city neighborhood page wiring', () => {
  const page = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')

  it('resolves Market Truth slugs and keeps the GIS boundary slug for inventory/map', () => {
    expect(page).toMatch(/resolveNeighborhoodMetricSlug/)
    expect(page).toMatch(/const boundaryNeighborhoodSlug = `\$\{citySlug\}-\$\{neighborhoodSlug\}`/)
    expect(page).toMatch(/getNeighborhoodPublicInventory\(boundaryNeighborhoodSlug\)/)
    expect(page).toMatch(
      /getGeoBoundaryMapData\(\{ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug \}\)/,
    )
    expect(page).toMatch(
      /getMarketPulse\(\{ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug \}\)/,
    )
    expect(page).toMatch(
      /getPublicDetachedPace\(\{ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug \}\)/,
    )
    expect(page).toMatch(
      /getPublicPlaceSegments\(\{ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug \}\)/,
    )
    expect(page).not.toMatch(
      /getPublicDetachedPace\(\{ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug \}\)/,
    )
    expect(page).not.toMatch(
      /getPublicPlaceSegments\(\{ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug \}\)/,
    )
    expect(page).not.toMatch(
      /getMarketPulse\(\{ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug \}\)/,
    )
  })
})
