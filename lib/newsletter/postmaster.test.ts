import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getPostmasterAuth built its JWT and called authorize() with no timeout at
 * all (the same gap lib/gmail-draft.ts had before its fix), so a stalled
 * token endpoint hung the postmaster-sync cron for good. Both the transporter
 * timeout on the JWT and the explicit race on authorize() are pinned here.
 * getPostmasterStats' client needs its own per-request timeout: the cron loops
 * over 3 domains, each isolated by its own try/catch, inside a 60 s route.
 */

const h = vi.hoisted(() => ({
  jwtCtor: vi.fn(),
  authorize: vi.fn(),
  pmCtor: vi.fn(),
  list: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: class {
        authorize = h.authorize
        constructor(opts: unknown) {
          h.jwtCtor(opts)
        }
      },
    },
    gmailpostmastertools: (opts: unknown) => {
      h.pmCtor(opts)
      return { domains: { trafficStats: { list: h.list } } }
    },
  },
}))

import { GOOGLE_AUTH_TIMEOUT_MS } from '@/lib/google-deadline'
import { getPostmasterAuth, getPostmasterStats, POSTMASTER_REQUEST_TIMEOUT_MS } from './postmaster'
import type { JWT } from 'google-auth-library'

beforeEach(() => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.authorize.mockResolvedValue({ access_token: 'ya29.test' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('getPostmasterAuth deadline', () => {
  it('gives the JWT a transporter timeout', async () => {
    await getPostmasterAuth()

    expect(h.jwtCtor).toHaveBeenCalledWith(
      expect.objectContaining({ transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS } }),
    )
  })

  it('gives up on a stalled authorize() at GOOGLE_AUTH_TIMEOUT_MS instead of hanging', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    h.authorize.mockReturnValue(new Promise(() => {})) // never resolves, the pre-fix hang

    const pending = getPostmasterAuth()
    let settled = false
    void pending.then(() => (settled = true))

    await vi.advanceTimersByTimeAsync(GOOGLE_AUTH_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    const res = await pending
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/timed out/i)
  })
})

describe('getPostmasterStats deadline', () => {
  it('gives the trafficStats client a per-request timeout', async () => {
    h.list.mockResolvedValue({ data: { trafficStats: [] } })

    await getPostmasterStats({} as JWT, 'ryan-realty.com', 7)

    expect(h.pmCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: POSTMASTER_REQUEST_TIMEOUT_MS }))
  })
})
