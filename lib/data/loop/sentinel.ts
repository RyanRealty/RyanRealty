/**
 * Loop sentinel — the self-starter (THE LOOP v1.6.x, R-206 GO 2026-08-15).
 * Not on the public barrel (file-size budget).
 * reachability: entry-point /api/cron/loop-sentinel
 *
 * Every few hours the cron asks one question: is the loop dormant while
 * eligible work exists? If yes, launch a Cursor cloud agent whose entire
 * prompt is "run the loop, grind until blocked." Nobody has to say it.
 *
 * Guards: kill switch (env LOOP_SENTINEL=off) · activity check (a fresh
 * in_progress node = a session is working; stand down) · cooldown (one
 * launch per 3h, tracked in sync_logs) · missing API key = skip + say so.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const REPO_URL = 'https://github.com/RyanRealty/RyanRealty'
const ACTIVE_WINDOW_MIN = 180
const COOLDOWN_MIN = 180

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

  const { data: lastLaunch } = await sb
    .from('sync_logs')
    .select('logged_at')
    .eq('endpoint', 'loop_sentinel:launch')
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastLaunch?.logged_at && now - Date.parse(String(lastLaunch.logged_at)) < COOLDOWN_MIN * 60_000) {
    return { action: 'skipped', reason: `cooldown (launched within ${COOLDOWN_MIN} min)`, openNodes }
  }

  const apiKey = process.env.CURSOR_API_KEY?.trim()
  if (!apiKey) return { action: 'skipped', reason: 'CURSOR_API_KEY missing in this environment', openNodes }

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
