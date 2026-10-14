import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * createGscQuery's JWT and Search Analytics client must each carry a deadline:
 * google-auth-library gives the token POST none of its own (the gap
 * lib/gmail-draft.ts fixed first), and the query itself is called in a page
 * loop (pullAllGscRows below, run from the 300 s api/cron/loop-weekly-measure)
 * that needs a per-page bound, not one overall timer.
 */
const h = vi.hoisted(() => ({
  jwtCtor: vi.fn(),
  scCtor: vi.fn(),
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
    searchconsole: (opts: unknown) => {
      h.scCtor(opts)
      return { searchanalytics: { query: h.query } }
    },
  },
}))

import { GOOGLE_AUTH_TIMEOUT_MS } from '@/lib/google-deadline'
import {
  addDays,
  chunkDateRange,
  createGscQuery,
  daysBetweenInclusive,
  isIsoDate,
  pullAllGscRows,
  settledEndDate,
  GSC_REQUEST_TIMEOUT_MS,
  type GscApiRow,
  type GscRequest,
} from './gsc-api'

describe('createGscQuery deadlines', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
    h.query.mockResolvedValue({ data: { rows: [] } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('gives the service-account JWT a transporter timeout', async () => {
    await createGscQuery()

    expect(h.jwtCtor).toHaveBeenCalledWith(
      expect.objectContaining({ transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS } }),
    )
  })

  it('gives the Search Analytics client a per-request timeout', async () => {
    const query = await createGscQuery()
    expect(h.scCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: GSC_REQUEST_TIMEOUT_MS }))

    await query!({ startDate: '2026-09-01', endDate: '2026-09-01', dimensions: ['page'] })
    expect(h.query).toHaveBeenCalledTimes(1)
  })

  it('returns null (never builds a client) when the service account is not configured', async () => {
    // Explicit empty stubs, not vi.unstubAllEnvs(): the ambient shell may carry
    // real Google service-account creds (unlike Supabase/Twilio/Resend, they
    // are not blanked by test/unit-no-live-services.ts), and this file's own
    // googleapis mock means that would still hit no network, but the point of
    // this case is the missing-config branch specifically.
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', '')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '')
    expect(await createGscQuery()).toBeNull()
    expect(h.jwtCtor).not.toHaveBeenCalled()
  })
})

function row(i: number): GscApiRow {
  return { keys: [`/p/${i}`], clicks: 0, impressions: 1, ctr: 0, position: 1 }
}

describe('pullAllGscRows: rowLimit 25,000 with startRow paging (TRACK-5)', () => {
  it('keeps asking until a short page comes back', async () => {
    const seen: GscRequest[] = []
    const total = 25_000 + 25_000 + 7
    const query = async (req: GscRequest) => {
      seen.push(req)
      const start = req.startRow ?? 0
      const n = Math.max(0, Math.min(req.rowLimit ?? 0, total - start))
      return Array.from({ length: n }, (_, i) => row(start + i))
    }
    const res = await pullAllGscRows(query, { startDate: '2026-09-01', endDate: '2026-09-02', dimensions: ['page'] })
    expect(res.rows).toHaveLength(total)
    expect(res.requests).toBe(3)
    expect(res.truncated).toBe(false)
    expect(seen.map((r) => [r.rowLimit, r.startRow])).toEqual([
      [25_000, 0],
      [25_000, 25_000],
      [25_000, 50_000],
    ])
  })

  it('stops at the runaway guard and says so', async () => {
    const query = async (req: GscRequest) => Array.from({ length: req.rowLimit ?? 0 }, (_, i) => row(i))
    const res = await pullAllGscRows(query, { startDate: '2026-09-01', endDate: '2026-09-01', dimensions: ['page'] }, { pageSize: 10, maxRows: 30 })
    expect(res.rows).toHaveLength(30)
    expect(res.truncated).toBe(true)
  })
})

describe('date helpers', () => {
  it('settled end is three days back (GSC processing lag, gsc-trend-12)', () => {
    expect(settledEndDate(new Date('2026-09-23T12:00:00Z'))).toBe('2026-09-20')
  })

  it('adds days across a month edge and counts inclusively', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(daysBetweenInclusive('2026-09-01', '2026-09-28')).toBe(28)
  })

  it('chunks an inclusive range without gaps or overlap', () => {
    expect(chunkDateRange('2026-09-01', '2026-09-30', 14)).toEqual([
      { startDate: '2026-09-01', endDate: '2026-09-14' },
      { startDate: '2026-09-15', endDate: '2026-09-28' },
      { startDate: '2026-09-29', endDate: '2026-09-30' },
    ])
    expect(chunkDateRange('2026-09-02', '2026-09-01', 7)).toEqual([])
  })

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-05-10')).toBe(true)
    expect(isIsoDate('2026-5-10')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
  })
})
