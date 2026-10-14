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
import { getSearchConsoleReportedThrough, getSearchConsoleSummary } from './search-console-report'

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

describe('final data only', () => {
  it('every summary query asks for final data, the same state the reported-through probe reads', async () => {
    await getSearchConsoleSummary('2026-10-11', '2026-10-11')

    for (const [req] of h.query.mock.calls) {
      expect(req.requestBody.dataState).toBe('final')
    }
  })
})

describe('getSearchConsoleReportedThrough', () => {
  it('returns the latest final date Google reports, from one date-grouped query', async () => {
    h.query.mockResolvedValueOnce({
      data: {
        rows: [
          { keys: ['2026-10-10'], impressions: 855 },
          { keys: ['2026-10-11'], impressions: 823 },
        ],
      },
    })

    const res = await getSearchConsoleReportedThrough()

    expect(res).toMatchObject({ ok: true, reportedThrough: '2026-10-11' })
    expect(h.query).toHaveBeenCalledTimes(1)
    const [req] = h.query.mock.calls[0]
    expect(req.requestBody).toMatchObject({ dimensions: ['date'], dataState: 'final' })
  })

  it('is null, not a date, when Google returns no rows', async () => {
    h.query.mockResolvedValueOnce({ data: {} })

    const res = await getSearchConsoleReportedThrough()

    expect(res).toMatchObject({ ok: true, reportedThrough: null })
  })

  it('fails closed on an API error so the cron stores nothing', async () => {
    h.query.mockRejectedValueOnce(new Error('quota'))

    expect(await getSearchConsoleReportedThrough()).toEqual({ ok: false, error: 'quota' })
  })

  it('reports SEARCH_CONSOLE_NOT_CONFIGURED without credentials', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '')

    expect(await getSearchConsoleReportedThrough()).toEqual({ ok: false, error: 'SEARCH_CONSOLE_NOT_CONFIGURED' })
    expect(h.query).not.toHaveBeenCalled()
  })
})
