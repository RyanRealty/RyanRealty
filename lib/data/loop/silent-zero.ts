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
  verdict: 'silent-zero' | 'sparse' | 'healthy' | 'absent' | 'dormant'
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

export function formatSilentZeroReport(verdicts: SilentZeroVerdict[]): string[] {
  const bad = verdicts.filter((v) => v.verdict === 'silent-zero')
  const absent = verdicts.filter((v) => v.verdict === 'absent')
  if (bad.length === 0 && absent.length === 0) {
    return [`${verdicts.length} feed/metric pairs checked — none reporting only zeros`]
  }
  const out: string[] = []
  if (bad.length) {
    out.push(`${bad.length} feed(s) landing on schedule and reporting ONLY ZEROS:`)
    for (const v of bad) out.push(`  ${v.channel}.${v.metric}: ${v.rows} rows, all 0, latest ${v.latest ?? '?'}`)
  }
  if (absent.length) {
    out.push(`${absent.length} feed(s) with no rows at all:`)
    for (const v of absent) out.push(`  ${v.channel}.${v.metric}`)
  }
  return out
}
