/**
 * Silent-zero detection — a feed that reports healthy while producing nothing.
 *
 * WHY THIS EXISTS. On 2026-08-26 four separate systems were found reporting
 * healthy while emitting fabricated numbers, and every one had passed every
 * freshness check for months:
 *
 *   - Instagram impressions: 869 consecutive days of 0. Meta had retired the
 *     metric; the API 400d, the error was caught, a 0 was written.
 *   - Facebook page + post impressions: the same, and worse — one retired
 *     metric name 400s the WHOLE request, so healthy metrics beside it were
 *     zeroed as collateral.
 *   - YouTube impressions: 0 while its views were real.
 *   - Grok image-to-video: every call failed for 8 days; the draft queue just
 *     stayed empty, which looks identical to a quiet week.
 *
 * The common shape: monitoring asked "did it run?" and the answer was yes.
 * Nobody asked "is what it produced possible?" A zero is indistinguishable
 * from a measurement, which is exactly what makes it dangerous — §0 treats a
 * published number as a claim, and a fabricated 0 is a false claim that no
 * freshness check can see.
 *
 * Pure: takes rows, returns verdicts. I/O lives in the caller.
 */

export type FeedWindow = {
  /** e.g. 'instagram', 'meta_page' */
  channel: string
  /**
   * e.g. 'account', 'event', 'page'. Part of the key since 2026-09-23 (TRACK-2):
   * with scope collapsed, ga4 `event_count` summed every event, so page_view
   * (the Measurement Protocol mirror) kept the pair non-zero while
   * session_start sat at zero for five days. Optional for callers that do not
   * split by scope; dormant/retired lookups stay channel:metric.
   */
  scope?: string
  /** e.g. 'impressions' */
  metric: string
  /** How many rows landed in the window. */
  rows: number
  /** Sum of every value in the window. */
  total: number
  /** Distinct non-zero values seen. A feed that only ever writes 0 has 0 here. */
  nonZeroRows: number
  /** Most recent date present, ISO. */
  latest: string | null
}

export type SilentZeroVerdict = FeedWindow & {
  verdict: 'silent-zero' | 'sparse' | 'healthy' | 'absent' | 'dormant' | 'retired'
  /** Written for a human deciding whether to act. */
  note: string
}

/**
 * Feeds whose zeros are KNOWN to be real, verified against the platform API.
 *
 * This list exists because of the guard's first false positive. It flagged every
 * YouTube account metric as a silent zero; probing the API directly returned
 * `rows: [[0, 0]]` — a genuine measured zero. The channel had 2 views in 30 days.
 * It is dormant, not broken.
 *
 * That is the limit of reading stored data: `0` from a real measurement and `0`
 * written after a caught error are the same byte. Only the upstream call can tell
 * them apart. So a feed only lands here after someone has ASKED the platform and
 * recorded the answer, and it carries the date that check was made — a channel
 * that wakes up should stop being excused.
 *
 * An alarm that fires forever on a known-true condition is the lead-alarm mistake:
 * it teaches the reader to ignore it, and then it cannot do its job when something
 * real breaks.
 */
export const KNOWN_DORMANT: Record<string, string> = {
  'youtube:*':
    'verified 2026-08-26 against the YouTube Analytics API: channel==MINE returns rows [[0,0]] ' +
    'for a single day and 2 views across 30 days. The channel is dormant; these zeros are real.',
  'x:*':
    'verified 2026-08-26: no tweets since 2026-08-16, so account-level daily engagement is ' +
    'genuinely 0. Post-scope impressions were REAL on all 23 posts that exist. X is idle, not broken.',
  'tiktok:*':
    'verified 2026-08-26: 3 videos, 15 followers, none posted inside the cron 30-day lookback, so ' +
    'no per-video rows are produced. following_count is 0 because the account follows nobody. Idle, not broken.',

  // The three below are MEASURED zeros, and the distinction is provable rather
  // than assumed: since the lag fix, a day Google has not computed is DROPPED.
  // So a stored GBP row exists only because Google returned an explicit "0".
  // Their neighbours on the same calls carry real numbers over the same window
  // (mobile_search 306, desktop_search 88, direction_requests 48), which rules
  // out a broken call.
  'gbp:business_bookings':
    'verified 2026-08-26: Google returns an explicit "0" across 52 days. The listing has no ' +
    'booking integration, so there is nothing to count. Real zero.',
  'gbp:business_conversations':
    'verified 2026-08-26: explicit "0" across 52 days. Business messaging is not enabled on the ' +
    'listing. Real zero.',
  'gbp:call_clicks':
    'verified 2026-08-26: explicit "0" across 52 days, while website_clicks on the same window is ' +
    '18 and direction_requests is 48. Nobody taps call from the listing. Real zero.',

  // Instagram/Facebook post engagement, verified against the live API 2026-08-26:
  // the same calls returned views 27/43/26/55 and reach 16/24/18/35 on those very
  // posts, so the calls work and the accounts are simply not being engaged with.
  'instagram:saved':
    'verified 2026-08-26 on the live API: saved=0 on all 5 recent media, while views (27/43/26/55) ' +
    'and reach (16/24/18/35) on the same call are real. Nobody is saving the posts. Real zero.',
  'meta_page:post_clicks':
    'verified 2026-08-26 on the live API: 0 across all 10 recent posts, while post_video_views on ' +
    'the same call is non-zero on two of them. Real zero.',
  'meta_page:post_reactions_by_type_total':
    'verified 2026-08-26 on the live API: the reactions object comes back EMPTY ({}) for all 10 ' +
    'recent posts, which sums to a true 0 rather than a failed read. Real zero.',
}

