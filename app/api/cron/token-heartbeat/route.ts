import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMetaPageToken } from '@/lib/meta-env'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ALERT_COOLDOWN_MINUTES,
  alertBody,
  alertKey,
  checkFailed,
  classifyMeta,
  classifyToken,
  errorDetail,
  missingEnv,
  PLATFORM_SPECS,
  redactSecrets,
  REMOVED_PLATFORMS,
  summarize,
  toSyncLogRows,
  type HeartbeatPlatform,
  type HeartbeatResult,
  type MetaObservation,
  type PlatformSpec,
  type TokenObservation,
} from '@/lib/social/token-heartbeat'

/**
 * Token Heartbeat Cron (daily 12:00 UTC, vercel.json).
 *
 * Exercises every connected social platform's token getter, which refreshes the
 * access token inside that lib's own window and persists any rotated refresh
 * token, so each OAuth chain stays alive. Then it classifies every platform:
 *
 *   ok | expiring | expired | not_connected | not_configured | error
 *
 * (state model, severities and DISABLED_PLATFORMS: lib/social/token-heartbeat.ts).
 *
 * LinkedIn and Threads were removed as platforms (Matt 2026-10-14,
 * REMOVED_PLATFORMS): the heartbeat never reads, refreshes or alerts on them,
 * even though linkedin_auth still holds a dead token row.
 *
 * WHY THIS IS LOUD (2026-10-14): a token that was dead with no refresh token, or
 * a platform never connected, used to report as "skipped" with HTTP 204. LinkedIn
 * expired 2026-07-09 with no refresh token and the cron stayed green for 97 days.
 * Now every failure:
 *   - makes the response HTTP 500 (Vercel shows the cron as failed),
 *   - writes its per-platform sync_logs row as 500 and the run row
 *     (`endpoint = 'token_heartbeat'`) as 500 naming every failure,
 *   - queues ONE ops text to Matt per platform + state + UTC date through
 *     queueBrokerHealthAlert (the same internal channel crawl-probe and
 *     crm-health-check use). It never messages anyone else.
 *
 * Secrets: the heartbeat reads token presence and expiry only. It never logs,
 * returns, stores or texts a token value; every message is redacted
 * (redactSecrets) with each value the run touched.
 *
 * Inactivity windows (how long a token can sit idle before it dies):
 *   Meta Page token: never expires; pinged for status.
 *   YouTube / GBP: 6 months of refresh-token inactivity (Google).
 *   TikTok: 365 days (rolling refresh).
 *   X: refresh token rotates on every use.
 *   Pinterest: 30-60 days by tier. Nextdoor: partner-gated, off.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * ?notify=0 runs, refreshes and writes sync_logs without queueing any text
 * (manual verification runs).
 *
 * Query the latest run:
 *   SELECT endpoint, response_status, error_message, alert_sent
 *   FROM sync_logs WHERE sync_cycle_id = <cycleId> ORDER BY endpoint;
 */

export const dynamic = 'force-dynamic'

type TokenRow = { expiresAt: string | null; hasRefreshToken: boolean }

/**
 * Reads presence + expiry for the platform's id='default' row. The refresh
 * token value is turned into a boolean here and only kept in `secrets` so any
 * message that echoes it gets redacted. The access token is never selected.
 */
async function readTokenRow(
  sb: SupabaseClient,
  spec: PlatformSpec,
  secrets: Set<string>,
): Promise<TokenRow | null> {
  const columns = spec.hasRefreshColumn ? 'expires_at, refresh_token' : 'expires_at'
  const { data, error } = await sb.from(spec.table as string).select(columns).eq('id', 'default').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as { expires_at?: string | null; refresh_token?: string | null }
  const refresh = typeof row.refresh_token === 'string' ? row.refresh_token.trim() : ''
  if (refresh) secrets.add(refresh)
  return { expiresAt: row.expires_at ?? null, hasRefreshToken: refresh !== '' }
}

