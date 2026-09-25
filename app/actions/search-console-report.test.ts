import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getSearchConsoleSummary's JWT and webmasters client must each carry a
 * deadline: google-auth-library gives the token POST none of its own (the gap
 * lib/gmail-draft.ts fixed first), and DashboardSitePerformancePanel renders
 * this inline with no maxDuration override of its own, so a stalled query must
 * fail fast rather than hang the admin page.
 */

const h = vi.hoisted(() => ({
  jwtCtor: vi.fn(),
  webmastersCtor: vi.fn(),
  query: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: class {
        constructor(opts: unknown) {
          h.jwtCtor(opts)
        }
      },
    },
    webmasters: (opts: unknown) => {
      h.webmastersCtor(opts)
      return { searchanalytics: { query: h.query } }
    },
  },
}))

import { GOOGLE_AUTH_TIMEOUT_MS } from '@/lib/google-deadline'
import { getSearchConsoleSummary } from './search-console-report'

beforeEach(() => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.query.mockResolvedValue({ data: { rows: [] } })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('getSearchConsoleSummary deadlines', () => {
  it('gives the service-account JWT a transporter timeout', async () => {
    const res = await getSearchConsoleSummary('2026-08-01', '2026-08-28')

    expect(res.ok).toBe(true)
    expect(h.jwtCtor).toHaveBeenCalledWith(
      expect.objectContaining({ transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS } }),
    )
  })

  it('gives the webmasters client a per-request timeout', async () => {
    await getSearchConsoleSummary('2026-08-01', '2026-08-28')

    // SEARCH_CONSOLE_REQUEST_TIMEOUT_MS stays private to the module: a
    // 'use server' file may only export async functions, so this pins the
    // literal it must equal instead of importing the constant.
    expect(h.webmastersCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10_000 }))
  })

  it('makes exactly the 3 parallel queries (summary, top queries, top pages)', async () => {
    await getSearchConsoleSummary('2026-08-01', '2026-08-28')

    expect(h.query).toHaveBeenCalledTimes(3)
  })
})
