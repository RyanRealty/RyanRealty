import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { MetaAdsInsightRow } from '@/lib/meta-graph'

const { getMetaAdsInsights, upsertMetricRows } = vi.hoisted(() => ({
  getMetaAdsInsights: vi.fn(),
  upsertMetricRows: vi.fn(),
}))

vi.mock('@/lib/meta-graph', () => ({
  getMetaAdsInsights: (...args: unknown[]) => getMetaAdsInsights(...args),
}))

vi.mock('@/lib/marketing-brain/snapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/marketing-brain/snapshot')>()
  return {
    ...actual,
    upsertMetricRows: (...args: unknown[]) => upsertMetricRows(...args),
  }
})

import { GET } from './route'

const SECRET = 'test-cron-secret'

function authed(search = ''): NextRequest {
  return new NextRequest(`https://ryanrealty.test/api/cron/marketing-snapshot-meta-ads${search}`, {
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

function insight(over: Partial<MetaAdsInsightRow> = {}): MetaAdsInsightRow {
  return {
    date_start: '2026-09-20',
    date_stop: '2026-09-20',
    impressions: '1000',
    reach: '800',
    spend: '12.50',
    clicks: '20',
    cpm: '12.50',
    cpc: '0.63',
    ctr: '2.0',
    actions: [{ action_type: 'lead', value: '2' }],
    ...over,
  }
}

describe('GET /api/cron/marketing-snapshot-meta-ads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
    upsertMetricRows.mockImplementation(async (rows: unknown[]) => rows.length)
  })

  it('returns 500 when insights throws and does not upsert', async () => {
    getMetaAdsInsights.mockRejectedValue(
      new Error('META_PAGE_ACCESS_TOKEN (or META_PAGE_TOKEN) is not set in the environment'),
    )

    const res = await GET(authed())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.empty).not.toBe(true)
    expect(body.rowsUpserted).toBe(0)
    expect(body.errors[0]).toMatch(/META_PAGE_ACCESS_TOKEN/)
    expect(upsertMetricRows).not.toHaveBeenCalled()
  })

  it('returns 200 and upserts when insights returns rows', async () => {
    getMetaAdsInsights.mockResolvedValue({
      accountRow: insight(),
      campaignRows: [insight({ campaign_id: 'c1', campaign_name: 'Seller', objective: 'OUTCOME_LEADS' })],
    })

    const res = await GET(authed('?startDate=2026-09-20&endDate=2026-09-20'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.empty).toBeUndefined()
    expect(body.rowsUpserted).toBe(16)
    expect(body.errors).toEqual([])
    expect(upsertMetricRows).toHaveBeenCalledOnce()
    const rows = upsertMetricRows.mock.calls[0][0] as Array<{
      scope: string
      metric: string
      value: number
      scope_id: string
    }>
    expect(rows).toHaveLength(16)
    expect(rows.find((r) => r.scope === 'account' && r.metric === 'spend')?.value).toBe(12.5)
    expect(rows.find((r) => r.scope === 'campaign' && r.metric === 'spend')).toMatchObject({
      scope_id: 'c1',
      value: 12.5,
    })
  })

  it('returns 200 empty:true and does not upsert when the account had no delivery', async () => {
    getMetaAdsInsights.mockResolvedValue({ accountRow: null, campaignRows: [] })

    const res = await GET(authed('?startDate=2026-09-20&endDate=2026-09-20'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.empty).toBe(true)
    expect(body.reason).toBe('insights succeeded with zero campaigns and zero spend')
    expect(body.rowsUpserted).toBe(0)
    expect(body.errors).toEqual([])
    expect(upsertMetricRows).not.toHaveBeenCalled()
  })
})
