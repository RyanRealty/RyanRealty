import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every Gmail call pollMarketingInbox makes (list, get, modify) shares one
 * client that must carry MARKETING_INBOX_REQUEST_TIMEOUT_MS: the cron loops over
 * up to 50 messages inside its 60 s route, so one stalled call must fail fast,
 * not eat the tick. The auth deadline lives in inbox-auth.ts and is pinned by
 * inbox-auth.test.ts.
 */

const h = vi.hoisted(() => ({
  getReadAuth: vi.fn(),
  getSendAuth: vi.fn(),
  gmailCtor: vi.fn(),
  list: vi.fn(),
}))

vi.mock('./inbox-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./inbox-auth')>()),
  getReadAuth: h.getReadAuth,
  getSendAuth: h.getSendAuth,
}))

vi.mock('googleapis', () => ({
  google: {
    gmail: (opts: unknown) => {
      h.gmailCtor(opts)
      return { users: { messages: { list: h.list, get: vi.fn(), modify: vi.fn() } } }
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({}) }),
}))

import { MARKETING_INBOX_REQUEST_TIMEOUT_MS } from './inbox-reply'
import { pollMarketingInbox } from './inbox-poll'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FAKE_JWT = {} as any

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('pollMarketingInbox Gmail client', () => {
  it('carries the per-request deadline shared by list/get/modify', async () => {
    h.getReadAuth.mockResolvedValue({ ok: true, client: FAKE_JWT, error: null })
    h.getSendAuth.mockResolvedValue({ ok: true, client: FAKE_JWT, error: null })
    h.list.mockResolvedValue({ data: { messages: [] } })

    const report = await pollMarketingInbox()

    expect(report.status).toBe('ok')
    expect(h.gmailCtor).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v1', auth: FAKE_JWT, timeout: MARKETING_INBOX_REQUEST_TIMEOUT_MS }),
    )
  })
})