/**
 * Metric names the PLATFORM has retired, whose historical rows are fabricated.
 *
 * This is a different animal from KNOWN_DORMANT and must not be confused with it.
 * A dormant feed's zeros are REAL measurements of a quiet account. A retired
 * metric's zeros were never measured at all: the API 400d on the name, the error
 * was caught, and a 0 was written. Every stored row for these is a false claim
 * under §0, and no future row will be written — the pipeline stopped asking.
 *
 * Verified 2026-08-26 by asking the live API for each name ALONE, and confirmed
 * against write timestamps: rows for these names stop at the last pre-fix cron
 * run, while every metric beside them carries the post-fix timestamp.
 *
 * They are listed so the guard NAMES them instead of reporting them as a live
 * defect to chase every session. The historical rows are a separate cleanup
 * decision — deleting production data is Matt's call, not the guard's.
 */
export const RETIRED_METRICS: Record<string, string> = {
  'instagram:impressions':
    'retired by Meta at Graph v22. Replaced by `views`, which is now published. ' +
    'Asking for this name 400s the whole batch, which is what zeroed reach and saved beside it.',
  'instagram:engagement':
    'retired by Meta at Graph v22 — superseded by `total_interactions`, which is now published.',
  'meta_page:post_impressions':
    'retired at post scope, along with every variant tried alone (_unique, _organic, post_activity). ' +
    'There is NO post-level reach or impressions at this API version, so none is published rather than a stand-in.',
  'meta_page:post_engaged_users':
    'retired at post scope. `post_clicks`, `post_reactions_like_total` and `post_video_views` survive and are published.',
}

function retiredReason(channel: string, metric: string): string | null {
  return RETIRED_METRICS[`${channel}:${metric}`] ?? null
}

function dormantReason(channel: string, metric: string): string | null {
  return KNOWN_DORMANT[`${channel}:${metric}`] ?? KNOWN_DORMANT[`${channel}:*`] ?? null
}

/**
 * A feed is a SILENT ZERO when it is landing rows on schedule and every one of
 * them is 0. That combination cannot happen by chance over a long window on a
 * live account, and it is the exact signature of an upstream call that fails
 * and is caught.
 *
 * `minRows` guards against calling a genuinely quiet two-day-old feed broken.
 * A real zero — nobody engaged that day — is normal in ones and twos; hundreds
 * of consecutive zeros is a defect.
 */
