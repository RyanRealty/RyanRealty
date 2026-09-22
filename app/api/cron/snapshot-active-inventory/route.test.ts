import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_INVENTORY_CITIES } from '@/lib/data/analytics/snapshotActiveInventory'

const snapshotMock = vi.hoisted(() => vi.fn())
const createServiceClient = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('test must stub the service client')
  }),
)

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => createServiceClient(),
}))

vi.mock('@/lib/data/analytics/snapshotActiveInventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/analytics/snapshotActiveInventory')>()
  return {
    ...actual,
    snapshotActiveInventory: (...args: unknown[]) => snapshotMock(...args),
  }
})

import { GET } from './route'

const SECRET = 'd2-inventory-test-secret'

function authed(): Request {
  return new Request('https://ryan-realty.com/api/cron/snapshot-active-inventory', {
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

function writerResult(overrides: Record<string, unknown>) {
  return {
    ok: false,
    as_of: '2026-09-21',
    computedAt: '2026-09-21T23:30:00.000Z',
    written: 0,
    attempted: ACTIVE_INVENTORY_CITIES.length,
    totalActive: 0,
    error: null,
    errors: [],
    dryRun: false,
    byCity: [],
    geo: 'central-oregon-service-area',
    methodology: 'active_ilike+service_area_v1',
    ...overrides,
  }
}

describe('GET /api/cron/snapshot-active-inventory', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    snapshotMock.mockReset()
    createServiceClient.mockReset()
    createServiceClient.mockReturnValue({ from() {} })
  })

  it('returns 401 and does not write when the cron secret is missing', async () => {
    const res = await GET(new Request('https://ryan-realty.com/api/cron/snapshot-active-inventory'))
    expect(res.status).toBe(401)
    expect(snapshotMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the service client cannot be built', async () => {
    createServiceClient.mockImplementation(() => {
      throw new Error('Supabase service role not configured')
    })
    snapshotMock.mockResolvedValue(
      writerResult({ ok: false, error: 'Supabase client is missing', written: 0 }),
    )
    const res = await GET(authed())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(snapshotMock).toHaveBeenCalledWith({ client: null })
  })

  it('returns 500 when the upsert fails', async () => {
    snapshotMock.mockResolvedValue(
      writerResult({ ok: false, written: 0, error: 'permission denied for table analytics_inventory_snapshot' }),
    )
    const res = await GET(authed())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.written).toBe(0)
    expect(body.error).toMatch(/permission denied/)
  })

  it('returns 500 when the writer claims success but did not write every city', async () => {
    snapshotMock.mockResolvedValue(
      writerResult({ ok: true, written: 3, attempted: ACTIVE_INVENTORY_CITIES.length, totalActive: 3 }),
    )
    const res = await GET(authed())
    expect(res.status).toBe(500)
    expect((await res.json()).ok).toBe(false)
  })

  it('returns 500 when zero rows are written', async () => {
    snapshotMock.mockResolvedValue(writerResult({ ok: true, written: 0, attempted: 0 }))
    const res = await GET(authed())
    expect(res.status).toBe(500)
    expect((await res.json()).ok).toBe(false)
  })

  it('returns 200 only when written equals the cities attempted', async () => {
    snapshotMock.mockResolvedValue(
      writerResult({
        ok: true,
        written: ACTIVE_INVENTORY_CITIES.length,
        attempted: ACTIVE_INVENTORY_CITIES.length,
        totalActive: 4100,
        error: null,
      }),
    )
    const res = await GET(authed())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.as_of).toBe('2026-09-21')
    expect(body.written).toBe(ACTIVE_INVENTORY_CITIES.length)
    expect(body.totalActive).toBe(4100)
  })
})
