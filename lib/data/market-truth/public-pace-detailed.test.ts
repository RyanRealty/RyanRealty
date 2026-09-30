import { describe, expect, it, vi } from 'vitest'
import type { MetricResult } from '@/lib/data/market-truth/getMetric'

const getMetrics = vi.hoisted(() => vi.fn())
vi.mock('@/lib/data/market-truth/getMetric', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/getMetric')>('@/lib/data/market-truth/getMetric')
  return { ...actual, getMetrics }
})

import { getPublicDetachedPace, getPublicDetachedPaceDetailed } from '@/lib/data/market-truth/public-pace'

function cell(statId: string, value: number | null, publishable: boolean, sampleN = 61): MetricResult {
  return {
    statId,
    geoType: 'neighborhood',
    geoSlug: 'bend-larkspur',
    segment: 'detached',
    value,
    valueText: null,
    isPublishable: publishable,
    provenance: {
      sampleN,
      method: 'median',
      excludedN: 0,
      completeThrough: '2026-09-28',
      windowMonths: 12,
      definitionId: `def-${statId}`,
      computedAt: '2026-09-29T06:21:00Z',
      isFloor: false,
      withheldReason: publishable ? null : 'sample_below_floor',
    },
  }
}

describe('getPublicDetachedPaceDetailed (the n and as-of beside each published figure)', () => {
  it('returns the same row as getPublicDetachedPace plus provenance for published figures only', async () => {
    getMetrics.mockImplementation(async (inputs: Array<{ stat: string }>) =>
      inputs.map((i) =>
        i.stat === 'median_close'
          ? cell('median_close', 612000, true)
          : i.stat === 'closed_count'
            ? cell('closed_count', 61, true)
            : i.stat === 'yoy_median_price'
              ? cell('yoy_median_price', 0.024, false, 4)
              : null,
      ),
    )
    const detailed = await getPublicDetachedPaceDetailed({ geoType: 'neighborhood', geoSlug: 'bend-larkspur' })
    const plain = await getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: 'bend-larkspur' })
    expect(detailed.row).toEqual(plain)
    expect(detailed.row.medianClose).toBe(612000)
    expect(detailed.row.closedCount).toBe(61)
    expect(detailed.provenance.median_close).toMatchObject({ sampleN: 61, completeThrough: '2026-09-28', computedAt: '2026-09-29T06:21:00Z' })
    expect(detailed.provenance.closed_count?.definitionId).toBe('def-closed_count')
    // A withheld figure (sample below its floor) has no entry: it did not publish.
    expect(detailed.provenance.yoy_median_price).toBeUndefined()
    expect(detailed.row.yoyMedian).toBeNull()
  })

  it('an empty slug reads nothing', async () => {
    getMetrics.mockClear()
    const out = await getPublicDetachedPaceDetailed({ geoType: 'city', geoSlug: '' })
    expect(out.provenance).toEqual({})
    expect(getMetrics).not.toHaveBeenCalled()
  })
})
