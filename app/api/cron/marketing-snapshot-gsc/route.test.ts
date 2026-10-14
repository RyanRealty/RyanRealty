import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The GSC snapshot must never store a day Google has not reported. On
 * 2026-10-14 the cron wrote 2026-10-12 as all zeros (Search Console's final
 * data ran through 10-11), and the admin page read it as a 24% click drop.
 */

const getSearchConsoleSummary = vi.fn()
const getSearchConsoleReportedThrough = vi.fn()
const upsertMetricRows = vi.fn()

vi.mock('@/app/actions/search-console-report', () => ({
  getSearchConsoleSummary: (...a: unknown[]) => getSearchConsoleSummary(...a),
  getSearchConsoleReportedThrough: (...a: unknown[]) => getSearchConsoleReportedThrough(...a),
}))
vi.mock('@/lib/marketing-brain/snapshot', async (orig) => ({
  ...(await orig<typeof import('@/lib/marketing-brain/snapshot')>()),
  upsertMetricRows: (...a: unknown[]) => upsertMetricRows(...a),
}))

const summary = {
  ok: true,
  data: { clicks: 10, impressions: 800, ctr: 0.0125, position: 14.2, topQueries: [], topPages: [] },
}

const req = (qs = '', auth = 'Bearer test-secret') =>
  new Request(`https://ryan-realty.com/api/cron/marketing-snapshot-gsc${qs}`, {
    headers: auth ? { authorization: auth } : {},
  })

type Row = { date: string; metric: string; scope: string; value: number }
const writtenDays = () =>
  [...new Set(upsertMetricRows.mock.calls.flatMap(([rows]) => (rows as Row[]).map((r) => r.date)))].sort()

describe('/api/cron/marketing-snapshot-gsc', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    getSearchConsoleSummary.mockResolvedValue(summary)
    upsertMetricRows.mockImplementation(async (rows: unknown[]) => rows.length)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('writes only the days Google has reported and lists the rest as pending', async () => {
    getSearchConsoleReportedThrough.mockResolvedValue({ ok: true, reportedThrough: '2026-10-11' })
    const { GET } = await import('./route')

    const res = await GET(req('?startDate=2026-10-05&endDate=2026-10-12') as never)
    const body = await res.json()

    expect(writtenDays()).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
    expect(getSearchConsoleSummary.mock.calls.map(([d]) => d)).not.toContain('2026-10-12')
    expect(body.reportedThrough).toBe('2026-10-11')
    expect(body.pending).toEqual(['2026-10-12'])
    expect(body.errors).toEqual([])
  })

  it('writes nothing when the reported-through probe fails', async () => {
    getSearchConsoleReportedThrough.mockResolvedValue({ ok: false, error: 'quota' })
    const { GET } = await import('./route')

    const res = await GET(req('?startDate=2026-10-05&endDate=2026-10-06') as never)
    const body = await res.json()

    expect(upsertMetricRows).not.toHaveBeenCalled()
    expect(getSearchConsoleSummary).not.toHaveBeenCalled()
    expect(body.pending).toEqual(['2026-10-05', '2026-10-06'])
    expect(body.errors).toEqual(['reported-through probe: quota'])
  })

  it('writes nothing when Google has reported no day at all', async () => {
    getSearchConsoleReportedThrough.mockResolvedValue({ ok: true, reportedThrough: null })
    const { GET } = await import('./route')

    await GET(req('?startDate=2026-10-05&endDate=2026-10-06') as never)

    expect(upsertMetricRows).not.toHaveBeenCalled()
  })

  it('stores a reported day with no Search Console rows as a real zero day', async () => {
    getSearchConsoleReportedThrough.mockResolvedValue({ ok: true, reportedThrough: '2026-10-11' })
    getSearchConsoleSummary.mockResolvedValue({
      ok: true,
      data: { clicks: 0, impressions: 0, ctr: 0, position: 0, topQueries: [], topPages: [] },
    })
    const { GET } = await import('./route')

    await GET(req('?startDate=2026-10-11&endDate=2026-10-11') as never)

    const rows = upsertMetricRows.mock.calls[0][0] as Row[]
    expect(rows.find((r) => r.metric === 'impressions')).toMatchObject({ date: '2026-10-11', value: 0 })
  })

  it('the default window is today-9..today-2 and still skips unreported days', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T12:20:00Z'))
    try {
      getSearchConsoleReportedThrough.mockResolvedValue({ ok: true, reportedThrough: '2026-10-11' })
      const { GET } = await import('./route')

      const body = await (await GET(req() as never)).json()

      expect(body.startDate).toBe('2026-10-05')
      expect(body.endDate).toBe('2026-10-12')
      expect(body.pending).toEqual(['2026-10-12'])
      expect(writtenDays().at(-1)).toBe('2026-10-11')
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses a request without the cron secret and asks Google nothing', async () => {
    const { GET } = await import('./route')

    const res = await GET(req('', '') as never)

    expect(res.status).toBe(401)
    expect(getSearchConsoleReportedThrough).not.toHaveBeenCalled()
  })
})
