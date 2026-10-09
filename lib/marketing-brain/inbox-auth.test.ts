import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The marketing-inbox cron authorizes twice per tick (read scope, then send
 * scope) before it touches a message. Neither JWT had a timeout, so a stalled
 * token endpoint hung the whole 60 s route. Both the transporter timeout on the
 * JWT and the explicit race on authorize() are pinned here, for both scopes.
 */

const h = vi.hoisted(() => ({
  jwtCtor: vi.fn(),
  authorize: vi.fn(),
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
  },
}))

import { GOOGLE_AUTH_TIMEOUT_MS } from '@/lib/google-deadline'
import { getReadAuth, getSendAuth, GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, MARKETING_INBOX_USER } from './inbox-auth'

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

describe.each([
  ['getReadAuth', getReadAuth, GMAIL_READ_SCOPE],
  ['getSendAuth', getSendAuth, GMAIL_SEND_SCOPE],
] as const)('%s deadline', (_name, getAuth, scope) => {
  it('gives the JWT a transporter timeout, impersonating the marketing inbox', async () => {
    const res = await getAuth()

    expect(res.ok).toBe(true)
    expect(h.jwtCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: [scope],
        subject: MARKETING_INBOX_USER,
        transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS },
      }),
    )
  })

  it('gives up on a stalled authorize() at GOOGLE_AUTH_TIMEOUT_MS instead of hanging', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    h.authorize.mockReturnValue(new Promise(() => {})) // never resolves, the pre-fix hang

    const pending = getAuth()
    let settled = false
    void pending.then(() => (settled = true))

    await vi.advanceTimersByTimeAsync(GOOGLE_AUTH_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    const res = await pending
    expect(res.ok).toBe(false)
    expect(res.client).toBeNull()
    expect(res.error).toMatch(/Gmail auth timed out/)
    // A timeout is not a missing DWD scope, so no allowlist hint.
    expect(res.hint).toBeUndefined()
  })

  it('still names the DWD allowlist when Google refuses the scope', async () => {
    h.authorize.mockRejectedValue(new Error('unauthorized_client: Client is unauthorized'))

    const res = await getAuth()

    expect(res.ok).toBe(false)
    expect(res.hint).toMatch(/Domain-wide delegation/)
  })
})
