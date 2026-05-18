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

  // Persist to marketing_decisions for the daily digest to pick up
  try {
    await supabase.from('marketing_decisions').insert({
      decision_type: 'loop_health_check',
      decision_summary: `Loop health: ${summary.overall.toUpperCase()} (${greens} green, ${yellows} yellow, ${reds} red)`,
      data_observed: { summary, checks },
      rules_cited: { source: 'app/api/cron/loop-health-check/route.ts' },
    })
  } catch (e) {
    // soft fail
  }

  return NextResponse.json({ summary, checks })
}
