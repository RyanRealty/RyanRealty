/**
 * Derive human-readable health for strict verify cron from recent strict_verify_runs rows.
 */

export type StrictVerifyRunRow = {
  completed_at: string
  ok: boolean
  query_succeeded: boolean
  processed: number
  marked_verified: number
  fetch_failures: number
  history_rows_inserted: number
  limit_param: number | null
  concurrency_param: number | null
  year_filter: number | null
  duration_ms: number | null
  error_message: string | null
}

export type StrictVerifyHealthStatus = 'healthy' | 'degraded' | 'stalled' | 'unknown'

export type StrictVerifyHealthSummary = {
  status: StrictVerifyHealthStatus
  summary: string
  minutesSinceLastRun: number | null
  lastRun: StrictVerifyRunRow | null
  successRateLast10: number | null
  avgMarkedVerifiedLast5: number | null
  avgFetchFailuresLast5: number | null
}

const STALE_AFTER_MIN = 15
const HIGH_FAILURE_RATIO = 0.25

export function summarizeStrictVerifyHealth(
  runs: StrictVerifyRunRow[],
  terminalStrictBacklog: number
): StrictVerifyHealthSummary {
  if (runs.length === 0) {
    return {
      status: 'unknown',
      summary:
        terminalStrictBacklog > 0
          ? 'No strict verify runs logged yet. Apply migration strict_verify_runs or wait for the next cron.'
          : 'No strict verify runs logged; backlog is clear.',
      minutesSinceLastRun: null,
      lastRun: null,
      successRateLast10: null,
      avgMarkedVerifiedLast5: null,
      avgFetchFailuresLast5: null,
    }
  }

  const last = runs[0]!
  const lastTs = new Date(last.completed_at).getTime()
  const minutesSinceLastRun = Number.isFinite(lastTs)
    ? Math.max(0, (Date.now() - lastTs) / 60000)
    : null

  const last10 = runs.slice(0, 10)
  const okCount = last10.filter((r) => r.ok && r.query_succeeded).length
  const successRateLast10 = last10.length > 0 ? Math.round((okCount / last10.length) * 1000) / 10 : null

  const last5 = runs.slice(0, 5)
  const avgMarkedVerifiedLast5 =
    last5.length > 0
      ? Math.round((last5.reduce((s, r) => s + r.marked_verified, 0) / last5.length) * 10) / 10
      : null
  const avgFetchFailuresLast5 =
    last5.length > 0
      ? Math.round((last5.reduce((s, r) => s + r.fetch_failures, 0) / last5.length) * 10) / 10
      : null

  if (terminalStrictBacklog === 0) {
    return {
      status: 'healthy',
      summary: 'Terminal strict verify backlog is clear.',
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  if (minutesSinceLastRun != null && minutesSinceLastRun > STALE_AFTER_MIN) {
    return {
      status: 'stalled',
      summary: `No strict verify run in about ${Math.round(minutesSinceLastRun)} minutes while backlog remains. Check Vercel cron, CRON_SECRET, and runtime logs.`,
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  if (!last.query_succeeded) {
    return {
      status: 'degraded',
      summary: last.error_message
        ? `Last run failed listing query: ${last.error_message}`
        : 'Last run failed during listing query.',
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  if (!last.ok) {
    return {
      status: 'degraded',
      summary: last.error_message
        ? `Last run reported not ok: ${last.error_message}`
        : 'Last run completed with ok=false.',
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  if (last.processed > 5 && last.fetch_failures / last.processed > HIGH_FAILURE_RATIO) {
    return {
      status: 'degraded',
      summary: `High Spark fetch failure rate on last run (${last.fetch_failures}/${last.processed}). Consider lowering concurrency or limit.`,
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  if (successRateLast10 != null && successRateLast10 < 70 && last10.length >= 5) {
    return {
      status: 'degraded',
      summary: `Only ${successRateLast10}% of the last ${last10.length} runs succeeded. Review errors in recent rows.`,
      minutesSinceLastRun,
      lastRun: last,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }

  return {
    status: 'healthy',
    summary: `Runs are current; last batch verified ${last.marked_verified} listings (${last.fetch_failures} fetch failures).`,
    minutesSinceLastRun,
    lastRun: last,
    successRateLast10,
    avgMarkedVerifiedLast5,
    avgFetchFailuresLast5,
  }
}
