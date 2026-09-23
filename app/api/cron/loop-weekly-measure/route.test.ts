import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Visibility audit 2026-09-22 (PROCESS-1): the weekly measurer route is a thin
// shell over runWeeklyMeasure. These pin its contract: CRON_SECRET or nothing,
// a malformed backfill range is refused before any work, dryRun and steps pass
// through, and a failed run is a 500 (so the Vercel cron log shows it).
const runWeeklyMeasure = vi.fn()
const createGscQuery = vi.fn()

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/data/loop/weekly-measure', () => ({
  runWeeklyMeasure: (...a: unknown[]) => runWeeklyMeasure(...a),
}))
vi.mock('@/lib/data/loop/gsc-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/data/loop/gsc-api')>()),
  createGscQuery: (...a: unknown[]) => createGscQuery(...a),
}))

const req = (qs = '', auth = 'Bearer test-secret') =>
  new Request(`https://ryan-realty.com/api/cron/loop-weekly-measure${qs}`, { headers: auth ? { authorization: auth } : {} })

describe('/api/cron/loop-weekly-measure', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    createGscQuery.mockResolvedValue(null)
    runWeeklyMeasure.mockResolvedValue({ ok: true, dryRun: false, errors: [] })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('refuses a request without the cron secret and does no work', async () => {
    const { GET } = await import('./route')
    const res = await GET(req('', ''))
    expect(res.status).toBe(401)
    expect(runWeeklyMeasure).not.toHaveBeenCalled()
  })

  it('runs every step by default as the cron source', async () => {
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(200)
    const [, opts] = runWeeklyMeasure.mock.calls[0] as [unknown, { dryRun: boolean; steps: unknown; storeRange: unknown; source: string }]
    expect(opts.dryRun).toBe(false)
    expect(opts.steps).toBeUndefined()
    expect(opts.storeRange).toBeNull()
    expect(opts.source).toBe('cron:loop-weekly-measure')
  })

  it('passes dryRun, a step list and a backfill range through', async () => {
    const { GET } = await import('./route')
    await GET(req('?dryRun=1&steps=store&startDate=2025-06-01&endDate=2025-09-28'))
    const [, opts] = runWeeklyMeasure.mock.calls[0] as [unknown, { dryRun: boolean; steps: Record<string, boolean>; storeRange: unknown }]
    expect(opts.dryRun).toBe(true)
    expect(opts.steps).toEqual({ store: true, learn: false, seed: false, snapshot: false })
    expect(opts.storeRange).toEqual({ startDate: '2025-06-01', endDate: '2025-09-28' })
  })

  it('refuses a half or reversed backfill range before any work', async () => {
    const { GET } = await import('./route')
    for (const qs of ['?startDate=2025-06-01', '?startDate=2025-09-28&endDate=2025-06-01', '?startDate=june&endDate=2025-06-30']) {
      const res = await GET(req(qs))
      expect(res.status).toBe(400)
    }
    expect(runWeeklyMeasure).not.toHaveBeenCalled()
  })

  it('a run with errors answers 500 with the result body', async () => {
    runWeeklyMeasure.mockResolvedValue({ ok: false, dryRun: false, errors: ['store: boom'] })
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ ok: false, errors: ['store: boom'] })
  })
})
