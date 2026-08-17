/**
 * Pipeline heartbeat — pure threshold logic for the loop-health-check cron.
 *
 * Every critical pipeline has failed silently at least once (FSBO scrape dark
 * on an Apify usage cap, listing_tile_mv 8 days stale on a pg_cron timeout).
 * These evaluators turn "latest timestamp seen in the table" into a graded
 * check with a note that names the likely cause, so the daily cron can send
 * ONE consolidated alert instead of Matt discovering staleness by accident.
 *
 * All functions are pure (timestamps in, check out) so the thresholds are
 * unit-testable without a database — see lib/pipeline-heartbeat.test.ts.
 * The DB queries live in app/api/cron/loop-health-check/route.ts.
 */

export type PipelineCheckStatus = 'green' | 'yellow' | 'red'

export interface PipelineCheck {
  name: string
  status: PipelineCheckStatus
  value: string
  note?: string
}

/**
 * Staleness thresholds, calibrated to each pipeline's real cadence:
 * - sync-delta ingest: continuous; listing_tile_mv refreshes hourly
 *   (/api/cron/refresh-mvs at :08) so max(modified_at) should never trail 2h.
 * - listing_search_mv: refreshed by the same hourly cron.
 * - FSBO: /api/cron/detect-fsbo-listings daily 09:35 UTC → 3 days = cadence + slack.
 * - Expired: low natural volume; 7 days with no detections is only a WARN.
 * - Saved-search: /api/cron/saved-search-alerts hourly; 26h = a full day + slack.
 * - market_stats_cache: /api/cron/refresh-market-stats daily 07:00 UTC and this
 *   heartbeat runs 12:30 UTC, so a healthy run reads ~5.5h; >8h means today's
 *   recompute failed.
 */
export const HEARTBEAT_THRESHOLDS = {
  syncDeltaHours: 2,
  searchMvHours: 2,
  fsboDays: 3,
  expiredDays: 7,
  savedSearchHours: 26,
  marketStatsHours: 8,
  // West Side + CRM Meta audience refresh: both crons are daily
  // (westside 14:00 UTC, CRM 09:00 UTC) and write a meta_audience_log row
  // every run (dry-run included). 36h = the daily cadence + slack.
  // The old 8-day weekly threshold hid a missed day for a week (G11 class).
  audienceSyncHours: 36,
  // SkySlope inbound recon mirror: /api/cron/skyslope-mirror-refresh daily
  // 06:20 UTC. 36h = the daily cadence + slack. Vault (tc_deals) stays SoR.
  skySlopeMirrorHours: 36,
} as const

export function ageHours(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return (now.getTime() - t) / 3_600_000
}

