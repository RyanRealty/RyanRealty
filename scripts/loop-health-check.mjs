#!/usr/bin/env node
/**
 * loop-health-check.mjs
 *
 * Diagnostic CLI that surfaces the state of every wire in the marketing-brain
 * loop. Reads from Supabase, prints a structured health report.
 *
 * Usage:
 *   node scripts/loop-health-check.mjs                # default: human-readable
 *   node scripts/loop-health-check.mjs --json         # JSON for cron / dashboard
 *   node scripts/loop-health-check.mjs --since=24h    # window override
 *
 * No Anthropic calls. Pure Supabase read.
 * Can be invoked from a Vercel cron at /api/cron/loop-health-check
 * for the daily digest to include in Matt's inbox.
 *
 * Locked 2026-05-17.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = dirname(__dirname)

// Load .env.local if present (for local invocations)
try {
  const env = readFileSync(join(REPO_ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  }
} catch {}

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const sinceArg = args.find((a) => a.startsWith('--since='))?.split('=')[1] || '24h'

function hoursFromArg(s) {
  if (s.endsWith('h')) return parseFloat(s)
  if (s.endsWith('d')) return parseFloat(s) * 24
  return 24
}
const windowHours = hoursFromArg(sinceArg)
const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const checks = []
function check(name, status, value, note = '') {
  checks.push({ name, status, value, note })
}

async function main() {
  // Layer 1: data ingestion. Use an RPC-style query so we only pull MAX(fetched_at) per channel
  // rather than 1000-row default which can miss the freshest row in a large table like gsc (17k+ rows).
  const channelList = ['ga4', 'gsc', 'fub', 'meta_page', 'instagram', 'x', 'youtube', 'linkedin', 'tiktok', 'gbp']
  const byChannel = {}
  for (const chan of channelList) {
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('fetched_at')
      .eq('channel', chan)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.fetched_at) byChannel[chan] = data.fetched_at
  }
  for (const [chan, ts] of Object.entries(byChannel)) {
    const ageHours = (Date.now() - new Date(ts).getTime()) / 3600000
    const status = ageHours < 30 ? 'green' : ageHours < 72 ? 'yellow' : 'red'
    check(`snapshot:${chan}`, status, `${ageHours.toFixed(1)}h old`, ageHours > 72 ? 'OAuth or API permission issue' : '')
  }

  // Layer 2: brain decisions
  const { data: strategy } = await supabase
    .from('marketing_strategy')
    .select('quarter, north_star_target, channel_targets')
    .eq('status', 'active')
    .maybeSingle()
  check(
    'strategy:active',
    strategy ? 'green' : 'red',
    strategy ? `${strategy.quarter} (north_star=${strategy.north_star_target})` : 'none',
    strategy ? '' : 'No active strategy. Brain operates in baseline mode.',
  )
  if (strategy && !strategy.channel_targets) {
    check('strategy:targets', 'yellow', 'channel_targets is null', 'Brain can rank but not goal-chase')
  }

  // Layer 3: brain emissions
  const counts = {}
  for (const status of ['pending', 'in_production', 'ready', 'needs_changes', 'approved', 'executed', 'killed']) {
    const { count } = await supabase
      .from('marketing_brain_actions')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    counts[status] = count || 0
  }
  check('queue:pending', counts.pending > 20 ? 'red' : counts.pending > 10 ? 'yellow' : 'green',
        `${counts.pending} pending`,
        counts.pending > 10 ? 'Dispatcher may be lagging or producers blocked' : '')
  check('queue:in_production',
        counts.in_production > 5 ? 'yellow' : 'green',
        `${counts.in_production} in_production`,
        counts.in_production > 5 ? 'Runtime executor lagging; set PRODUCER_RUNTIME_ENABLED or click Run-now' : '')
  check('queue:ready', counts.ready > 0 ? 'green' : 'yellow',
        `${counts.ready} ready for Matt review`,
        counts.ready === 0 ? 'Approval queue empty. Brain cycle may not have fired this week.' : '')
  check('queue:approved', counts.approved > 3 ? 'yellow' : 'green',
        `${counts.approved} approved waiting publish`,
        counts.approved > 3 ? 'Publisher-sweep may be lagging or publish_payload missing' : '')
  check('queue:executed_total', 'info', `${counts.executed} executed lifetime`)

  // Layer 4: oldest pending age
  const { data: oldest } = await supabase
    .from('marketing_brain_actions')
    .select('id, created_at, action_type')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (oldest) {
    const ageDays = (Date.now() - new Date(oldest.created_at).getTime()) / 86400000
    check('queue:oldest_pending',
          ageDays > 7 ? 'red' : ageDays > 3 ? 'yellow' : 'green',
          `${ageDays.toFixed(1)} days`,
          ageDays > 7 ? `Pending since ${oldest.created_at}; ${oldest.action_type}` : '')
  }

  // Layer 5: performance ingestion
  const { count: perfCount } = await supabase
    .from('content_performance')
    .select('id', { count: 'exact', head: true })
  check('performance:total_rows', perfCount > 0 ? 'green' : 'yellow',
        `${perfCount} rows`,
        perfCount === 0 ? 'No posts published yet OR publisher-sweep not creating rows' : '')

  // Layer 6: cost ledger
  const { data: costRecent } = await supabase
    .from('marketing_cost_ledger')
    .select('cost_type, amount_usd, recorded_at')
    .gte('recorded_at', windowStart)
  const costBy = {}
  for (const r of costRecent || []) {
    costBy[r.cost_type] = (costBy[r.cost_type] || 0) + Number(r.amount_usd)
  }
  const total = Object.values(costBy).reduce((s, n) => s + n, 0)
  check(
    `cost:last_${sinceArg}`,
    total > 50 ? 'red' : total > 15 ? 'yellow' : 'green',
    `$${total.toFixed(2)} (${Object.entries(costBy).map(([k, v]) => `${k}=$${v.toFixed(2)}`).join(', ') || 'no spend'})`,
    total > 50 ? 'Investigate which producer is overspending' : '',
  )

  // Layer 7: producer execution failures
  const { count: failCount } = await supabase
    .from('producer_execution_failures')
    .select('id', { count: 'exact', head: true })
    .gte('occurred_at', windowStart)
    .is('resolved_at', null)
  check('failures:unresolved_window',
        failCount > 5 ? 'red' : failCount > 0 ? 'yellow' : 'green',
        `${failCount} unresolved in last ${sinceArg}`)

  // Layer 8: env vars at a glance
  const envChecks = {
    'env:CRON_SECRET': process.env.CRON_SECRET ? 'green' : 'red',
    'env:ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? 'green' : 'red',
    'env:PRODUCER_RUNTIME_ENABLED': process.env.PRODUCER_RUNTIME_ENABLED === 'true' ? 'green' : 'yellow',
    'env:RESEND_FROM': process.env.RESEND_FROM ? 'green' : 'yellow',
    'env:WP_AGENTFIRE_APP_PASSWORD': process.env.WP_AGENTFIRE_APP_PASSWORD ? 'green' : 'yellow',
  }
  for (const [k, v] of Object.entries(envChecks)) {
    check(k, v, v === 'green' ? 'set' : 'unset/false', v === 'red' ? 'Required for production' : v === 'yellow' ? 'Recommended; producer falls back gracefully without' : '')
  }

  // Layer 9: Matt-action checklist (OAuth rows + Pinterest credentials)
  const { count: ttRows } = await supabase.from('tiktok_auth').select('id', { count: 'exact', head: true })
  check('matt:tiktok_oauth', (ttRows || 0) > 0 ? 'green' : 'yellow',
        (ttRows || 0) > 0 ? `${ttRows} oauth row(s)` : 'no oauth row',
        (ttRows || 0) > 0 ? '' : 'Walk through /api/tiktok/authorize/ once')

  const { count: gbpRows } = await supabase.from('google_business_profile_auth').select('id', { count: 'exact', head: true })
  check('matt:gbp_oauth', (gbpRows || 0) > 0 ? 'green' : 'yellow',
        (gbpRows || 0) > 0 ? `${gbpRows} oauth row(s); check GBP snapshot age above for scope` : 'no oauth row',
        (gbpRows || 0) > 0 ? '' : 'Walk through /api/google-business-profile/authorize/ with business.manage scope')

  const pinSet = !!process.env.PINTEREST_CLIENT_ID && !!process.env.PINTEREST_CLIENT_SECRET
  check('matt:pinterest_creds', pinSet ? 'green' : 'yellow',
        pinSet ? 'client id + secret set' : 'unset',
        pinSet ? '' : 'Create Pinterest developer app + set PINTEREST_CLIENT_ID + PINTEREST_CLIENT_SECRET')

  // Summary
  const greens = checks.filter((c) => c.status === 'green').length
  const yellows = checks.filter((c) => c.status === 'yellow').length
  const reds = checks.filter((c) => c.status === 'red').length
  const summary = {
    checked_at: new Date().toISOString(),
    window: sinceArg,
    total_checks: checks.length,
    green: greens,
    yellow: yellows,
    red: reds,
    overall: reds > 0 ? 'red' : yellows > 0 ? 'yellow' : 'green',
  }

  if (asJson) {
    console.log(JSON.stringify({ summary, checks }, null, 2))
  } else {
    console.log(`\nLoop Health Check (${summary.checked_at})`)
    console.log(`Window: last ${sinceArg}`)
    console.log(`Overall: ${summary.overall.toUpperCase()}  (green=${greens} yellow=${yellows} red=${reds})\n`)
    for (const c of checks) {
      const icon = c.status === 'green' ? '+' : c.status === 'yellow' ? '~' : c.status === 'red' ? '!' : '.'
      const note = c.note ? `  -- ${c.note}` : ''
      console.log(`  ${icon} ${c.name.padEnd(36)} ${String(c.value).padEnd(40)}${note}`)
    }
    console.log()
  }
}

main().catch((e) => {
  console.error('loop-health-check failed:', e.message)
  process.exit(1)
})
