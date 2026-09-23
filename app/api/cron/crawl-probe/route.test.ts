import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runCrawlProbe = vi.fn()
const upsertCrawlProbeRows = vi.fn()
const readCrawlProbeBaseline = vi.fn()
const queueBrokerHealthAlert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/crawl-probe/gsc', () => ({ createGscClient: () => null }))
vi.mock('@/lib/crawl-probe/run', async (orig) => ({
  ...(await orig<typeof import('@/lib/crawl-probe/run')>()),
  runCrawlProbe: (...a: unknown[]) => runCrawlProbe(...a),
}))
vi.mock('@/lib/data/crawl-probe/rows', () => ({
  readCrawlProbeBaseline: (...a: unknown[]) => readCrawlProbeBaseline(...a),
  upsertCrawlProbeRows: (...a: unknown[]) => upsertCrawlProbeRows(...a),
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: (...a: unknown[]) => queueBrokerHealthAlert(...a) }))

const failing = {
  date: '2026-09-23',
  startedAt: '2026-09-23T11:55:00.000Z',
  durationMs: 1000,
  checks: [{ metric: 'page_fetch', surface: '/x', status: 'fail', failures: ['HTTP 500'], data: {} }],
  summary: { metric: 'run', surface: '', status: 'fail', failures: ['1 of 1 checks failed'], data: { checks: 1, failed: 1 } },
  alert: 'Crawl probe: 1 of 1 checks failed.',
}

const req = (qs = '', auth = 'Bearer test-secret') =>
  new Request(`https://ryan-realty.com/api/cron/crawl-probe${qs}`, { headers: auth ? { authorization: auth } : {} })

describe('/api/cron/crawl-probe', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    runCrawlProbe.mockResolvedValue(failing)
    readCrawlProbeBaseline.mockResolvedValue({ counts: new Map(), error: null })
    upsertCrawlProbeRows.mockResolvedValue({ written: 2, error: null })
    queueBrokerHealthAlert.mockResolvedValue(true)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('refuses a request without the cron secret and does no work', async () => {
    const { GET } = await import('./route')
    const res = await GET(req('', ''))
    expect(res.status).toBe(401)
    expect(runCrawlProbe).not.toHaveBeenCalled()
  })

  it('writes one row per check plus the summary and queues ONE owner alert on failure', async () => {
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(200)
    const rows = upsertCrawlProbeRows.mock.calls[0][1] as Array<{ metric: string; value: number }>
    expect(rows.map((r) => [r.metric, r.value])).toEqual([
      ['run', 0],
      ['page_fetch', 0],
    ])
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert.mock.calls[0][0]).toMatchObject({ key: 'crawl-probe', body: failing.alert })
    const body = await res.json()
    expect(body.alert).toEqual({ body: failing.alert, notify: true, queued: true })
  })

  it('notify=0 runs and writes but never queues the alert', async () => {
    const { GET } = await import('./route')
    const res = await GET(req('?notify=0'))
    expect(res.status).toBe(200)
    expect(upsertCrawlProbeRows).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('does not alert when every check passed', async () => {
    runCrawlProbe.mockResolvedValue({ ...failing, checks: [], summary: { ...failing.summary, status: 'pass' }, alert: null })
    const { GET } = await import('./route')
    await GET(req())
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('records a probe that throws as a failed run and alerts on it', async () => {
    runCrawlProbe.mockRejectedValue(new Error('socket hang up'))
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(200)
    const rows = upsertCrawlProbeRows.mock.calls[0][1] as Array<{ metric: string; value: number; metadata: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ metric: 'run', value: 0, metadata: { status: 'fail', crashed: true } })
    expect(queueBrokerHealthAlert.mock.calls[0][0]).toMatchObject({
      key: 'crawl-probe',
      body: 'Crawl probe: crawl probe crashed: socket hang up',
    })
  })

  it('returns 500 when the rows cannot be written (the monitor itself is broken)', async () => {
    upsertCrawlProbeRows.mockResolvedValue({ written: 0, error: 'permission denied' })
    const { GET } = await import('./route')
    const res = await GET(req('?notify=0'))
    expect(res.status).toBe(500)
  })
})
