/**
 * Token heartbeat state model (pure; app/api/cron/token-heartbeat/route.ts does the I/O).
 *
 * WHY: until 2026-10-14 the heartbeat reported a platform whose token was dead
 * with no refresh token, or that had never been connected, as "skipped" with
 * HTTP 204. LinkedIn's token expired 2026-07-09 with no refresh token stored and
 * the cron stayed green for 97 days while every LinkedIn post failed. A dead
 * platform is now a named failure with the fix in the same sentence.
 *
 * States, one per platform per run:
 *   ok              refreshed, or still valid (with a refresh path, or 14+ days left)
 *   expiring        under 14 days left and no working refresh path
 *   expired         past expiry with no working refresh
 *   not_connected   client env present, no token row
 *   not_configured  no client env (and no token row)
 *   error           the heartbeat could not tell (row unreadable, check threw)
 *
 * Severity decides how loud a state is:
 *   failure  expiring, expired, error, and not_connected on a publish-door target.
 *            Fails the cron's HTTP status and sync_logs, and alerts Matt.
 *   warning  not_configured on a platform that is not intentionally off.
 *   off      not_configured / not_connected on a platform in DISABLED_PLATFORMS.
 *
 * Secrets: nothing here ever holds a token. The route reads presence and expiry
 * only, and every message goes through redactSecrets before it is logged,
 * returned, written to sync_logs, or texted.
 */
import { isPublishDoorPlatform, type PublishDoorPlatform } from '@/lib/social/publish-door'

export type HeartbeatPlatform =
  | 'meta'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'google_business_profile'
  | 'tiktok'
  | 'threads'
  | 'pinterest'
  | 'nextdoor'

export type TokenState = 'ok' | 'expiring' | 'expired' | 'not_connected' | 'not_configured' | 'error'
export type HeartbeatSeverity = 'ok' | 'failure' | 'warning' | 'off'

/** A token with less than this left and no working refresh path is a failure. */
export const EXPIRING_WITHIN_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How a platform's access token is kept alive.
 *   refresh_token  a stored refresh token buys a new access token
 *   self           the access token extends itself while still valid (Threads th_refresh_token)
 *   none           nothing renews it (Meta Page token from env)
 */
export type RefreshMode = 'refresh_token' | 'self' | 'none'

export type PlatformSpec = {
  platform: HeartbeatPlatform
  label: string
  /** Supabase table holding the OAuth row (id='default'); null for env-token platforms. */
  table: string | null
  /** Whether `table` has a refresh_token column (threads_auth does not). */
  hasRefreshColumn: boolean
  /** Client env the platform's lib requires; each inner list is any-of. Names only, never values. */
  env: string[][]
  refreshMode: RefreshMode
  /** Where Matt reconnects. */
  fixPath: string
  /** The publish-door targets this token powers. */
  doorTargets: PublishDoorPlatform[]
}

/**
 * Env names mirror each lib's own OAuth env reader: getLinkedInOAuthEnv,
 * getPinterestOAuthEnv, getThreadsOAuthEnv, getNextdoorOAuthEnv, getXOAuthEnv,
 * getYouTubeOAuthEnv (lib/<platform>.ts), getEnv in lib/tiktok.ts, and
 * getGoogleEnv in lib/google-business-profile.ts.
 */
