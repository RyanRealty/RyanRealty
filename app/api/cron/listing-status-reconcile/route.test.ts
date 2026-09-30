import { beforeEach, describe, expect, it, vi } from 'vitest'

const reconcileMock = vi.hoisted(() => vi.fn())
const alertMock = vi.hoisted(() => vi.fn(async () => true))

vi.mock('@/lib/sync/closingsReconcile', () => ({
  STATUS_RECONCILE_TERMINAL_DAYS: 120,
  reconcileListingStatus: (...args: unknown[]) => reconcileMock(...args),
}))
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: (...args: unknown[]) => alertMock(...(args as [])),
}))

import { GET } from './route'

const SECRET = 'status-reconcile-test-secret'

function authed(query = ''): Request {
  return new Request(`https://ryan-realty.com/api/cron/listing-status-reconcile${query}`, {
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

function result(over: Record<string, unknown> = {}) {
  return {
    sparkOnMarket: 9000,
    ourOnMarket: 8700,
    terminalChecked: 2700,
    terminalSince: '2026-06-02T00:00:00.000Z',
    drift: [],
    notInSpark: [],
    refused: null,
    repaired: 0,
    repairedKeys: [],
    repairLogged: 0,
    repairFailed: [],
    skippedNewer: [],
    historyRefreshed: 0,
    refinalized: 0,
    membershipRows: 0,
    ...over,
  }
}

function drift(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    key: `K${i}`,
    listNumber: `L${i}`,
    reasons: ['status'],
    ours: { status: 'Expired' },
    mls: { status: 'Active' },
  }))
}

describe('GET /api/cron/listing-status-reconcile', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    reconcileMock.mockReset()
    alertMock.mockClear()
  })

  it('returns 401 and reconciles nothing without the cron secret', async () => {
    const res = await GET(new Request('https://ryan-realty.com/api/cron/listing-status-reconcile'))
    expect(res.status).toBe(401)
    expect(reconcileMock).not.toHaveBeenCalled()
  })

  it('repairs by default, capped, re-checking 120 days of terminal rows', async () => {
    reconcileMock.mockResolvedValue(result())
    const res = await GET(authed())
    expect(res.status).toBe(200)
    expect(reconcileMock).toHaveBeenCalledWith({ repair: true, maxRepairs: 250, terminalSinceDays: 120 })
    expect((await res.json()).ok).toBe(true)
    expect(alertMock).not.toHaveBeenCalled()
  })

  it('?repair=0 reconciles without writing', async () => {
    reconcileMock.mockResolvedValue(result())
    await GET(authed('?repair=0'))
    expect(reconcileMock).toHaveBeenCalledWith(expect.objectContaining({ repair: false }))
  })

  it('reports the status pairs and texts the owner once when drift says the sync is losing updates', async () => {
    reconcileMock.mockResolvedValue(result({ drift: drift(40), repaired: 40, repairLogged: 40 }))
    const res = await GET(authed())
    const body = await res.json()
    expect(body.drifted).toBe(40)
    expect(body.pairs).toEqual({ 'Expired -> Active': 40 })
    expect(alertMock).toHaveBeenCalledTimes(1)
    expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'listing-status-drift', cooldownMinutes: 1440 }))
  })

  it('a refused run (Spark looked down) is not ok and alerts', async () => {
    reconcileMock.mockResolvedValue(result({ refused: 'Spark returned 0 on-market listings while we hold 8700' }))
    const res = await GET(authed())
    expect((await res.json()).ok).toBe(false)
    expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'listing-status-reconcile-refused' }))
  })

  it('a thrown run answers 500 and alerts', async () => {
    reconcileMock.mockRejectedValue(new Error('Spark API error 503'))
    const res = await GET(authed())
    expect(res.status).toBe(500)
    expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'listing-status-reconcile' }))
  })
})
