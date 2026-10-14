import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * /admin/analytics/demographics errored on every load until 2026-10-14: the
 * age x source report paired userAgeBracket with sessionSourceMedium, GA4
 * rejected it as incompatible, and Promise.all turned that one rejection into
 * a page error. These tests pin the compatible dimension, per-report failure,
 * and the withheld state for thresholded age and gender.
 */

const h = vi.hoisted(() => ({ runReport: vi.fn() }))

vi.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: class {
    runReport = h.runReport
  },
}))

import { getGA4Demographics } from './ga4-demographics'

type Req = { dimensions?: Array<{ name: string }>; metrics: Array<{ name: string }>; dimensionFilter?: unknown }
const dims = (req: Req) => (req.dimensions ?? []).map((d) => d.name).join(',')

const withheld = { rows: [], metadata: { subjectToThresholding: true } }
const ok = (rows: Array<[string[], string[]]>) => ({
  rows: rows.map(([d, m]) => ({
    dimensionValues: d.map((value) => ({ value })),
    metricValues: m.map((value) => ({ value })),
  })),
  metadata: {},
})

/** GA4 as read live 2026-10-14: demographics thresholded away, geo and totals present. */
function liveLike(req: Req) {
  const d = dims(req)
  if (d.includes('userAgeBracket') && d.includes('sessionSourceMedium')) {
    return Promise.reject(
      Object.assign(new Error('3 INVALID_ARGUMENT'), {
        details: "Please remove userAgeBracket to make the request compatible. The request's dimensions & metrics are incompatible.",
      }),
    )
  }
  if (d.includes('userAgeBracket') || d.includes('userGender')) return Promise.resolve([withheld])
  if (d === 'city,region,country') return Promise.resolve([ok([[['Bend', 'Oregon', 'United States'], ['120', '150']]])])
  if (d === 'city,region') return Promise.resolve([{ rows: [], metadata: {} }])
  if (d === '' && req.dimensionFilter) return Promise.resolve([{ rows: [], metadata: {} }])
  if (d === '') return Promise.resolve([ok([[[], ['1500']]])])
  return Promise.resolve([{ rows: [] }])
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_GA4_PROPERTY_ID', '527333348')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.runReport.mockImplementation((req: Req) => liveLike(req))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('getGA4Demographics', () => {
  it('never pairs userAgeBracket with sessionSourceMedium; the cross-tab uses the default channel group', async () => {
    await getGA4Demographics('2026-09-14', '2026-10-13')

    const sent = h.runReport.mock.calls.map(([req]) => dims(req as Req))
    expect(sent.some((d) => d.includes('userAgeBracket') && d.includes('SourceMedium'))).toBe(false)
    expect(sent).toContain('userAgeBracket,sessionDefaultChannelGroup')
  })

  it('reports thresholded age and gender as withheld and still renders cities and totals', async () => {
    const res = await getGA4Demographics('2026-09-14', '2026-10-13')

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.ageBuckets).toEqual({ state: 'withheld' })
    expect(res.genders).toEqual({ state: 'withheld' })
    expect(res.sellerLpByAge).toEqual({ state: 'withheld' })
    expect(res.ageByChannel).toEqual({ state: 'withheld' })
    expect(res.topCities).toEqual({
      state: 'ok',
      rows: [{ city: 'Bend', region: 'Oregon', country: 'United States', users: 120, sessions: 150 }],
      partial: false,
    })
    expect(res.sellerLpByCity).toEqual({ state: 'empty' })
    expect(res.sellerLpTotals).toEqual({ state: 'empty' })
    expect(res.totalUsers).toBe(1500)
    expect(res.complete).toBe(true)
  })

  it('one rejected report is that section\'s error; the rest of the page survives and is not cached', async () => {
    h.runReport.mockImplementation((req: Req) =>
      dims(req) === 'userGender' ? Promise.reject(new Error('quota exceeded')) : liveLike(req),
    )

    const res = await getGA4Demographics('2026-09-14', '2026-10-13')

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.genders).toEqual({ state: 'error', error: 'quota exceeded' })
    expect(res.topCities.state).toBe('ok')
    expect(res.complete).toBe(false)
  })

  it('a failed total is null, never 0', async () => {
    h.runReport.mockImplementation((req: Req) =>
      dims(req) === '' && !req.dimensionFilter ? Promise.reject(new Error('quota exceeded')) : liveLike(req),
    )

    const res = await getGA4Demographics('2026-09-14', '2026-10-13')

    expect(res.ok && res.totalUsers).toBeNull()
  })

  it('every report failing is one page-level error', async () => {
    h.runReport.mockRejectedValue(Object.assign(new Error('7 PERMISSION_DENIED'), { details: 'User does not have sufficient permissions' }))

    expect(await getGA4Demographics('2026-09-14', '2026-10-13')).toEqual({
      ok: false,
      error: 'User does not have sufficient permissions',
    })
  })

  it('reports GA4_NOT_CONFIGURED without credentials and calls Google nothing', async () => {
    vi.stubEnv('GOOGLE_GA4_PROPERTY_ID', '')

    expect(await getGA4Demographics('2026-09-14', '2026-10-13')).toEqual({ ok: false, error: 'GA4_NOT_CONFIGURED' })
    expect(h.runReport).not.toHaveBeenCalled()
  })

  it('known age rows come back ok, partial when Google flagged thresholding', async () => {
    h.runReport.mockImplementation((req: Req) =>
      dims(req) === 'userAgeBracket' && !req.dimensionFilter
        ? Promise.resolve([
            {
              ...ok([
                [['55-64'], ['40', '52']],
                [['unknown'], ['900', '1100']],
              ]),
              metadata: { subjectToThresholding: true },
            },
          ])
        : liveLike(req),
    )

    const res = await getGA4Demographics('2026-09-14', '2026-10-13')

    expect(res.ok && res.ageBuckets).toEqual({
      state: 'ok',
      partial: true,
      rows: [
        { ageBracket: '55-64', users: 40, sessions: 52 },
        { ageBracket: 'unknown', users: 900, sessions: 1100 },
      ],
    })
  })
})