export const PLATFORM_SPECS: readonly PlatformSpec[] = [
  {
    platform: 'meta',
    label: 'Meta',
    table: null,
    hasRefreshColumn: false,
    env: [['META_PAGE_ACCESS_TOKEN', 'META_PAGE_TOKEN']],
    refreshMode: 'none',
    fixPath: 'META_PAGE_ACCESS_TOKEN',
    doorTargets: ['instagram', 'facebook'],
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    table: 'youtube_auth',
    hasRefreshColumn: true,
    env: [['YOUTUBE_CLIENT_ID'], ['YOUTUBE_CLIENT_SECRET'], ['YOUTUBE_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/youtube/authorize',
    doorTargets: ['youtube'],
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn',
    table: 'linkedin_auth',
    hasRefreshColumn: true,
    env: [['LINKEDIN_CLIENT_ID'], ['LINKEDIN_CLIENT_SECRET'], ['LINKEDIN_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/linkedin/authorize',
    doorTargets: ['linkedin'],
  },
  {
    platform: 'x',
    label: 'X',
    table: 'x_auth',
    hasRefreshColumn: true,
    env: [['X_CLIENT_ID'], ['X_CLIENT_SECRET'], ['X_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/x/authorize',
    doorTargets: ['x'],
  },
  {
    platform: 'google_business_profile',
    label: 'Google Business Profile',
    table: 'google_business_profile_auth',
    hasRefreshColumn: true,
    env: [
      ['GOOGLE_BUSINESS_PROFILE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID'],
      ['GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      ['GOOGLE_BUSINESS_PROFILE_REDIRECT_URI'],
    ],
    refreshMode: 'refresh_token',
    fixPath: '/api/google-business-profile/authorize',
    doorTargets: ['google_business_profile'],
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    table: 'tiktok_auth',
    hasRefreshColumn: true,
    env: [['TIKTOK_CLIENT_KEY'], ['TIKTOK_CLIENT_SECRET'], ['TIKTOK_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/tiktok/authorize',
    doorTargets: ['tiktok'],
  },
  {
    platform: 'threads',
    label: 'Threads',
    table: 'threads_auth',
    hasRefreshColumn: false,
    env: [['THREADS_CLIENT_ID'], ['THREADS_CLIENT_SECRET'], ['THREADS_REDIRECT_URI']],
    refreshMode: 'self',
    fixPath: '/api/threads/authorize',
    doorTargets: ['threads'],
  },
  {
    platform: 'pinterest',
    label: 'Pinterest',
    table: 'pinterest_auth',
    hasRefreshColumn: true,
    env: [['PINTEREST_CLIENT_ID'], ['PINTEREST_CLIENT_SECRET'], ['PINTEREST_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/pinterest/authorize',
    doorTargets: ['pinterest'],
  },
  {
    platform: 'nextdoor',
    label: 'Nextdoor',
    table: 'nextdoor_auth',
    hasRefreshColumn: true,
    env: [['NEXTDOOR_CLIENT_ID'], ['NEXTDOOR_CLIENT_SECRET'], ['NEXTDOOR_REDIRECT_URI']],
    refreshMode: 'refresh_token',
    fixPath: '/api/nextdoor/authorize',
    doorTargets: ['nextdoor'],
  },
]

/**
 * Platforms that are intentionally off, each with the reason. For these, "never
 * set up" (not_configured, not_connected) reports as `off`, not a warning or a
 * failure. A token row that exists and is dying still fails: someone connected
 * it, so the entry here is stale.
 */
export const DISABLED_PLATFORMS: ReadonlyArray<{ platform: HeartbeatPlatform; reason: string }> = [
  {
    platform: 'nextdoor',
    reason:
      'the Nextdoor posting API is partner-gated (lib/nextdoor.ts: access is gated, apply at developer.nextdoor.com), so there are no NEXTDOOR_* client credentials until Nextdoor approves the app',
  },
]

export function disabledReason(platform: HeartbeatPlatform): string | null {
  return DISABLED_PLATFORMS.find((d) => d.platform === platform)?.reason ?? null
}

export function specFor(platform: HeartbeatPlatform): PlatformSpec {
  const spec = PLATFORM_SPECS.find((s) => s.platform === platform)
  if (!spec) throw new Error(`no heartbeat spec for ${platform}`)
  return spec
}

/** Client env groups with no non-blank value, as display names (never values). */
export function missingEnv(spec: PlatformSpec, env: Record<string, string | undefined>): string[] {
  return spec.env
    .filter((group) => !group.some((name) => (env[name] ?? '').trim() !== ''))
    .map((group) => group.join(' or '))
}

/** True when any door target this token powers is on the publish door's list. */
export function isDoorTarget(spec: PlatformSpec): boolean {
  return spec.doorTargets.some((p) => isPublishDoorPlatform(p))
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const MAX_DETAIL = 200

/**
 * Strip anything token-shaped from a message: every known secret value the run
 * touched, plus query/body params and auth headers that carry one. Applied to
 * every string the heartbeat logs, returns, stores or texts.
 */
export function redactSecrets(text: string, secrets: Iterable<string> = []): string {
  let out = text
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join('[redacted]')
  }
  out = out
    .replace(/\b(access_token|refresh_token|client_secret|id_token|code)=([^&\s"']+)/gi, '$1=[redacted]')
    .replace(/\b(Bearer|Basic|OAuth)\s+[A-Za-z0-9._~+/=-]{6,}/g, '$1 [redacted]')
  return out
}

/** One-line, redacted, bounded error detail for a message. */
export function errorDetail(err: unknown, secrets: Iterable<string> = []): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error'
  const oneLine = redactSecrets(raw, secrets).replace(/\s+/g, ' ').trim()
  return oneLine.length > MAX_DETAIL ? `${oneLine.slice(0, MAX_DETAIL - 3)}...` : oneLine || 'unknown error'
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** What the route saw for one OAuth-table platform. Presence and expiry only. */
export type TokenObservation = {
  /** Display names of client env groups with no value. */
  envMissing: string[]
  /** The token row AFTER any refresh, or null when there is none. */
  row: { expiresAt: string | null; hasRefreshToken: boolean } | null
  /** The row could not be read at all (already redacted). */
  readError: string | null
  /** The platform's token getter / refresh threw (already redacted). */
  refreshError: string | null
  /** expires_at moved forward during this run. */
  refreshed: boolean
}

/** What the route saw for Meta (env token, Graph ping). */
export type MetaObservation =
  | { tokenPresent: false }
  | { tokenPresent: true; ok: true; pageId: string }
  | { tokenPresent: true; ok: false; code: number | null; detail: string }

export type HeartbeatResult = {
  platform: HeartbeatPlatform
  state: TokenState
  severity: HeartbeatSeverity
  /** The sentence that names the platform and the fix. Redacted. */
  message: string
  expiresAt: string | null
  hasRefreshToken: boolean | null
  refreshed: boolean
  durationMs?: number
  alertQueued?: boolean
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function daysWord(ms: number): string {
  const days = Math.max(0, Math.floor(ms / DAY_MS))
  if (days === 0) return 'under 1 day'
  return days === 1 ? '1 day' : `${days} days`
}

export function severityFor(spec: PlatformSpec, state: TokenState): HeartbeatSeverity {
  switch (state) {
    case 'ok':
      return 'ok'
    case 'expiring':
    case 'expired':
    case 'error':
      return 'failure'
    case 'not_connected':
      if (disabledReason(spec.platform)) return 'off'
      return isDoorTarget(spec) ? 'failure' : 'warning'
    case 'not_configured':
      return disabledReason(spec.platform) ? 'off' : 'warning'
  }
}

function result(
  spec: PlatformSpec,
  state: TokenState,
  message: string,
  extra: Partial<Pick<HeartbeatResult, 'expiresAt' | 'hasRefreshToken' | 'refreshed'>> = {},
): HeartbeatResult {
  const off = disabledReason(spec.platform)
  const severity = severityFor(spec, state)
  return {
    platform: spec.platform,
    state,
    severity,
    message:
      severity === 'off' && off ? `${spec.label} is off on purpose (${state.replace('_', ' ')}): ${off}` : message,
    expiresAt: extra.expiresAt ?? null,
    hasRefreshToken: extra.hasRefreshToken ?? null,
    refreshed: extra.refreshed ?? false,
  }
}

/** Classify one OAuth-table platform. `nowMs` is the run clock. */
export function classifyToken(spec: PlatformSpec, obs: TokenObservation, nowMs: number): HeartbeatResult {
  const { label, table, fixPath } = spec

  if (obs.readError) {
    return result(spec, 'error', `${label} token check failed: could not read ${table} (${obs.readError}); see the token-heartbeat run`)
  }

  if (!obs.row) {
    if (obs.envMissing.length > 0) {
      return result(
        spec,
        'not_configured',
        `${label} is not configured (${obs.envMissing.join(', ')} unset): set the client env, then connect at ${fixPath}`,
      )
    }
    return result(spec, 'not_connected', `${label} is not connected (no ${table} row): connect at ${fixPath}`)
  }

  const { expiresAt, hasRefreshToken } = obs.row
  const expMs = expiresAt ? Date.parse(expiresAt) : Number.NaN
  const facts = { expiresAt, hasRefreshToken: spec.hasRefreshColumn ? hasRefreshToken : null, refreshed: obs.refreshed }
  if (!Number.isFinite(expMs)) {
    return result(spec, 'error', `${label} token row has no readable expires_at: reconnect at ${fixPath}`, facts)
  }

  const envOk = obs.envMissing.length === 0
  const refreshPath =
    envOk &&
    (spec.refreshMode === 'refresh_token'
      ? hasRefreshToken
      : spec.refreshMode === 'self'
        ? expMs > nowMs
        : false)

  // Why nothing renews it, in the words the summary uses.
  let why: string
  if (refreshPath && obs.refreshError) why = `and the refresh failed (${obs.refreshError})`
  else if (!envOk) why = `and cannot refresh (${obs.envMissing.join(', ')} unset)`
  else if (spec.refreshMode === 'refresh_token' && !hasRefreshToken) why = 'with no refresh token'
  else if (spec.refreshMode === 'self') why = 'and can no longer be extended (Threads tokens extend only before they expire)'
  else why = 'and did not refresh'

  const msLeft = expMs - nowMs

  if (msLeft <= 0) {
    return result(spec, 'expired', `${label} token expired ${ymd(expMs)} ${why}: reconnect at ${fixPath}`, facts)
  }

  if (refreshPath && obs.refreshError) {
    if (msLeft < EXPIRING_WITHIN_DAYS * DAY_MS) {
      return result(
        spec,
        'expiring',
        `${label} token expires ${ymd(expMs)} (${daysWord(msLeft)} left) ${why}: reconnect at ${fixPath}`,
        facts,
      )
    }
    return result(
      spec,
      'error',
      `${label} token is valid until ${ymd(expMs)} but the token check failed (${obs.refreshError}); see the token-heartbeat run`,
      facts,
    )
  }

  if (!refreshPath && msLeft < EXPIRING_WITHIN_DAYS * DAY_MS) {
    return result(
      spec,
      'expiring',
      `${label} token expires ${ymd(expMs)} (${daysWord(msLeft)} left) ${why}: reconnect at ${fixPath}`,
      facts,
    )
  }

  const tail = refreshPath ? '' : ` (${why.replace(/^(and|with) /, '')}: reconnect before then at ${fixPath})`
  const head = obs.refreshed ? `${label} token refreshed, valid until` : `${label} token valid until`
  return result(spec, 'ok', `${head} ${new Date(expMs).toISOString()}${tail}`, facts)
}

/** The check itself threw before it could classify anything. */
export function checkFailed(spec: PlatformSpec, detail: string): HeartbeatResult {
  return result(spec, 'error', `${spec.label} token check failed (${detail}); see the token-heartbeat run`)
}

/** Meta: the Page token lives in env; Graph error 190 means it no longer authorizes. */
export function classifyMeta(obs: MetaObservation): HeartbeatResult {
  const spec = specFor('meta')
  if (!obs.tokenPresent) {
    return result(
      spec,
      'not_configured',
      'Meta is not configured (META_PAGE_ACCESS_TOKEN or META_PAGE_TOKEN unset): set a Page token in META_PAGE_ACCESS_TOKEN',
    )
  }
  if (obs.ok) return result(spec, 'ok', `Meta Page token valid (page ${obs.pageId})`)
  if (obs.code === 190) {
    return result(
      spec,
      'expired',
      `Meta Page token rejected by Graph (code 190: ${obs.detail}): set a new Page token in META_PAGE_ACCESS_TOKEN`,
    )
  }
  return result(
    spec,
    'error',
    `Meta Page token check failed (${obs.code != null ? `code ${obs.code}: ` : ''}${obs.detail}); see the token-heartbeat run`,
  )
}

// ---------------------------------------------------------------------------
// Alerts + sync_logs
// ---------------------------------------------------------------------------

/**
 * One alert per platform + state + UTC date. The key becomes the
 * `[crm-health:<key>]` marker queueBrokerHealthAlert dedupes on, and the
 * cooldown covers the whole day, so a re-run the same day stays quiet and the
 * next day's run pages again while the platform is still dead.
 */
export const ALERT_COOLDOWN_MINUTES = 24 * 60

export function alertKey(platform: HeartbeatPlatform, state: TokenState, date: string): string {
  return `token-heartbeat:${platform}:${state}:${date}`
}

export function alertBody(r: HeartbeatResult): string {
  return `Token heartbeat: ${r.message}`
}

/** Per-platform sync_logs status: failures are 500 so lib/data/loop/token-health.ts counts them (>= 400). */
export function responseStatusFor(severity: HeartbeatSeverity): number {
  if (severity === 'ok') return 200
  if (severity === 'failure') return 500
  return 204
}

export type HeartbeatSummary = {
  ok: number
  failure: number
  warning: number
  off: number
  failures: string[]
  warnings: string[]
}

export function summarize(results: HeartbeatResult[]): HeartbeatSummary {
  return {
    ok: results.filter((r) => r.severity === 'ok').length,
    failure: results.filter((r) => r.severity === 'failure').length,
    warning: results.filter((r) => r.severity === 'warning').length,
    off: results.filter((r) => r.severity === 'off').length,
    failures: results.filter((r) => r.severity === 'failure').map((r) => r.message),
    warnings: results.filter((r) => r.severity === 'warning').map((r) => r.message),
  }
}

export type SyncLogRow = {
  endpoint: string
  method: string
  response_status: number
  records_returned: number | null
  duration_ms: number | null
  sync_cycle_id: string
  environment: string
  error_message: string | null
  alert_sent: boolean
}

/**
 * One row per platform (`token_heartbeat:<platform>`, the endpoints the loop
 * scoreboard reads) plus one run row (`token_heartbeat`) that is 500 whenever
 * any platform failed and names every failure.
 */
export function toSyncLogRows(
  results: HeartbeatResult[],
  cycleId: string,
  environment: string,
  runDurationMs: number,
): SyncLogRow[] {
  const perPlatform: SyncLogRow[] = results.map((r) => ({
    endpoint: `token_heartbeat:${r.platform}`,
    method: 'REFRESH',
    response_status: responseStatusFor(r.severity),
    records_returned: null,
    duration_ms: r.durationMs ?? null,
    sync_cycle_id: cycleId,
    environment,
    error_message: r.severity === 'ok' ? null : `[${r.state}] ${r.message}`,
    alert_sent: r.alertQueued === true,
  }))
  const s = summarize(results)
  const run: SyncLogRow = {
    endpoint: 'token_heartbeat',
    method: 'REFRESH',
    response_status: s.failure > 0 ? 500 : 200,
    records_returned: results.length,
    duration_ms: runDurationMs,
    sync_cycle_id: cycleId,
    environment,
    error_message: s.failure > 0 ? s.failures.join(' | ') : null,
    alert_sent: results.some((r) => r.alertQueued === true),
  }
  return [...perPlatform, run]
}
