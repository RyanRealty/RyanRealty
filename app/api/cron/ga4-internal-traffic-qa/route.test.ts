import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fetchInternalTrafficQa = vi.fn()
const evaluateInternalTrafficQa = vi.fn()
const yesterdayInPropertyTz = vi.fn((..._a: unknown[]) => '2026-10-07')

vi.mock('@/lib/analytics/ga4-internal-traffic-qa', () => ({
  fetchInternalTrafficQa: (...a: unknown[]) => fetchInternalTrafficQa(...a),
  evaluateInternalTrafficQa: (...a: unknown[]) => evaluateInternalTrafficQa(...a),
  yesterdayInPropertyTz: (...a: unknown[]) => yesterdayInPropertyTz(...a),
}))

const req = (auth = 'Bearer test-secret') =>
  new NextRequest('https://ryan-realty.com/api/cron/ga4-internal-traffic-qa', {
    headers: auth ? { authorization: auth } : {},
  })

describe('/api/cron/ga4-internal-traffic-qa', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    fetchInternalTrafficQa.mockResolvedValue({
      ok: true,
      hosts: [{ hostName: 'ryan-realty.com', sessions: 4 }],
      browserVersions: [],
      formLead: { formStart: 0, generateLead: 0 },
    })
    evaluateInternalTrafficQa.mockReturnValue({ date: '2026-10-07', ok: true, flags: [] })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('refuses a request without the cron secret and does no work', async () => {
    const { GET } = await import('./route')
    const res = await GET(req(''))
    expect(res.status).toBe(401)
    expect(fetchInternalTrafficQa).not.toHaveBeenCalled()
  })

  it('returns the verdict JSON on an authorized run', async () => {
    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ date: '2026-10-07', ok: true, flags: [] })
    expect(fetchInternalTrafficQa).toHaveBeenCalledWith('2026-10-07')
  })
})