export function formatAge(hours: number | null): string {
  if (hours === null) return 'never'
  if (hours < 0) return '0.0h'
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

/**
 * Sync-delta ingest + tile MV, one compound signal. max(modified_at) in
 * listing_tile_mv only advances when BOTH the Spark sync-delta ingest and the
 * MV refresh are alive, so a stale reading catches either failure. The MV's
 * own refreshed_at disambiguates which half died.
 */
export function evalSyncDelta(
  maxModifiedAt: string | null,
  mvRefreshedAt: string | null,
  now: Date,
): PipelineCheck {
  const modAge = ageHours(maxModifiedAt, now)
  const refAge = ageHours(mvRefreshedAt, now)
  const value = `max(modified_at) ${formatAge(modAge)} old, mv refreshed ${formatAge(refAge)} ago`
  if (modAge !== null && modAge < HEARTBEAT_THRESHOLDS.syncDeltaHours) {
    return { name: 'pipeline:sync-delta', status: 'green', value }
  }
  const refreshAlive = refAge !== null && refAge < HEARTBEAT_THRESHOLDS.syncDeltaHours
  return {
    name: 'pipeline:sync-delta',
    status: 'red',
    value,
    note: refreshAlive
      ? 'listing_tile_mv is refreshing but no listing modifications are arriving. The Spark sync-delta ingest is likely dead (cron failure or API auth). Site inventory is frozen.'
      : 'listing_tile_mv refresh itself is stale. The pg_cron refresh is likely timing out or dead (this went 8 days unnoticed once — see the 2026-07 MV refresh timeout incident). Site inventory is frozen.',
  }
}

/** listing_search_mv refreshes hourly alongside the tile MV. */
export function evalSearchMv(refreshedAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(refreshedAt, now)
  const stale = age === null || age >= HEARTBEAT_THRESHOLDS.searchMvHours
  return {
    name: 'pipeline:listing_search_mv',
    status: stale ? 'red' : 'green',
    value: `refreshed ${formatAge(age)} ago`,
    note: stale
      ? 'listing_search_mv is not refreshing. Search results and filters serve stale rows. Check /api/cron/refresh-mvs (hourly) and the refresh RPC timeout.'
      : undefined,
  }
}

/** FSBO scrape — daily Apify actor. The known silent killer is the usage cap. */
export function evalFsbo(maxLastSeenAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(maxLastSeenAt, now)
  const stale = age === null || age >= HEARTBEAT_THRESHOLDS.fsboDays * 24
  return {
    name: 'pipeline:fsbo-scrape',
    status: stale ? 'red' : 'green',
    value: `max(last_seen_at) ${formatAge(age)} old`,
    note: stale
      ? 'FSBO scrape is dark. Most likely cause: the Apify monthly usage cap was hit and the actor silently stops (cap resets around the 18th) — check Apify billing BEFORE debugging code. Then check /api/cron/detect-fsbo-listings.'
      : undefined,
  }
}

/**
 * Expired-listing detection — WARN only, never a failure. Zero expirations in
 * a week is normal in a slow market; the line exists so a genuinely dead
 * hourly cron eventually surfaces without paging on natural quiet.
 */
export function evalExpired(maxCreatedAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(maxCreatedAt, now)
  const quiet = age === null || age >= HEARTBEAT_THRESHOLDS.expiredDays * 24
  return {
    name: 'pipeline:expired-detect',
    status: quiet ? 'yellow' : 'green',
    value: `max(created_at) ${formatAge(age)} old`,
    note: quiet
      ? 'No new expired listings detected in over 7 days. Low volume is normal — verify /api/cron/detect-expired-listings only if this WARN persists across several heartbeats.'
      : undefined,
  }
}

/**
 * Saved-search alert engine. Signal (documented, verified against
 * app/actions/saved-search-alerts.ts): every due row the engine scans gets
 * listing_alerts.last_notified_at stamped via advanceCursor — even when
 * nothing new matched — and every real send writes an email_events row with
 * email_key 'listing-alert:<id>:<date>'. Either timestamp advancing within
 * 26h proves the engine ran. Zero active alert rows means there is nothing
 * to scan, which is not an engine failure.
 */
export function evalSavedSearch(
  lastBookkeepingAt: string | null,
  lastAlertEmailAt: string | null,
  activeAlertRows: number,
  now: Date,
): PipelineCheck {
  if (activeAlertRows === 0) {
    return {
      name: 'pipeline:saved-search-alerts',
      status: 'green',
      value: '0 active listing_alerts rows',
      note: 'Nothing to scan — not an engine failure.',
    }
  }
  const bookAge = ageHours(lastBookkeepingAt, now)
  const emailAge = ageHours(lastAlertEmailAt, now)
  const freshest =
    bookAge === null ? emailAge : emailAge === null ? bookAge : Math.min(bookAge, emailAge)
  const stale = freshest === null || freshest >= HEARTBEAT_THRESHOLDS.savedSearchHours
  return {
    name: 'pipeline:saved-search-alerts',
    status: stale ? 'red' : 'green',
    value: `engine last ran ${formatAge(freshest)} ago (${activeAlertRows} active alerts)`,
    note: stale
      ? 'Saved-search engine has neither stamped last_notified_at nor sent a listing-alert email in over 26h. The hourly /api/cron/saved-search-alerts is likely failing — subscribers are not getting alerts.'
      : undefined,
  }
}

/** market_stats_cache — daily 07:00 UTC recompute, checked at 12:30 UTC. */
export function evalMarketStats(maxComputedAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(maxComputedAt, now)
  const stale = age === null || age >= HEARTBEAT_THRESHOLDS.marketStatsHours
  return {
    name: 'pipeline:market_stats_cache',
    status: stale ? 'red' : 'green',
    value: `max(computed_at) ${formatAge(age)} old`,
    note: stale
      ? 'market_stats_cache was not recomputed by the daily 07:00 UTC run. Market report pages and stat surfaces serve stale numbers. Check /api/cron/refresh-market-stats.'
      : undefined,
  }
}

/**
 * West Side Meta audience refresh. /api/cron/meta-westside-audience runs
 * daily (14:00 UTC) and writes a meta_audience_log row on EVERY run — dry-run
 * included — so max(ran_at) advancing within 36h proves the cron is alive,
 * independent of whether META_AUDIENCE_PUSH_ENABLED gates the actual Meta push.
 * The audience Ryan Realty paid to build (17,665 parcels) silently going stale
 * is exactly the invisible-staleness class this watchdog exists to catch.
 */
export function evalAudienceSync(maxRanAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(maxRanAt, now)
  const stale = age === null || age >= HEARTBEAT_THRESHOLDS.audienceSyncHours
  return {
    name: 'pipeline:westside-audience',
    status: stale ? 'red' : 'green',
    value: `max(meta_audience_log.ran_at) ${formatAge(age)} old`,
    note: stale
      ? 'West Side Meta audience refresh is dark — no meta_audience_log row in over 36 hours. The daily /api/cron/meta-westside-audience is likely failing (cron dropped, Meta token, or a query error); the parcel-linked Custom Audience is going stale. Dry-run runs still log, so this catches a dead cron even when META_AUDIENCE_PUSH_ENABLED is off.'
      : undefined,
  }
}

/**
 * SkySlope inbound recon mirror. Daily cron stamps
 * skyslope_transactions.synced_at. A 67-day-stale sample (2026-06-10) is the
 * founding failure: the only refresh was a Mac-local script with no cron.
 */
export function evalSkySlopeMirror(latestSyncedAt: string | null, now: Date): PipelineCheck {
  const age = ageHours(latestSyncedAt, now)
  const stale = age === null || age >= HEARTBEAT_THRESHOLDS.skySlopeMirrorHours
  return {
    name: 'pipeline:skyslope-mirror',
    status: stale ? 'red' : 'green',
    value: `skyslope_transactions.max(synced_at) ${formatAge(age)} old`,
    note: stale
      ? 'Inbound SkySlope recon mirror is stale. /api/cron/skyslope-mirror-refresh is dark or SKYSLOPE_* Files API keys are missing. Vault (tc_deals) stays the deal SoR; the mirror is recon only.'
      : undefined,
  }
}

/** A probe that could not even run reads as red — a swallowed query error is indistinguishable from a dark pipeline. */
export function probeFailed(name: string, message: string): PipelineCheck {
  return { name, status: 'red', value: 'probe failed', note: message }
}

export interface HeartbeatSummary {
  stale: PipelineCheck[]
  warn: PipelineCheck[]
  healthy: boolean
  subject: string
  text: string
}

/**
 * Consolidate the pipeline checks into one alert. Only red counts as stale
 * (and triggers the email); yellow WARN lines ride along in the body.
 */
export function summarizeHeartbeat(checks: PipelineCheck[], now: Date): HeartbeatSummary {
  const stale = checks.filter((c) => c.status === 'red')
  const warn = checks.filter((c) => c.status === 'yellow')
  const lines = checks.map((c) => {
    const tag = c.status === 'red' ? 'STALE' : c.status === 'yellow' ? 'WARN' : 'OK'
    return `${tag}  ${c.name} — ${c.value}${c.note ? `\n      ${c.note}` : ''}`
  })
  return {
    stale,
    warn,
    healthy: stale.length === 0,
    subject: `Pipeline heartbeat: ${stale.length} stale`,
    text: [
      `Pipeline heartbeat ${now.toISOString()}`,
      `${stale.length} stale, ${warn.length} warn, ${checks.length - stale.length - warn.length} ok`,
      '',
      ...lines,
      '',
      'Source: /api/cron/loop-health-check (daily 12:30 UTC). Full check detail in marketing_decisions (decision_type loop_health_check).',
    ].join('\n'),
  }
}
