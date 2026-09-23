/**
 * Daily GA4 tracking-health guard (owner directive 2026-09-23, visibility audit
 * gsc-trend-8 / TRACK-2). Pure: numbers in, verdict and rows out. The GA4
 * snapshot cron (app/api/cron/marketing-snapshot-ga4) feeds it and writes the
 * rows; scripts/loop-brief.ts watches them through lib/data/loop/silent-zero.ts.
 *
 * WHY. The browser GA4 stream died twice in five weeks and nothing noticed for
 * days: 2026-08-19..08-31 after the 08-18 GTM/consent commits, and from
 * 2026-09-18 after the GTM bootstrap parse error. Exact GA4 Data API counts
 * (pulled 2026-09-23, eventName session_start by date): 64 on 09-16, 11 on
 * 09-17, 1 on 09-18, 0 on every day 09-19..09-22. Meanwhile GA4 has attributed
 * 0 to 9 google/organic sessions a week since 2026-07-13 while Search Console
 * reported 71 to 151 clicks. Both are visible in data GA4 already returns; they
 * were just never compared to anything.
 *
 * CHECK 1 — browser session_start > 0 for the day. session_start and
 * first_visit are reserved names Measurement Protocol cannot send, so they come
 * only from the browser tag: the MP page-view mirror cannot mask an outage
 * here. Live days 09-10..09-17 carried 5 to 65 session_start events (same exact
 * pull), so at September traffic a zero day is an outage, not a quiet day. In
 * the quiet first week of August one live day did read 0 (2026-08-09, between
 * 2 and 16), so a single red day at that volume is worth one look, not a panic.
 *
 * CHECK 2 — GA4 google/organic sessions / GSC clicks over a rolling 7-day
 * window, at or above ORGANIC_TO_GSC_FLOOR. Evidence for the floor: exact GA4
 * Data API google / organic sessions by date (sessionSourceMedium, pulled
 * 2026-09-23) against marketing_channel_daily gsc account clicks, every 7-day
 * window from 2026-05-07 to 2026-09-22:
 *   - windows ending 06-05..07-12 (GA4 organic working, 66 to 153 clicks each)
 *     read 0.178 to 0.529; lowest 0.178 (06-06, 13/73);
 *   - windows ending 07-18..09-20 (organic attribution broken) read 0.000 to
 *     0.104; highest 0.104 (07-21, 13/125).
 *   A floor of 0.15 sits in the gap, so it fails every broken window and passes
 *   every working one; it would have flagged the mid-July break on 07-15
 *   (0.138). The gsc-trend-8 fix and the p08 follow-up named 0.4. That is kept
 *   as ORGANIC_TO_GSC_TARGET and reported in the row metadata (below_target),
 *   but it is NOT the failure line: 30 of the 38 working windows read below 0.4,
 *   and an alarm that is red on a working day trains everyone to ignore it
 *   (Matt 2026-09-23: a rule that keeps us from the goal gets changed on
 *   evidence).
 * The window ends at least SETTLED_GSC_LAG_DAYS before the run: Search Console
 * keeps settling for days and wrote a false 0 for 2026-09-20 on 09-22.
 */

export const ORGANIC_TO_GSC_FLOOR = 0.15
export const ORGANIC_TO_GSC_TARGET = 0.4
export const ORGANIC_WINDOW_DAYS = 7
/**
 * Fewest GSC clicks a window needs before the ratio is judged. Small windows
 * swing: May windows with 20 to 27 clicks read anywhere from 0.000 to 1.500
 * with the tag running. Every working window at 66+ clicks stayed inside
 * 0.178..0.529, so 50 is the line below which a reading is not judged.
 */
export const ORGANIC_MIN_GSC_CLICKS = 50
/** A GSC day younger than this is not used (processing and settling lag). */
export const SETTLED_GSC_LAG_DAYS = 3

export const HEALTH_METRIC = 'tracking_health_ok'
export const ORGANIC_RATIO_METRIC = 'organic_to_gsc_click_ratio_7d'
export const GOOGLE_ORGANIC_SESSIONS_METRIC = 'google_organic_sessions'

export type DailyCount = { date: string; value: number }

export type OrganicWindow = {
  start: string
  end: string
  ga4GoogleOrganicSessions: number
  gscClicks: number
  pairedDays: number
  ratio: number | null
  status: 'ok' | 'below-floor' | 'insufficient' | 'pending'
}

export type Ga4HealthVerdict = {
  date: string
  ok: boolean
  failures: string[]
  browserSessionStart: number
  browserFirstVisit: number
  organic: OrganicWindow
}

export function isoAddDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * The 7-day organic comparison ending at `date`, using only days where BOTH a
 * GA4 google_organic_sessions row and a settled GSC clicks row exist. Days
 * after `today - SETTLED_GSC_LAG_DAYS` are never used; if that leaves the
 * window ending before `date`, the check is 'pending' for this date and is
 * judged on a later run (the cron re-pulls a settle window every day).
 */
