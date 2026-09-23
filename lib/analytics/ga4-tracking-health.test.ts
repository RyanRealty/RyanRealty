import { describe, expect, it } from 'vitest'
import {
  evaluateGa4TrackingHealth,
  evaluateOrganicWindow,
  healthRows,
  isoAddDays,
  HEALTH_METRIC,
  ORGANIC_RATIO_METRIC,
  ORGANIC_TO_GSC_FLOOR,
  ORGANIC_TO_GSC_TARGET,
  type DailyCount,
} from './ga4-tracking-health'

/** n consecutive days ending at `end`, each with `value`. */
function days(end: string, n: number, value: number): DailyCount[] {
  return Array.from({ length: n }, (_, i) => ({ date: isoAddDays(end, -(n - 1 - i)), value }))
}

const TODAY = '2026-09-23'

describe('check 1: browser session_start', () => {
  // TRACK-2: 09-19 onward had no session_start row at all while page_view (the
  // MP mirror) kept landing. That day must read unhealthy.
  it('fails a day with zero browser session_start', () => {
    const v = evaluateGa4TrackingHealth({
      date: '2026-09-19',
      today: TODAY,
      browserSessionStart: 0,
      browserFirstVisit: 0,
      ga4GoogleOrganic: [],
      gscClicks: [],
    })
    expect(v.ok).toBe(false)
    expect(v.failures[0]).toContain('session_start was 0')
  })

  it('passes a quiet but live day (09-13 carried 5 session_start)', () => {
    const v = evaluateGa4TrackingHealth({
      date: '2026-09-22',
      today: TODAY,
      browserSessionStart: 5,
      browserFirstVisit: 3,
      ga4GoogleOrganic: [],
      gscClicks: [],
    })
    expect(v.ok).toBe(true)
    expect(v.organic.status).toBe('pending')
  })
})

