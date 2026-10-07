import { describe, expect, it, vi } from 'vitest'

const getMetrics = vi.fn()
vi.mock('@/lib/data/market-truth/getMetric', () => ({ getMetrics }))

const { getStudioPriceSeries, STUDIO_TREND_MONTHS } = await import('./series')

type Input = { periodEnd: string }
const cell = (value: number | null, publishable = true) => ({
  value,
  isPublishable: publishable,
  provenance: { sampleN: 180, computedAt: '2026-10-01T06:00:00.000Z', definitionId: 'mt-v1' },
})

describe('getStudioPriceSeries', () => {
  it('keys the month in progress in Pacific time: the last evening of September draws through August', async () => {
    getMetrics.mockImplementationOnce(async (inputs: Input[]) => inputs.map(() => cell(700000)))
    // 2026-10-01T03:00Z is 8 pm on Sep 30 in Bend: September is still in progress.
    const months = await getStudioPriceSeries({ geoType: 'city', geoSlug: 'bend', now: new Date('2026-10-01T03:00:00Z') })
    expect(months).toHaveLength(STUDIO_TREND_MONTHS)
    expect(months[months.length - 1]).toMatchObject({ periodEnd: '2026-08-31', tick: 'Aug 2026' })
    expect(months[0]).toMatchObject({ periodEnd: '2024-09-30', tick: 'Sep 2024' })
  })

  it('plots only the cells the public charts plot; a withheld month is a gap with no provenance', async () => {
    getMetrics.mockImplementationOnce(async (inputs: Input[]) =>
      inputs.map((_, i) => (i === 3 ? cell(710000, false) : i === 4 ? null : i === 5 ? cell(0) : cell(700000 + i))),
    )
    const months = await getStudioPriceSeries({ geoType: 'city', geoSlug: 'bend', now: new Date('2026-10-07T18:00:00Z') })
    expect(months.slice(3, 6).map((m) => m.value)).toEqual([null, null, null])
    expect(months[3]).toMatchObject({ sampleN: null, computedAt: null, definitionId: null })
    expect(months[6]).toMatchObject({ value: 700006, sampleN: 180, definitionId: 'mt-v1' })
    // One-month windows of median_close, detached, ending on each month's last day.
    expect(getMetrics.mock.calls[1][0][0]).toMatchObject({ stat: 'median_close', segment: 'detached', windowMonths: 1, periodEnd: '2024-10-31' })
  })
})