/**
 * TikTok has no stored-token getter in lib/tiktok.ts, so the heartbeat keeps
 * its own refresh (unchanged behaviour: refresh within 60 s of expiry, persist
 * the rotated refresh token).
 */
async function refreshTikTok(sb: SupabaseClient, secrets: Set<string>): Promise<string | null> {
  const { data, error } = await sb
    .from('tiktok_auth')
    .select('refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as { refresh_token: string; expires_at: string }
  if (row.refresh_token) secrets.add(row.refresh_token)
  if (Date.now() < new Date(row.expires_at).getTime() - 60_000) return null
  const { refreshAccessToken } = await import('@/lib/tiktok')
  const refreshed = await refreshAccessToken(row.refresh_token)
  secrets.add(refreshed.access_token)
  if (refreshed.refresh_token) secrets.add(refreshed.refresh_token)
  const { error: updateError } = await sb
    .from('tiktok_auth')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
  if (updateError) throw new Error(`TikTok refreshed but the new token was not saved: ${updateError.message}`)
  return refreshed.access_token
}

/**
 * Each platform's own token getter. Calling it is what refreshes the token
 * (inside the lib's window) and persists a rotated refresh token. The returned
 * access token only feeds the redaction set.
 */
async function exerciseGetter(
  platform: HeartbeatPlatform,
  sb: SupabaseClient,
  secrets: Set<string>,
): Promise<string | null> {
  switch (platform) {
    case 'youtube':
      return (await import('@/lib/youtube')).getYouTubeAccessToken()
    case 'x':
      return (await import('@/lib/x')).getXAccessToken()
    case 'google_business_profile':
      return (await import('@/lib/google-business-profile')).getOrRefreshGoogleBusinessProfileAccessToken()
    case 'pinterest':
      return (await import('@/lib/pinterest')).getPinterestAccessToken()
    case 'nextdoor':
      return (await import('@/lib/nextdoor')).getNextdoorAccessToken()
    case 'tiktok':
      return refreshTikTok(sb, secrets)
    case 'meta':
      return null
  }
}

/** Observe one OAuth-table platform: env, row, refresh (when it has a path), row again. */
async function observeOAuthPlatform(spec: PlatformSpec, secrets: Set<string>): Promise<TokenObservation> {
  const envMissing = missingEnv(spec, process.env)
  const base: TokenObservation = { envMissing, row: null, readError: null, refreshError: null, refreshed: false }

  let sb: SupabaseClient
  let before: TokenRow | null
  try {
    sb = createServiceClient()
    before = await readTokenRow(sb, spec, secrets)
  } catch (err) {
    return { ...base, readError: errorDetail(err, secrets) }
  }
  if (!before) return base

  const beforeMs = before.expiresAt ? Date.parse(before.expiresAt) : Number.NaN
  const hasRefreshPath = envMissing.length === 0 && spec.refreshMode === 'refresh_token' && before.hasRefreshToken

  // Nothing can renew a token with no refresh path, so its getter is not called
  // (it would only return the same token or throw "expired, no refresh token").
  let refreshError: string | null = null
  if (hasRefreshPath) {
    try {
      const token = await exerciseGetter(spec.platform, sb, secrets)
      if (token) secrets.add(token)
    } catch (err) {
      refreshError = errorDetail(err, secrets)
    }
  }

  let after: TokenRow | null
  try {
    after = await readTokenRow(sb, spec, secrets)
  } catch (err) {
    return { ...base, readError: errorDetail(err, secrets) }
  }
  const afterMs = after?.expiresAt ? Date.parse(after.expiresAt) : Number.NaN
  return {
    envMissing,
    row: after,
    readError: null,
    refreshError,
    refreshed: Number.isFinite(beforeMs) && Number.isFinite(afterMs) && afterMs > beforeMs,
  }
}

async function observeMeta(secrets: Set<string>): Promise<MetaObservation> {
  const token = getMetaPageToken()?.trim()
  if (!token) return { tokenPresent: false }
  secrets.add(token)
  try {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/me?fields=id&access_token=${encodeURIComponent(token)}`,
    )
    const d = (await r.json()) as { id?: string; error?: { message?: string; code?: number } }
    if (d.id) return { tokenPresent: true, ok: true, pageId: d.id }
    return {
      tokenPresent: true,
      ok: false,
      code: typeof d.error?.code === 'number' ? d.error.code : null,
      detail: errorDetail(d.error?.message ?? `HTTP ${r.status}`, secrets),
    }
  } catch (err) {
    return { tokenPresent: true, ok: false, code: null, detail: errorDetail(err, secrets) }
  }
}

async function checkPlatform(spec: PlatformSpec, secrets: Set<string>): Promise<HeartbeatResult> {
  const t0 = Date.now()
  let r: HeartbeatResult
  try {
    r =
      spec.platform === 'meta'
        ? classifyMeta(await observeMeta(secrets))
        : classifyToken(spec, await observeOAuthPlatform(spec, secrets), Date.now())
  } catch (err) {
    // A probe that throws is a failure the run reports, never a silent gap.
    r = checkFailed(spec, errorDetail(err, secrets))
  }
  return { ...r, message: redactSecrets(r.message, secrets), durationMs: Date.now() - t0 }
}

/** Best-effort sync_logs write. Returns the error text (never throws). */
async function writeSyncLogs(rows: ReturnType<typeof toSyncLogRows>): Promise<string | null> {
  try {
    const { error } = await createServiceClient().from('sync_logs').insert(rows)
    return error ? error.message : null
  } catch (err) {
    return err instanceof Error ? err.message : 'sync_logs write threw'
  }
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const notify = new URL(request.url).searchParams.get('notify') !== '0'
  const started = new Date()
  const date = started.toISOString().slice(0, 10)
  const cycleId = randomUUID()
  // Every token value this run touches, so no message can echo one.
  const secrets = new Set<string>()

  const results = await Promise.all(PLATFORM_SPECS.map((spec) => checkPlatform(spec, secrets)))
  // The checks run in parallel, so redact again with every value the whole run saw.
  for (const r of results) r.message = redactSecrets(r.message, secrets)

  // One text per failing platform + state + UTC date (dedupe lives in
  // queueBrokerHealthAlert's `[crm-health:<key>]` marker). Loaded only when
  // there is something to say, so a healthy run never touches the alert module.
  const failing = results.filter((r) => r.severity === 'failure')
  if (notify && failing.length > 0) {
    const { queueBrokerHealthAlert } = await import('@/lib/crm/broker-alerts')
    for (const r of failing) {
      r.alertQueued = await queueBrokerHealthAlert({
        key: alertKey(r.platform, r.state, date),
        body: redactSecrets(alertBody(r), secrets),
        cooldownMinutes: ALERT_COOLDOWN_MINUTES,
      })
    }
  }

  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'
  const syncRows = toSyncLogRows(results, cycleId, environment, Date.now() - started.getTime())
  const syncLogError = await writeSyncLogs(syncRows)

  const summary = summarize(results)
  for (const r of results) {
    console.log(`[token-heartbeat] ${r.platform} ${r.state} (${r.severity}): ${r.message}`)
  }
  if (syncLogError) console.warn(`[token-heartbeat] sync_logs write failed: ${redactSecrets(syncLogError, secrets)}`)

  const anyFailed = summary.failure > 0
  return NextResponse.json(
    {
      ok: !anyFailed && !syncLogError,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      cycleId,
      date,
      notify,
      summary,
      anyFailed,
      results,
      // Not checked: removed by Matt, listed so a reader knows they are gone on purpose.
      removed: REMOVED_PLATFORMS.map((r) => ({ platform: r.platform, reason: r.reason })),
      syncLogs: { written: syncLogError ? 0 : syncRows.length, error: syncLogError },
    },
    // A dead platform fails the cron. A heartbeat that cannot write its own
    // audit trail is a broken monitor, so that fails it too.
    { status: anyFailed || syncLogError ? 500 : 200, headers: { 'cache-control': 'no-store' } },
  )
}
