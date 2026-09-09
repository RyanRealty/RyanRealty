import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The intake kick (Matt 2026-09-09: "kick on intake") asks the worker for ONE
 * slug with the cron bearer, and nothing about it can fail the intake.
 */
describe('cmaBuildKickRequest', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
    vi.resetModules()
  })

  it('targets the worker route for exactly this slug with the cron bearer', async () => {
    process.env.CRON_SECRET = 'shh'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ryan-realty.com/'
    const { cmaBuildKickRequest } = await import('./kick')
    const req = cmaBuildKickRequest('CMA-1617-NW-8TH--v2')
    expect(req?.url).toBe('https://ryan-realty.com/api/cron/cma-build-worker?slug=cma-1617-nw-8th--v2&limit=1')
    expect(req?.headers.Authorization).toBe('Bearer shh')
  })

  it('does nothing without a secret or with a slug that is not one', async () => {
    delete process.env.CRON_SECRET
    const { cmaBuildKickRequest } = await import('./kick')
    expect(cmaBuildKickRequest('cma-1617')).toBeNull()
    process.env.CRON_SECRET = 'shh'
    vi.resetModules()
    const mod = await import('./kick')
    expect(mod.cmaBuildKickRequest('../x')).toBeNull()
  })

  it('kickCmaBuild is inert under the test runner and never throws', async () => {
    process.env.CRON_SECRET = 'shh'
    const fetchMock = vi.fn(() => Promise.reject(new Error('down')))
    vi.stubGlobal('fetch', fetchMock)
    const { kickCmaBuild } = await import('./kick')
    await expect(kickCmaBuild('cma-1617')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