export function classifyFeed(w: FeedWindow, minRows = 14): SilentZeroVerdict {
  if (w.rows === 0) {
    return { ...w, verdict: 'absent', note: 'no rows in the window — the feed is not landing at all' }
  }
  if (w.rows < minRows) {
    return { ...w, verdict: 'sparse', note: `only ${w.rows} rows — too few to judge` }
  }
  if (w.nonZeroRows === 0) {
    // Retired is checked first: these rows are fabricated, not measured, so
    // calling them "dormant" (zeros are real) would be exactly backwards.
    const retired = retiredReason(w.channel, w.metric)
    if (retired) {
      return {
        ...w,
        verdict: 'retired',
        note:
          `metric retired upstream — ${retired} No new rows are written. The ${w.rows} stored ` +
          `rows were never measured; treat them as absent, not as zeros.`,
      }
    }
    const dormant = dormantReason(w.channel, w.metric)
    if (dormant) {
      return { ...w, verdict: 'dormant', note: `zeros are real — ${dormant}` }
    }
    return {
      ...w,
      verdict: 'silent-zero',
      note:
        `${w.rows} rows, every value 0, latest ${w.latest ?? 'unknown'}. The feed is landing on ` +
        `schedule and reporting nothing. This is a PROMPT, not a verdict: a real zero and a ` +
        `caught error written as 0 are the same byte in the table, so only asking the platform ` +
        `settles it. Probe the API for one of these dates. If the zeros are real, add the feed ` +
        `to KNOWN_DORMANT with the evidence so it stops being reported.`,
    }
  }
  return { ...w, verdict: 'healthy', note: `${w.nonZeroRows} of ${w.rows} rows carry a real value` }
}

function feedLabel(v: { channel: string; scope?: string; metric: string }): string {
  return v.scope ? `${v.channel}.${v.scope}.${v.metric}` : `${v.channel}.${v.metric}`
}

export function formatSilentZeroReport(verdicts: SilentZeroVerdict[]): string[] {
  const bad = verdicts.filter((v) => v.verdict === 'silent-zero')
  const absent = verdicts.filter((v) => v.verdict === 'absent')
  const retired = verdicts.filter((v) => v.verdict === 'retired')
  if (bad.length === 0 && absent.length === 0 && retired.length === 0) {
    return [`${verdicts.length} feed/metric pairs checked — none reporting only zeros`]
  }
  const out: string[] = []
  if (bad.length) {
    out.push(`${bad.length} feed(s) landing on schedule and reporting ONLY ZEROS:`)
    for (const v of bad) out.push(`  ${feedLabel(v)}: ${v.rows} rows, all 0, latest ${v.latest ?? '?'}`)
  }
  if (absent.length) {
    out.push(`${absent.length} feed(s) with no rows at all:`)
    for (const v of absent) out.push(`  ${feedLabel(v)}`)
  }
  if (retired.length) {
    out.push(
      `${retired.length} metric(s) RETIRED upstream — stored zeros are fabricated, not measured.`
    )
    out.push('  Nothing to chase; the pipeline stopped asking. Deleting the old rows is a decision, not a fix.')
    for (const v of retired) out.push(`  ${feedLabel(v)}: ${v.rows} stale rows, latest ${v.latest ?? '?'}`)
  }
  return out
}

// ─── Watched series — a named series that must not go quiet (TRACK-2) ─────
//
// The window pass above only fires when EVERY row in 30 days is zero. That is
// right for a feed that never worked and blind to one that just died: on
// 2026-09-22 ga4 session_start had no row on the three latest landed days
// (09-19..09-21) and 1 on 09-18, while earlier days in the window were
// non-zero (87 on 09-16), so even a scope-split pair read "healthy". A watched series is judged on its MOST RECENT landed days instead,
// keyed by channel x scope x scope_id x metric so one event cannot hide behind
// another's volume. A missing row on a day its channel landed counts as zero:
// GA4 omits zero rows, which is how session_start disappeared rather than
// reading 0.

export type WatchRule = 'went-silent' | 'health-flag'

export type WatchedSeries = {
  channel: string
  scope: string
  scopeId: string
  metric: string
  /**
   * went-silent: flag when the latest `minRun` days the channel landed all read
   * 0 or no row. health-flag: the series is itself a 1/0 verdict; flag when the
   * latest value is 0.
   */
  rule: WatchRule
  minRun?: number
  why: string
}

export const WATCHED_SERIES: WatchedSeries[] = [
  {
    channel: 'ga4',
    scope: 'event',
    scopeId: 'session_start',
    metric: 'event_count',
    rule: 'went-silent',
    minRun: 1,
    why:
      'browser-only (Measurement Protocol cannot send it), so the page-view mirror cannot mask an outage. ' +
      'Live September days carried 5 to 87 (stored ga4 event rows 09-10..09-17); the 2026-09-18 outage went 5 days unseen (TRACK-2).',
  },
  {
    channel: 'ga4',
    scope: 'event',
    scopeId: 'first_visit',
    metric: 'event_count',
    rule: 'went-silent',
    // Healthy September days carried as few as 3 (09-13), so one zero day can
    // be chance; two in a row is not.
    minRun: 2,
    why: 'browser-only, like session_start; a new visitor is not counted anywhere else in GA4.',
  },
  {
    channel: 'ga4',
    scope: 'account',
    scopeId: '',
    metric: 'tracking_health_ok',
    rule: 'health-flag',
    why:
      'the daily GA4 guard (lib/analytics/ga4-tracking-health.ts): browser session_start > 0 and ' +
      'google/organic sessions at or above the floor ratio to Search Console clicks.',
  },
]

