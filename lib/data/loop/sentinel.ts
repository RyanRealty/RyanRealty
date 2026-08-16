/**
 * Loop sentinel — the self-starter (THE LOOP v1.6.x, R-206 GO 2026-08-15).
 * Not on the public barrel (file-size budget).
 * reachability: entry-point /api/cron/loop-sentinel
 *
 * Every few hours the cron asks one question: is the loop dormant while
 * eligible work exists? If yes, launch a Cursor cloud agent whose entire
 * prompt is "run the loop, grind until blocked." Nobody has to say it.
 *
 * STATE-BASED, not timer-based (Matt 2026-08-15: a 1-hour iteration must not
 * leave 3 dormant hours). The cron heartbeats every 10 minutes — pure
 * deterministic code, no model tokens — and relaunches the moment the
 * previous agent's newest run is terminal. Guards: kill switch
 * (LOOP_SENTINEL=off) · fresh-activity standdown (a working session holds
 * the floor) · busy check via the Cursor API (newest run CREATING/RUNNING)
 * · 15-min boot guard (covers the window before an agent's first claim) ·
 * daily launch cap (cost circuit-breaker) · missing key = skip + say so.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const REPO_URL = 'https://github.com/RyanRealty/RyanRealty'
const ACTIVE_WINDOW_MIN = 180
const BOOT_GUARD_MIN = 15
const DAILY_LAUNCH_CAP = 12

const LOOP_PROMPT = `Run the loop. You are the scheduled loop-sentinel iteration for Ryan Realty (THE LOOP — docs/DEVELOPMENT_PROCESS.md is canon).

Boot: read docs/plans/CROSS_AGENT_HANDOFF.md (Current block), then run \`npx tsx scripts/loop-brief.ts\` and follow it exactly: claim the served node, load its required reads, do the class on every blast-radius plane it names, accept against the node's own accept test with environment evidence, ship per canon (gates green, push to main, npm run deploy:verify to READY, hosted migrations in the same delivery), complete the node with evidence, update the handoff Current block. Then continue to the next served node and repeat until you are blocked.

Hard limits (never cross, no exceptions): no outbound messages to real people, no public posting, no ad spend, no OAuth grants, no SkySlope mutations, no newsletter sends. A node needing one of those goes to blocked with the reason and you move on. If everything is blocked, write the blockers into the handoff and finish cleanly.`

export type SentinelDecision = {
  action: 'launched' | 'skipped' | 'dry-would-launch'
  reason: string
  agentId?: string
  openNodes?: number
}

export async function runLoopSentinel(opts: { dry: boolean }): Promise<SentinelDecision> {
  if (process.env.LOOP_SENTINEL === 'off') {
    return { action: 'skipped', reason: 'kill switch (LOOP_SENTINEL=off)' }
  }

  const sb = createServiceClient()
  const now = Date.now()

  const { data: nodes, error } = await sb
    .from('loop_work_nodes')
    .select('state,updated_at')
    .in('state', ['open', 'in_progress'])
  if (error) return { action: 'skipped', reason: `graph unreadable (${error.message}) — refusing to launch blind` }

  const freshActive = (nodes ?? []).some(
    (n) => n.state === 'in_progress' && now - Date.parse(String(n.updated_at)) < ACTIVE_WINDOW_MIN * 60_000,
  )
  if (freshActive) return { action: 'skipped', reason: 'a session is actively working (fresh in_progress node)' }

  const openNodes = (nodes ?? []).filter((n) => n.state === 'open').length
  if (openNodes === 0) return { action: 'skipped', reason: 'no eligible open nodes (all done or blocked)', openNodes }

  const apiKey = process.env.CURSOR_API_KEY?.trim()
  if (!apiKey) return { action: 'skipped', reason: 'CURSOR_API_KEY missing in this environment', openNodes }

  const { data: launches } = await sb
    .from('sync_logs')
    .select('logged_at,sync_cycle_id')
    .eq('endpoint', 'loop_sentinel:launch')
    .gte('logged_at', new Date(now - 24 * 60 * 60_000).toISOString())
    .order('logged_at', { ascending: false })
  const recent = launches ?? []
  if (recent.length >= DAILY_LAUNCH_CAP) {
    return { action: 'skipped', reason: `daily launch cap reached (${DAILY_LAUNCH_CAP}/24h) — cost circuit-breaker; investigate why iterations end fast`, openNodes }
  }
  const last = recent[0]
  if (last?.logged_at && now - Date.parse(String(last.logged_at)) < BOOT_GUARD_MIN * 60_000) {
    return { action: 'skipped', reason: `boot guard (launched within ${BOOT_GUARD_MIN} min — agent may not have claimed yet)`, openNodes }
  }
  // State-based busy check: relaunch the MOMENT the previous agent is done,
  // never on a timer. Newest run CREATING/RUNNING = still working, stand down.
  if (last?.sync_cycle_id) {
    try {
      const resp = await fetch(
        `https://api.cursor.com/v1/agents/${encodeURIComponent(String(last.sync_cycle_id))}/runs?limit=1`,
        { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` } },
      )
      if (resp.ok) {
        const runs = (await resp.json()) as { runs?: Array<{ status?: string }> } | Array<{ status?: string }>
        const list = Array.isArray(runs) ? runs : (runs?.runs ?? [])
        const status = String(list[0]?.status ?? '').toUpperCase()
        if (status === 'CREATING' || status === 'RUNNING') {
          return { action: 'skipped', reason: `previous loop agent still working (run ${status})`, openNodes }
        }
      }
      // Non-OK (agent expired/archived/404): treat as not busy — the boot
      // guard and the claim mutex bound any duplicate risk.
    } catch {
      // Network hiccup: same fail-toward-launch posture, bounded by guards.
    }
  }

  if (opts.dry) return { action: 'dry-would-launch', reason: 'all checks passed (dry run — no agent launched)', openNodes }

  const resp = await fetch('https://api.cursor.com/v1/agents', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: { text: LOOP_PROMPT },
      name: `loop-sentinel ${new Date().toISOString().slice(0, 16)}`,
      repos: [{ url: REPO_URL, startingRef: 'main' }],
    }),
  })
  const body = (await resp.json().catch(() => ({}))) as { id?: string; error?: unknown }
  if (!resp.ok || !body?.id) {
    return { action: 'skipped', reason: `launch failed: HTTP ${resp.status} ${JSON.stringify(body).slice(0, 200)}`, openNodes }
  }

  await sb.from('sync_logs').insert({
    endpoint: 'loop_sentinel:launch',
    method: 'POST',
    response_status: 200,
    environment: process.env.VERCEL_ENV ?? 'development',
    error_message: null,
    alert_sent: false,
    sync_cycle_id: body.id,
  })

  return { action: 'launched', reason: 'loop was dormant with eligible work', agentId: body.id, openNodes }
}
