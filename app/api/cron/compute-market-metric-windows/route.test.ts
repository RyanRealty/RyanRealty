import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ rpc }) }))

const ROOT = process.cwd()
const req = (auth = 'Bearer test-secret') =>
  new Request('https://ryan-realty.com/api/cron/compute-market-metric-windows', {
    headers: auth ? { authorization: auth } : {},
  })

const FUNCTIONS = [
  'compute_market_metrics_monthly_shadow',
  'compute_market_metrics_monthly_neighborhood_shadow',
  'compute_market_metrics_monthly_zip_shadow',
  'compute_market_metrics_hud_windows_shadow',
]

describe('/api/cron/compute-market-metric-windows', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('refuses a request without the cron secret and computes nothing', async () => {
    const { GET } = await import('./route')
    const res = await GET(req(''))
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('runs the four window functions in order, the monthly ones over 36 months', async () => {
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(FUNCTIONS)
    expect(rpc.mock.calls.slice(0, 3).map((c) => c[1])).toEqual([
      { p_months: 36 },
      { p_months: 36 },
      { p_months: 36 },
    ])
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.steps.map((s: { step: string }) => s.step)).toEqual([
      'monthly_city_region',
      'monthly_neighborhood',
      'monthly_zip',
      'hud_windows',
    ])
  })

  it('still runs the later steps when an earlier one fails, and answers 500', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'compute_market_metrics_monthly_shadow'
        ? { data: null, error: { message: 'upstream request timeout' } }
        : { data: { ok: true }, error: null },
    )
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(FUNCTIONS)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.steps[0]).toMatchObject({ step: 'monthly_city_region', ok: false, error: 'upstream request timeout' })
    expect(body.steps.slice(1).every((s: { ok: boolean }) => s.ok)).toBe(true)
  })

  it('contains a thrown call the same way', async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'compute_market_metrics_hud_windows_shadow') throw new Error('socket hang up')
      return { data: { ok: true }, error: null }
    })
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.steps[3]).toMatchObject({ step: 'hud_windows', ok: false, error: 'socket hang up' })
  })
})

describe('where the window functions are scheduled', () => {
  it('registers the route in vercel.json after the sale-facts job and before the neighborhood job', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
      crons: { path: string; schedule: string }[]
    }
    const schedule = (path: string) => cfg.crons.find((c) => c.path === path)?.schedule
    expect(schedule('/api/cron/compute-market-metric-windows')).toBe('30 */6 * * *')
    expect(schedule('/api/cron/refresh-sale-pricing-facts')).toBe('20 */6 * * *')
    expect(schedule('/api/cron/compute-neighborhood-metrics')).toBe('40 */6 * * *')
  })

  it('no longer runs them from the sale-facts route, where a failed shadow call skipped them', () => {
    const source = readFileSync(join(ROOT, 'app/api/cron/refresh-sale-pricing-facts/route.ts'), 'utf8')
    for (const fn of FUNCTIONS) {
      expect(source, fn).not.toContain(`rpc('${fn}'`)
    }
    expect(source).toContain("rpc('compute_market_metrics_shadow')")
  })
})