describe('check 2: GA4 organic vs Search Console clicks', () => {
  it('flags the post-July state (1 organic session against 123 clicks)', () => {
    const w = evaluateOrganicWindow({
      date: '2026-09-20',
      today: TODAY,
      ga4GoogleOrganic: [...days('2026-09-19', 6, 0), { date: '2026-09-20', value: 1 }],
      gscClicks: days('2026-09-20', 7, 17),
    })
    expect(w.status).toBe('below-floor')
    expect(w.gscClicks).toBe(119)
    expect(w.ga4GoogleOrganicSessions).toBe(1)
    expect(w.pairedDays).toBe(7)
  })

  // The two edges of the evidence (exact GA4 Data API google / organic sessions
  // vs stored GSC clicks, pulled 2026-09-23): the lowest working window and the
  // highest broken one. The floor must sit between them.
  it('passes the lowest working window (ending 06-06: 13 sessions / 73 clicks = 0.178)', () => {
    const ga4 = days('2026-06-06', 7, 0)
    ga4[0].value = 13
    const w = evaluateOrganicWindow({ date: '2026-06-06', today: TODAY, ga4GoogleOrganic: ga4, gscClicks: [...days('2026-06-05', 6, 10), { date: '2026-06-06', value: 13 }] })
    expect(w.gscClicks).toBe(73)
    expect(w.ratio).toBeCloseTo(0.178, 3)
    expect(w.status).toBe('ok')
  })

  it('fails the highest broken window (ending 07-21: 13 sessions / 125 clicks = 0.104)', () => {
    const ga4 = days('2026-07-21', 7, 0)
    ga4[3].value = 13
    const w = evaluateOrganicWindow({ date: '2026-07-21', today: TODAY, ga4GoogleOrganic: ga4, gscClicks: [...days('2026-07-20', 6, 18), { date: '2026-07-21', value: 17 }] })
    expect(w.gscClicks).toBe(125)
    expect(w.ratio).toBeCloseTo(0.104, 3)
    expect(w.status).toBe('below-floor')
  })

  it('keeps the floor between the two bands and the 0.4 target out of the failure line', () => {
    expect(ORGANIC_TO_GSC_FLOOR).toBeGreaterThan(13 / 125)
    expect(ORGANIC_TO_GSC_FLOOR).toBeLessThan(13 / 73)
    expect(ORGANIC_TO_GSC_TARGET).toBe(0.4)
    // A working window below the 0.4 target (06-29: 47 / 145 = 0.324) passes
    // the check and is marked below_target in the stored metadata.
    const ga4 = days('2026-06-29', 7, 0)
    ga4[6].value = 47
    const v = evaluateGa4TrackingHealth({
      date: '2026-06-29',
      today: TODAY,
      browserSessionStart: 9,
      browserFirstVisit: 3,
      ga4GoogleOrganic: ga4,
      gscClicks: [...days('2026-06-28', 6, 20), { date: '2026-06-29', value: 25 }],
    })
    expect(v.ok).toBe(true)
    expect((healthRows(v, 'ga4_data_api')[0].metadata.organic as { below_target: boolean }).below_target).toBe(true)
  })

  it('does not judge a window that ends inside the Search Console settle lag', () => {
    // 09-22 run wrote gsc clicks 0 for 09-20: that day was not settled yet.
    const w = evaluateOrganicWindow({ date: '2026-09-21', today: TODAY, ga4GoogleOrganic: days('2026-09-21', 7, 0), gscClicks: days('2026-09-21', 7, 20) })
    expect(w.status).toBe('pending')
    expect(w.ratio).toBeNull()
  })

  it('does not judge a window with too few clicks to separate noise from an outage', () => {
    const w = evaluateOrganicWindow({ date: '2026-09-20', today: TODAY, ga4GoogleOrganic: days('2026-09-20', 7, 0), gscClicks: days('2026-09-20', 7, 5) })
    expect(w.status).toBe('insufficient')
  })

  it('uses only days present on BOTH sides (a missing GA4 day is not a zero)', () => {
    const w = evaluateOrganicWindow({
      date: '2026-09-20',
      today: TODAY,
      ga4GoogleOrganic: [{ date: '2026-09-20', value: 9 }, { date: '2026-09-19', value: 8 }, { date: '2026-09-18', value: 7 }],
      gscClicks: days('2026-09-20', 7, 20),
    })
    expect(w.pairedDays).toBe(3)
    expect(w.gscClicks).toBe(60)
    expect(w.ga4GoogleOrganicSessions).toBe(24)
    expect(w.status).toBe('ok')
  })

  it('a below-floor window fails the day even when session_start is healthy', () => {
    const v = evaluateGa4TrackingHealth({
      date: '2026-09-20',
      today: TODAY,
      browserSessionStart: 80,
      browserFirstVisit: 60,
      ga4GoogleOrganic: days('2026-09-20', 7, 0),
      gscClicks: days('2026-09-20', 7, 17),
    })
    expect(v.ok).toBe(false)
    expect(v.failures).toHaveLength(1)
    expect(v.failures[0]).toContain('google / organic')
  })
})

describe('healthRows', () => {
  it('writes 0/1 health plus the ratio when judged', () => {
    const v = evaluateGa4TrackingHealth({
      date: '2026-09-20',
      today: TODAY,
      browserSessionStart: 0,
      browserFirstVisit: 0,
      ga4GoogleOrganic: days('2026-09-20', 7, 0),
      gscClicks: days('2026-09-20', 7, 17),
    })
    const rows = healthRows(v, 'ga4_data_api')
    expect(rows.map((r) => [r.metric, r.value])).toEqual([
      [HEALTH_METRIC, 0],
      [ORGANIC_RATIO_METRIC, 0],
    ])
    expect(rows[0]).toMatchObject({ channel: 'ga4', scope: 'account', scope_id: '', date: '2026-09-20' })
    expect((rows[0].metadata.failures as string[]).length).toBe(2)
    expect((rows[0].metadata.organic as { below_target: boolean }).below_target).toBe(true)
  })

  it('omits the ratio row while the organic check is pending', () => {
    const v = evaluateGa4TrackingHealth({ date: '2026-09-22', today: TODAY, browserSessionStart: 40, browserFirstVisit: 20, ga4GoogleOrganic: [], gscClicks: [] })
    expect(healthRows(v, 'ga4_data_api').map((r) => r.metric)).toEqual([HEALTH_METRIC])
  })
})