export function evaluateOrganicWindow(input: {
  date: string
  today: string
  ga4GoogleOrganic: DailyCount[]
  gscClicks: DailyCount[]
}): OrganicWindow {
  const start = isoAddDays(input.date, -(ORGANIC_WINDOW_DAYS - 1))
  const end = input.date
  const settledThrough = isoAddDays(input.today, -SETTLED_GSC_LAG_DAYS)
  const base = { start, end, ga4GoogleOrganicSessions: 0, gscClicks: 0, pairedDays: 0, ratio: null }
  if (end > settledThrough) return { ...base, status: 'pending' }

  const ga4 = new Map(input.ga4GoogleOrganic.map((r) => [r.date, r.value]))
  let sessions = 0
  let clicks = 0
  let paired = 0
  for (const g of input.gscClicks) {
    if (g.date < start || g.date > end) continue
    const s = ga4.get(g.date)
    if (s === undefined) continue
    sessions += s
    clicks += g.value
    paired += 1
  }
  const window = { start, end, ga4GoogleOrganicSessions: sessions, gscClicks: clicks, pairedDays: paired }
  if (clicks < ORGANIC_MIN_GSC_CLICKS) return { ...window, ratio: null, status: 'insufficient' }
  const ratio = sessions / clicks
  return { ...window, ratio, status: ratio < ORGANIC_TO_GSC_FLOOR ? 'below-floor' : 'ok' }
}

export function evaluateGa4TrackingHealth(input: {
  date: string
  today: string
  browserSessionStart: number
  browserFirstVisit: number
  ga4GoogleOrganic: DailyCount[]
  gscClicks: DailyCount[]
}): Ga4HealthVerdict {
  const failures: string[] = []
  if (!(input.browserSessionStart > 0)) {
    failures.push(
      'browser session_start was 0: the GTM/GA4 tag did not run in any browser that day (Measurement Protocol cannot send session_start, so the page-view mirror cannot hide this)',
    )
  }
  const organic = evaluateOrganicWindow(input)
  if (organic.status === 'below-floor' && organic.ratio !== null) {
    failures.push(
      `GA4 google / organic sessions were ${organic.ratio.toFixed(3)}x Search Console clicks over ${organic.start}..${organic.end} ` +
        `(${organic.ga4GoogleOrganicSessions} sessions / ${organic.gscClicks} clicks; floor ${ORGANIC_TO_GSC_FLOOR}x): GA4 is not attributing organic search`,
    )
  }
  return {
    date: input.date,
    ok: failures.length === 0,
    failures,
    browserSessionStart: input.browserSessionStart,
    browserFirstVisit: input.browserFirstVisit,
    organic,
  }
}

type HealthRow = {
  date: string
  channel: 'ga4'
  scope: 'account'
  scope_id: ''
  metric: string
  value: number
  metadata: Record<string, unknown>
  source: string
}

/**
 * The stored form: one tracking_health_ok row (1 or 0) per day, plus the 7-day
 * ratio when it was judged. Both land in site_signal (a view over
 * marketing_channel_daily), so the loop and any reader see the same verdict.
 */
export function healthRows(v: Ga4HealthVerdict, source: string): HealthRow[] {
  const base = { date: v.date, channel: 'ga4' as const, scope: 'account' as const, scope_id: '' as const, source }
  const rows: HealthRow[] = [
    {
      ...base,
      metric: HEALTH_METRIC,
      value: v.ok ? 1 : 0,
      metadata: {
        failures: v.failures,
        browser_session_start: v.browserSessionStart,
        browser_first_visit: v.browserFirstVisit,
        organic: {
          status: v.organic.status,
          window: `${v.organic.start}..${v.organic.end}`,
          ga4_google_organic_sessions: v.organic.ga4GoogleOrganicSessions,
          gsc_clicks: v.organic.gscClicks,
          paired_days: v.organic.pairedDays,
          ratio: v.organic.ratio,
          floor: ORGANIC_TO_GSC_FLOOR,
          target: ORGANIC_TO_GSC_TARGET,
          below_target: v.organic.ratio !== null && v.organic.ratio < ORGANIC_TO_GSC_TARGET,
        },
      },
    },
  ]
  if (v.organic.ratio !== null) {
    rows.push({
      ...base,
      metric: ORGANIC_RATIO_METRIC,
      value: Number(v.organic.ratio.toFixed(4)),
      metadata: {
        window: `${v.organic.start}..${v.organic.end}`,
        ga4_google_organic_sessions: v.organic.ga4GoogleOrganicSessions,
        gsc_clicks: v.organic.gscClicks,
        floor: ORGANIC_TO_GSC_FLOOR,
        target: ORGANIC_TO_GSC_TARGET,
      },
    })
  }
  return rows
}
