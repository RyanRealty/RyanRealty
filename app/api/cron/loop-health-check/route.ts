/**
 * /api/cron/loop-health-check
 *
 * Daily diagnostic that surfaces the state of every wire in the marketing-brain
 * loop AND every critical data pipeline (sync-delta, MV refreshes, FSBO scrape,
 * expired detection, saved-search engine, market_stats_cache). Pipelines fail
 * silently — the FSBO scrape went dark on an Apify cap, listing_tile_mv sat 8
 * days stale — so staleness here sends ONE consolidated alert email to Matt.
 * Threshold logic is pure and unit-tested in lib/pipeline-heartbeat.ts.
 *
 * Writes findings to marketing_decisions for the next daily digest to
 * include. Same logic as scripts/loop-health-check.mjs but server-side.
 *
 * Schedule: daily 12:30 UTC (05:30 Mountain). vercel.json entry required.
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 * Manual: GET /api/cron/loop-health-check
 *
 * Pure Supabase reads; no Anthropic calls; near-zero cost (one Resend send
 * only when something is stale).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { sendEmail } from '@/lib/resend'
import {
  evalAudienceSync,
  evalMacroSeries,
  evalMetaAudienceHold,
  evalSkySlopeMirror,
  evalExpired,
  evalFsbo,
  evalMarketStats,
  evalSavedSearch,
  evalSearchMv,
  evalSyncDelta,
  probeFailed,
  summarizeHeartbeat,
  type PipelineCheck,
} from '@/lib/pipeline-heartbeat'
import { WESTSIDE_AUDIENCE_ID } from '@/lib/meta-westside-audience'
import { getSkySlopeMirrorFreshness } from '@/lib/data/tc/skyslope-mirror'
import { readMetaAudienceHold } from '@/lib/data/loop/meta-audience-hold'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type CheckStatus = 'green' | 'yellow' | 'red' | 'info'
interface Check { name: string; status: CheckStatus; value: string; note?: string }

const CHANNELS = ['ga4', 'gsc', 'fub', 'meta_page', 'instagram', 'x', 'youtube', 'linkedin', 'tiktok', 'gbp']

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const checks: Check[] = []
  const push = (name: string, status: CheckStatus, value: string, note?: string) =>
    checks.push({ name, status, value, note })

  // Data ingestion freshness per channel
  for (const chan of CHANNELS) {
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('fetched_at')
      .eq('channel', chan)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data?.fetched_at) {
      push(`snapshot:${chan}`, 'red', 'no rows ever', 'OAuth not completed for this platform')
      continue
    }
    const hours = (Date.now() - new Date(data.fetched_at).getTime()) / 3600000
    const status = hours < 30 ? 'green' : hours < 72 ? 'yellow' : 'red'
    push(`snapshot:${chan}`, status, `${hours.toFixed(1)}h old`,
         hours > 72 ? 'OAuth or API permission issue' : undefined)
  }

  // Value-aware probe — recency alone is a LIAR. A channel can be "fresh"
  // (recent fetched_at, graded green above) yet carry permanent ZEROS: GSC
  // ingested inside its 2-3 day processing delay wrote 0s that never got
  // re-pulled, so the whole Search channel read 0 while the recency check
  // happily reported green. For the channels that MUST carry nonzero volume
  // when healthy, sum the trailing-8-day account-scope volume metric and flag
  // a fresh-but-zero channel that recency would otherwise hide.
  const VALUE_AWARE: { channel: string; metric: string; label: string }[] = [
    { channel: 'gsc', metric: 'impressions', label: 'GSC impressions' },
    { channel: 'ga4', metric: 'sessions', label: 'GA4 sessions' },
  ]
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  for (const v of VALUE_AWARE) {
    const { data: rows } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', v.channel)
      .eq('scope', 'account')
      .eq('metric', v.metric)
      .gte('date', eightDaysAgo)
    const n = (rows || []).length
    const sum = (rows || []).reduce((s, r) => s + Number(r.value || 0), 0)
    if (n === 0) {
      push(`value:${v.channel}`, 'red', `no ${v.metric} rows in 8d`,
           'Account-scope volume rows are not being written. Ingestor is dead or misconfigured.')
    } else {
      push(`value:${v.channel}`, sum > 0 ? 'green' : 'yellow',
           `${v.label} 8d sum = ${sum.toFixed(0)} (${n} rows)`,
           sum === 0
             ? 'Fresh but ZERO volume. Likely ingested inside the source processing-delay window. Verify the rolling re-pull is correcting settled dates.'
             : undefined)
    }
  }

  // Strategy active
  const { data: strategy } = await supabase
    .from('marketing_strategy')
    .select('quarter, north_star_target, channel_targets')
    .eq('status', 'active')
    .maybeSingle()
  push('strategy:active', strategy ? 'green' : 'red',
       strategy ? `${strategy.quarter} (north_star=${strategy.north_star_target})` : 'none',
       strategy ? undefined : 'No active strategy. Brain operates in baseline mode.')

  // Queue depths
  for (const status of ['pending', 'in_production', 'ready', 'needs_changes', 'approved', 'executed'] as const) {
    const { count } = await supabase
      .from('marketing_brain_actions')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    if (status === 'pending') push('queue:pending', (count || 0) > 20 ? 'red' : (count || 0) > 10 ? 'yellow' : 'green', `${count || 0} pending`)
    else if (status === 'in_production') push('queue:in_production', (count || 0) > 5 ? 'yellow' : 'green', `${count || 0} in_production`)
    else if (status === 'ready') push('queue:ready', (count || 0) === 0 ? 'yellow' : 'green', `${count || 0} ready`)
    else if (status === 'approved') push('queue:approved', (count || 0) > 3 ? 'yellow' : 'green', `${count || 0} approved waiting publish`)
    else if (status === 'executed') push('queue:executed_lifetime', 'info', String(count || 0))
  }

  // Performance + cost
  const { count: perfCount } = await supabase
    .from('content_performance')
    .select('id', { count: 'exact', head: true })
  push('performance:total_rows', (perfCount || 0) > 0 ? 'green' : 'yellow', `${perfCount || 0} rows`,
       (perfCount || 0) === 0 ? 'No posts published yet OR publisher-sweep not creating rows' : undefined)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: costs } = await supabase
    .from('marketing_cost_ledger')
    .select('cost_type, amount_usd')
    .gte('recorded_at', since)
  const totalCost = (costs || []).reduce((s, r) => s + Number(r.amount_usd), 0)
  push('cost:last_24h', totalCost > 50 ? 'red' : totalCost > 15 ? 'yellow' : 'green',
       `$${totalCost.toFixed(2)}`,
       totalCost > 50 ? 'Investigate spend by producer' : undefined)

  // Failures
  const { count: failCount } = await supabase
    .from('producer_execution_failures')
    .select('id', { count: 'exact', head: true })
    .gte('occurred_at', since)
    .is('resolved_at', null)
  push('failures:unresolved_24h', (failCount || 0) > 5 ? 'red' : (failCount || 0) > 0 ? 'yellow' : 'green',
       `${failCount || 0} unresolved`)

  // Env vars
  for (const [env, required] of Object.entries({
    CRON_SECRET: true,
    ANTHROPIC_API_KEY: true,
    PRODUCER_RUNTIME_ENABLED: false,
    RESEND_FROM: false,
    WP_AGENTFIRE_APP_PASSWORD: false,
  })) {
    const set = !!process.env[env] && process.env[env] !== 'false'
    push(`env:${env}`, set ? 'green' : required ? 'red' : 'yellow',
         set ? 'set' : 'unset', set ? undefined : required ? 'REQUIRED' : 'Recommended')
  }

  // GSC query-slice freshness. The by-query data the diagnose rules need
  // (striking-distance: position 5-15 on real volume) lives under
  // scope='campaign' with scope_id 'query:<q>' (see marketing-snapshot-gsc
  // rowsForDay). The account-level snapshot check stays green even when this
  // slice silently stops, so probe it explicitly.
  try {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    // Existence probe on 'date' (this table has NO id column — composite PK),
    // with the query error surfaced as its own red: a silently swallowed
    // error here reads identical to "slice dark", which is this check's
    // whole failure mode.
    const { data: gscQueryProbe, error: gscQueryErr } = await supabase
      .from('marketing_channel_daily')
      .select('date')
      .eq('channel', 'gsc')
      .eq('scope', 'campaign')
      .gte('date', eightDaysAgo)
      .limit(1)
    if (gscQueryErr) {
      push('value:gsc-queries', 'red', 'probe failed', gscQueryErr.message)
    } else {
      const hasQueryRows = (gscQueryProbe?.length ?? 0) > 0
      push(
        'value:gsc-queries',
        hasQueryRows ? 'green' : 'red',
        hasQueryRows ? 'query rows present 8d' : '0 query rows 8d',
        hasQueryRows ? undefined : 'GSC query slice dark. Striking-distance diagnosis impossible.'
      )
    }
  } catch (e) {
    push('value:gsc-queries', 'red', 'probe failed', e instanceof Error ? e.message : String(e))
  }

  // ---------------------------------------------------------------------
  // Pipeline heartbeat — freshness of every critical data pipeline.
  // Threshold logic is pure + unit-tested (lib/pipeline-heartbeat.ts); this
  // block only fetches the latest timestamps. A failed probe is itself red:
  // a swallowed query error reads identical to a dark pipeline, which is the
  // exact failure mode this watchdog exists to catch.
  // ---------------------------------------------------------------------
  const now = new Date()
  const pipeline: PipelineCheck[] = []

  // Top-1 timestamp via order-desc-limit-1. nullsFirst:false + not-null
  // filter so NULL rows can never mask the real max.
  const latestTimestamp = async (
    table: string,
    column: string,
    eq?: { column: string; value: string },
  ): Promise<{ iso: string | null; error?: string }> => {
    try {
      let q = supabase
        .from(table)
        .select(column)
        .not(column, 'is', null)
      // Optional equality filter — e.g. scope meta_audience_log to ONE audience_id
      // so a shared ledger table's other writers can't mask this pipeline (W1.1).
      if (eq) q = q.eq(eq.column, eq.value)
      const { data, error } = await q
        .order(column, { ascending: false, nullsFirst: false })
        .limit(1)
      if (error) return { iso: null, error: error.message }
      // Dynamic column select defeats supabase-js inference — the rows are
      // plain objects keyed by the requested column.
      const row = (data as unknown as Record<string, unknown>[] | null)?.[0]
      return { iso: (row?.[column] as string | undefined) ?? null }
    } catch (e) {
      return { iso: null, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // MV refresh stamps: every row carries the SAME refreshed_at (now() is
  // stable within the refresh statement), so any non-null row is the value —
  // no 596K-row sort needed.
  const mvRefreshStamp = async (
    table: string,
  ): Promise<{ iso: string | null; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('refreshed_at')
        .not('refreshed_at', 'is', null)
        .limit(1)
      if (error) return { iso: null, error: error.message }
      const row = (data as { refreshed_at: string | null }[] | null)?.[0]
      return { iso: row?.refreshed_at ?? null }
    } catch (e) {
      return { iso: null, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // 1. sync-delta ingest + listing_tile_mv (compound signal — max(modified_at)
  //    only advances when both the Spark ingest and the hourly MV refresh are
  //    alive; refreshed_at disambiguates which half died).
  {
    const [mod, ref] = await Promise.all([
      latestTimestamp('listing_tile_mv', 'modified_at'),
      mvRefreshStamp('listing_tile_mv'),
    ])
    if (mod.error) pipeline.push(probeFailed('pipeline:sync-delta', mod.error))
    else pipeline.push(evalSyncDelta(mod.iso, ref.iso, now))
  }

  // 2. listing_search_mv freshness (exposes refreshed_at per the schema snapshot).
  {
    const ref = await mvRefreshStamp('listing_search_mv')
    if (ref.error) pipeline.push(probeFailed('pipeline:listing_search_mv', ref.error))
    else pipeline.push(evalSearchMv(ref.iso, now))
  }

  // 3. FSBO scrape (daily Apify actor — the known silent killer is the usage cap).
  {
    const seen = await latestTimestamp('fsbo_listings', 'last_seen_at')
    if (seen.error) pipeline.push(probeFailed('pipeline:fsbo-scrape', seen.error))
    else pipeline.push(evalFsbo(seen.iso, now))
  }

  // 4. Expired-listing detection (soft WARN — low volume is normal).
  {
    const created = await latestTimestamp('expired_listings', 'created_at')
    if (created.error) pipeline.push(probeFailed('pipeline:expired-detect', created.error))
    else pipeline.push(evalExpired(created.iso, now))
  }

  // 5. Saved-search engine. Signal (verified in app/actions/saved-search-alerts.ts):
  //    advanceCursor stamps listing_alerts.last_notified_at on EVERY due-row
  //    scan (even no-match skips), and every real send writes email_events
  //    with email_key 'listing-alert:<id>:<date>'. Either advancing within
  //    26h proves the hourly engine ran.
  {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()
    const [alertCount, book, evt] = await Promise.all([
      supabase
        .from('listing_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('listing_alerts')
        .select('last_notified_at')
        .eq('is_active', true)
        .not('last_notified_at', 'is', null)
        .order('last_notified_at', { ascending: false, nullsFirst: false })
        .limit(1),
      supabase
        .from('email_events')
        .select('occurred_at')
        .like('email_key', 'listing-alert:%')
        .gte('occurred_at', thirtyDaysAgo)
        .order('occurred_at', { ascending: false })
        .limit(1),
    ])
    const probeErr = [alertCount.error?.message, book.error?.message, evt.error?.message]
      .filter(Boolean)
      .join('; ')
    if (probeErr) {
      pipeline.push(probeFailed('pipeline:saved-search-alerts', probeErr))
    } else {
      pipeline.push(
        evalSavedSearch(
          book.data?.[0]?.last_notified_at ?? null,
          evt.data?.[0]?.occurred_at ?? null,
          alertCount.count ?? 0,
          now,
        ),
      )
    }
  }

  // 6. market_stats_cache recompute (daily 07:00 UTC; this check runs 12:30 UTC).
  {
    const computed = await latestTimestamp('market_stats_cache', 'computed_at')
    if (computed.error) pipeline.push(probeFailed('pipeline:market_stats_cache', computed.error))
    else pipeline.push(evalMarketStats(computed.iso, now))
  }

  // 7. West Side Meta audience refresh (weekly cron; every run — dry-run
  //    included — writes a meta_audience_log row, so max(ran_at) proves it ran).
  {
    const ran = await latestTimestamp('meta_audience_log', 'ran_at', {
      column: 'audience_id',
      value: WESTSIDE_AUDIENCE_ID,
    })
    if (ran.error) pipeline.push(probeFailed('pipeline:westside-audience', ran.error))
    else pipeline.push(evalAudienceSync(ran.iso, now))
  }

  // 8. SkySlope inbound recon mirror (daily 06:20 UTC).
  {
    const freshness = await getSkySlopeMirrorFreshness(now)
    if (freshness.status === 'unreadable') {
      pipeline.push(probeFailed('pipeline:skyslope-mirror', 'skyslope_transactions unreadable'))
    } else {
      pipeline.push(evalSkySlopeMirror(freshness.latestSyncedAt, now))
    }
  }

  // 9. INT-007 Meta audience daily hold (CRM + westside ledger).
  {
    const hold = await readMetaAudienceHold(supabase, now)
    pipeline.push(evalMetaAudienceHold(hold))
  }

  // 10. The macro rate series (Mondays 13:00 UTC). Every public payment figure
  //     resolves to this through getCalculatorDefaults, and it is the ONE
  //     statistic on the site nobody here produces — so when it stops arriving
  //     the calculators keep rendering, quietly, on an old rate. No CI gate can
  //     see this: ci:stat-source reads the repo on disk and the static chain
  //     runs without Supabase credentials. Read LIVE with the service client
  //     rather than through getMarketHistoryWeekly, whose 6h unstable_cache
  //     would let a watchdog report freshness from a cached copy.
  //
  //     Ordered by week_start desc so row 0 is the newest week; its captured_at
  //     is re-stamped on every upsert, so it tracks the cron run rather than
  //     the observation date. The value list feeds the flat-series WARN.
  {
    try {
      const { data, error } = await supabase
        .from('market_history_weekly')
        .select('week_start, value, captured_at')
        .eq('geo_type', 'national')
        .eq('geo_slug', 'us')
        .eq('metric', 'mortgage_rate_30yr')
        .order('week_start', { ascending: false })
        .limit(8)
      if (error) {
        pipeline.push(probeFailed('pipeline:macro-rate-series', error.message))
      } else {
        const rows = (data ?? []) as { week_start: string; value: number | string; captured_at: string }[]
        pipeline.push(
          evalMacroSeries(
            {
              latestCapturedAt: rows[0]?.captured_at ?? null,
              latestWeekStart: rows[0]?.week_start ?? null,
              recentValues: rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v)),
            },
            now,
          ),
        )
      }
    } catch (e) {
      pipeline.push(probeFailed('pipeline:macro-rate-series', e instanceof Error ? e.message : String(e)))
    }
  }

  for (const pc of pipeline) push(pc.name, pc.status, pc.value, pc.note)

  // ONE consolidated alert when any pipeline is stale. Healthy = log only.
  const heartbeat = summarizeHeartbeat(pipeline, now)
  let alertEmail: { sent: boolean; id?: string; error?: string } = { sent: false }
  if (!heartbeat.healthy) {
    const to = (process.env.MATT_ALERT_EMAIL || 'matt@ryan-realty.com').trim()
    const sent = await sendEmail({ to, subject: heartbeat.subject, text: heartbeat.text })
    if (sent.error) {
      alertEmail = { sent: false, error: sent.error }
      console.error('[loop-health-check] heartbeat alert email failed:', sent.error)
    } else {
      alertEmail = { sent: true, id: sent.id }
    }
  } else {
    console.log(`[loop-health-check] pipeline heartbeat healthy (${pipeline.length} checks, ${heartbeat.warn.length} warn)`)
  }

  const greens = checks.filter((c) => c.status === 'green').length
  const yellows = checks.filter((c) => c.status === 'yellow').length
  const reds = checks.filter((c) => c.status === 'red').length
  const summary = {
    checked_at: new Date().toISOString(),
    total: checks.length,
    green: greens,
    yellow: yellows,
    red: reds,
    overall: reds > 0 ? 'red' : yellows > 0 ? 'yellow' : 'green',
  }

  // Persist to marketing_decisions for the daily digest to pick up.
  // rules_cited is a text[] NOT NULL column — it MUST be an array, not an
  // object. The prior object insert failed every run and was swallowed by a
  // silent catch, which is exactly why this watchdog never recorded a single
  // observation. Never swallow this insert error again.
  // reviewer is ALSO text NOT NULL with no default — omitting it kept the
  // insert failing after the rules_cited fix (verified 2026-06-09: zero rows
  // despite a clean 200 response). Same convention as the measurement-loop
  // digest: reviewer names the writer, final_decision 'recorded' (automated
  // observations are terminal, never 'awaiting_review').
  try {
    const { error: insertError } = await supabase.from('marketing_decisions').insert({
      decision_type: 'loop_health_check',
      decision_summary: `Loop health: ${summary.overall.toUpperCase()} (${greens} green, ${yellows} yellow, ${reds} red)`,
      data_observed: { summary, checks },
      rules_cited: ['app/api/cron/loop-health-check/route.ts'],
      reviewer: 'marketing_brain:loop-health-check',
      final_decision: 'recorded',
    })
    if (insertError) {
      console.error('[loop-health-check] marketing_decisions insert failed:', insertError.message)
    }
  } catch (e) {
    console.error('[loop-health-check] marketing_decisions insert threw:', e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({
    summary,
    heartbeat: {
      healthy: heartbeat.healthy,
      stale: heartbeat.stale.length,
      warn: heartbeat.warn.length,
      alertEmail,
    },
    checks,
  })
}
