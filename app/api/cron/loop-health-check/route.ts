/**
 * /api/cron/loop-health-check
 *
 * Daily diagnostic that surfaces the state of every wire in the marketing-brain
 * loop. Writes findings to marketing_decisions for the next daily digest to
 * include. Same logic as scripts/loop-health-check.mjs but server-side.
 *
 * Schedule: daily 12:30 UTC (05:30 Mountain). vercel.json entry required.
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 * Manual: GET /api/cron/loop-health-check
 *
 * Pure Supabase reads; no Anthropic calls; near-zero cost.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type CheckStatus = 'green' | 'yellow' | 'red' | 'info'
interface Check { name: string; status: CheckStatus; value: string; note?: string }

const CHANNELS = ['ga4', 'gsc', 'fub', 'meta_page', 'instagram', 'x', 'youtube', 'linkedin', 'tiktok', 'gbp']

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
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

  return NextResponse.json({ summary, checks })
}