export function watchKey(s: { channel: string; scope: string; scopeId: string; metric: string }): string {
  return `${s.channel}\u0000${s.scope}\u0000${s.scopeId}\u0000${s.metric}`
}

export type WatchPoint = { date: string; value: number }

export type WatchVerdict = {
  series: WatchedSeries
  verdict: 'went-silent' | 'unhealthy' | 'healthy' | 'not-landing' | 'absent'
  /** Consecutive most-recent landed days that failed (0 / missing, or health 0). */
  run: number
  latest: string | null
  lastGood: string | null
  note: string
}

/**
 * Judge one watched series.
 * @param points   the series' stored rows in the window (any order)
 * @param landed   every date its CHANNEL landed any row in the window
 */
export function classifyWatchedSeries(series: WatchedSeries, points: WatchPoint[], landed: string[]): WatchVerdict {
  const byDate = new Map(points.map((p) => [p.date, Number(p.value) || 0]))
  const label = `${series.channel}.${series.scope}.${series.scopeId || '-'}.${series.metric}`

  if (series.rule === 'health-flag') {
    const dates = [...byDate.keys()].sort().reverse()
    if (dates.length === 0) {
      return { series, verdict: 'absent', run: 0, latest: null, lastGood: null, note: `${label}: no rows yet — the guard has not written a verdict` }
    }
    let run = 0
    for (const d of dates) {
      if ((byDate.get(d) ?? 0) > 0) break
      run += 1
    }
    const lastGood = dates.find((d) => (byDate.get(d) ?? 0) > 0) ?? null
    return run > 0
      ? {
          series,
          verdict: 'unhealthy',
          run,
          latest: dates[0],
          lastGood,
          note: `${label}: FAILING for ${run} day(s) through ${dates[0]} (last pass ${lastGood ?? 'none in window'})`,
        }
      : { series, verdict: 'healthy', run: 0, latest: dates[0], lastGood, note: `${label}: passing, latest ${dates[0]}` }
  }

  const days = [...new Set(landed)].sort().reverse()
  if (days.length === 0) {
    return { series, verdict: 'not-landing', run: 0, latest: null, lastGood: null, note: `${label}: channel landed no rows in the window` }
  }
  let run = 0
  for (const d of days) {
    if ((byDate.get(d) ?? 0) > 0) break
    run += 1
  }
  const lastGood = days.find((d) => (byDate.get(d) ?? 0) > 0) ?? null
  const minRun = series.minRun ?? 1
  if (run >= minRun) {
    return {
      series,
      verdict: 'went-silent',
      run,
      latest: days[0],
      lastGood,
      note:
        `${label}: 0 or missing on the last ${run} day(s) the channel landed (through ${days[0]}; ` +
        `last non-zero ${lastGood ?? 'none in window'}). ${series.why}`,
    }
  }
  return { series, verdict: 'healthy', run, latest: days[0], lastGood, note: `${label}: ${byDate.get(days[0]) ?? 0} on ${days[0]}` }
}

export function formatWatchReport(verdicts: WatchVerdict[], details: Map<string, string[]> = new Map()): string[] {
  const alarms = verdicts.filter((v) => v.verdict === 'went-silent' || v.verdict === 'unhealthy')
  const out: string[] = []
  if (alarms.length === 0) {
    out.push(`${verdicts.length} watched series checked — none went quiet`)
  } else {
    out.push(`${alarms.length} WATCHED series FAILING (channel.scope.scope_id.metric):`)
    for (const v of alarms) {
      out.push(`  ${v.note}`)
      for (const d of details.get(watchKey(v.series)) ?? []) out.push(`    - ${d}`)
    }
  }
  for (const v of verdicts.filter((x) => x.verdict === 'absent' || x.verdict === 'not-landing')) out.push(`  (info) ${v.note}`)
  return out
}
