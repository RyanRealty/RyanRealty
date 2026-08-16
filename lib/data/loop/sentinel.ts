/**
 * Loop sentinel — the self-starter (THE LOOP v1.6.x, R-206 GO 2026-08-15).
 * Not on the public barrel (file-size budget).
 * reachability: entry-point /api/cron/loop-sentinel
 *
 * Every few hours the cron asks one question: is the loop dormant while
 * eligible work exists? If yes, launch a Cursor cloud agent whose entire
 * prompt is "run the loop for exactly ONE node, then chain." Nobody has to
 * say it. One node per session (pre-arm item 2): fresh context per node, the
 * zero-gap chain carries continuity. Orphan auto-release (pre-arm item 3):
 * claims whose cloud-agent owner's newest run is terminal release to open.
 *
 * STATE-BASED, not timer-based (Matt 2026-08-15: a 1-hour iteration must not
 * leave 3 dormant hours). The cron heartbeats every 10 minutes — pure
 * deterministic code, no model tokens — and relaunches the moment the
 * previous agent's newest run is terminal. Guards: kill switch
 * (LOOP_SENTINEL=off) · fresh-activity standdown (a working session holds
 * the floor) · busy check via the Cursor API (newest run CREATING/RUNNING)
 * · 15-min boot guard (covers the window before an agent's first claim) ·
 * missing key = skip + say so. No daily launch cap (removed 2026-08-16).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { releaseWorkNode } from './work-graph'
import { shouldAutoRelease } from './work-node'

const REPO_URL = 'https://github.com/RyanRealty/RyanRealty'
const ACTIVE_WINDOW_MIN = 180
const BOOT_GUARD_MIN = 15

const LOOP_PROMPT = `Run the loop for exactly ONE node. You are a loop-sentinel iteration for Ryan Realty (THE LOOP — docs/DEVELOPMENT_PROCESS.md is canon). One node per session is the design: every node gets full fresh context, and the chain — not this session — carries continuity.

Boot: read docs/plans/CROSS_AGENT_HANDOFF.md (Current block), then run \`npx tsx scripts/loop-brief.ts\` and follow it exactly: claim the ONE served node, load its required reads, do the class on every blast-radius plane it names, accept against the node's own accept test with environment evidence, ship per canon (gates green, push to main, npm run deploy:verify to READY, hosted migrations in the same delivery), complete the node with evidence, update the handoff Current block. Do NOT claim a second node — after this node reaches done or blocked, your only remaining job is the final act below.

If the served node cannot proceed, move it to blocked with the concrete reason, write the blocker into the handoff, and go straight to the final act (your successor picks the next node). If the brief serves nothing, update the handoff and finish cleanly without the final act.

Hard limits (never cross, no exceptions): no outbound messages to real people, no public posting, no ad spend, no OAuth grants, no SkySlope mutations, no newsletter sends. A node needing one of those goes to blocked with the reason.

FINAL ACT (after the handoff update is pushed — this is the zero-gap chain): hand the loop to your successor by running
  curl -s -H "Authorization: Bearer $RR_CHAIN_SECRET" "https://ryan-realty.com/api/cron/loop-sentinel?handoff=1"
It launches the next fresh-context iteration immediately if eligible work remains (its own guards decide). If RR_CHAIN_SECRET is not set in your shell, skip this — the 10-minute heartbeat chains for you.`

export type SentinelDecision = {
  action: 'launched' | 'skipped' | 'dry-would-launch'
  reason: string
  agentId?: string
  openNodes?: number
  /** Orphaned claims (owner run terminal) released back to open this pass. */
  orphanReleases?: number
}

type RunStatus = 'ACTIVE' | 'TERMINAL' | 'UNKNOWN'

/** Newest run state for a cloud agent — the one status the chain decisions need. */
async function fetchNewestRunStatus(agentId: string, apiKey: string): Promise<RunStatus> {
  try {
    const resp = await fetch(
      `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs?limit=1`,
      { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` } },
    )
    if (!resp.ok) return 'UNKNOWN'
    const runs = (await resp.json()) as { runs?: Array<{ status?: string }> } | Array<{ status?: string }>
    const list = Array.isArray(runs) ? runs : (runs?.runs ?? [])
    const status = String(list[0]?.status ?? '').toUpperCase()
    if (!status) return 'UNKNOWN'
    return status === 'CREATING' || status === 'RUNNING' ? 'ACTIVE' : 'TERMINAL'
  } catch {
    return 'UNKNOWN'
  }
}

/**
 * handoff=true is the zero-gap chain: the CALLER is a finishing iteration
 * vouching that it is done, so the busy check and boot guard are waived —
 * the successor launches immediately. Kill switch, activity standdown,
 * and the open-work check always apply. There is no daily launch cap.
 */
export async function runLoopSentinel(opts: { dry: boolean; handoff?: boolean }): Promise<SentinelDecision> {
  // Kill switch. Matt arms with "arm the loop" (LOOP_SENTINEL=on) and disarms
  // with "disarm the loop" (off). Armed 2026-08-16 21:52 PT after that word.
  if (process.env.LOOP_SENTINEL === 'off') {
    return { action: 'skipped', reason: 'kill switch (LOOP_SENTINEL=off)' }
  }

  const sb = createServiceClient()
  const now = Date.now()

  const { data: nodes, error } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session,updated_at')
    .in('state', ['open', 'in_progress'])
  if (error) return { action: 'skipped', reason: `graph unreadable (${error.message}) — refusing to launch blind` }

  const apiKey = process.env.CURSOR_API_KEY?.trim()

  // Orphan auto-release (pre-arm item 3): a claim whose cloud-agent owner's
  // newest run is TERMINAL is a dead session's leftover — release it now
  // instead of waiting out the standdown. One status fetch per distinct owner.
  const releasedIds = new Set<string>()
  let orphanReleases = 0
  if (apiKey) {
    const claims = (nodes ?? []).filter((n) => n.state === 'in_progress')
    const statusByOwner = new Map<string, RunStatus>()
    for (const claim of claims) {
      const owner = claim.owner_session == null ? null : String(claim.owner_session)
      if (!owner || !/^bc-/i.test(owner)) continue
      if (!statusByOwner.has(owner)) statusByOwner.set(owner, await fetchNewestRunStatus(owner, apiKey))
      const terminal = statusByOwner.get(owner) === 'TERMINAL'
      const node = {
        state: 'in_progress' as const,
        ownerSession: owner,
        updatedAt: String(claim.updated_at),
      }
      if (!shouldAutoRelease(node, terminal, new Date(now))) continue
      if (opts.dry) {
        orphanReleases += 1
        releasedIds.add(String(claim.id))
        continue
      }
      const { error: relErr } = await releaseWorkNode(String(claim.id))
      if (relErr) {
        console.error('[loop-sentinel] orphan release failed:', relErr)
        continue
      }
      orphanReleases += 1
      releasedIds.add(String(claim.id))
      await sb.from('sync_logs').insert({
        endpoint: 'loop_sentinel:orphan-release',
        method: 'POST',
        response_status: 200,
        environment: process.env.VERCEL_ENV ?? 'development',
        error_message: `node ${claim.id} released (owner run terminal)`,
        alert_sent: false,
        sync_cycle_id: owner,
      })
    }
  }

  const freshActive = (nodes ?? []).some(
    (n) =>
      n.state === 'in_progress' &&
      !releasedIds.has(String(n.id)) &&
      now - Date.parse(String(n.updated_at)) < ACTIVE_WINDOW_MIN * 60_000,
  )
  if (freshActive) {
    return { action: 'skipped', reason: 'a session is actively working (fresh in_progress node)', orphanReleases }
  }

  // Released orphans are open again and count as eligible work.
  const openNodes =
    (nodes ?? []).filter((n) => n.state === 'open').length + releasedIds.size
  if (openNodes === 0) {
    return { action: 'skipped', reason: 'no eligible open nodes (all done or blocked)', openNodes, orphanReleases }
  }

  if (!apiKey) return { action: 'skipped', reason: 'CURSOR_API_KEY missing in this environment', openNodes }

  const { data: launches } = await sb
    .from('sync_logs')
    .select('logged_at,sync_cycle_id')
    .eq('endpoint', 'loop_sentinel:launch')
    .gte('logged_at', new Date(now - 24 * 60 * 60_000).toISOString())
    .order('logged_at', { ascending: false })
  const recent = launches ?? []
  const last = recent[0]
  if (!opts.handoff && last?.logged_at && now - Date.parse(String(last.logged_at)) < BOOT_GUARD_MIN * 60_000) {
    return { action: 'skipped', reason: `boot guard (launched within ${BOOT_GUARD_MIN} min — agent may not have claimed yet)`, openNodes, orphanReleases }
  }
  // State-based busy check: relaunch the MOMENT the previous agent is done,
  // never on a timer. Newest run ACTIVE = still working, stand down. UNKNOWN
  // (expired/archived/404/network) fails toward launch — bounded by the boot
  // guard and the claim mutex. Skipped on handoff: the caller IS the previous
  // agent, mid-final-act.
  if (!opts.handoff && last?.sync_cycle_id) {
    const status = await fetchNewestRunStatus(String(last.sync_cycle_id), apiKey)
    if (status === 'ACTIVE') {
      return { action: 'skipped', reason: 'previous loop agent still working (run active)', openNodes, orphanReleases }
    }
  }

  if (opts.dry) {
    return {
      action: 'dry-would-launch',
      reason: `all checks passed (dry run — no agent launched)${opts.handoff ? ' [handoff mode]' : ''}`,
      openNodes,
      orphanReleases,
    }
  }

  const chainSecret = process.env.CRON_SECRET?.trim()
  const resp = await fetch('https://api.cursor.com/v1/agents', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: { text: LOOP_PROMPT },
      name: `loop-${opts.handoff ? 'chain' : 'sentinel'} ${new Date().toISOString().slice(0, 16)}`,
      repos: [{ url: REPO_URL, startingRef: 'main' }],
      // Zero-gap chain: the agent's clean finish curls ?handoff=1 with this
      // session secret (encrypted, deleted with the agent). envVars is beta —
      // if ignored, the prompt's fallback lets the 10-min heartbeat chain.
      ...(chainSecret ? { envVars: { RR_CHAIN_SECRET: chainSecret } } : {}),
    }),
  })
  // v1 create returns { agent: { id }, run: { id } }; tolerate a flat id too.
  // (2026-08-15 escape: reading body.id logged the FIRST successful launch as
  // a failure and skipped the audit row the busy-check depends on.)
  const body = (await resp.json().catch(() => ({}))) as {
    id?: string
    agent?: { id?: string }
    error?: unknown
  }
  const agentId = body?.agent?.id ?? body?.id
  if (!resp.ok || !agentId) {
    return { action: 'skipped', reason: `launch failed: HTTP ${resp.status} ${JSON.stringify(body).slice(0, 200)}`, openNodes, orphanReleases }
  }

  const { error: logErr } = await sb.from('sync_logs').insert({
    endpoint: 'loop_sentinel:launch',
    method: 'POST',
    response_status: 200,
    environment: process.env.VERCEL_ENV ?? 'development',
    error_message: null,
    alert_sent: false,
    sync_cycle_id: agentId,
  })
  if (logErr) {
    // The busy-check reads this log — a silent miss must be loud.
    console.error('[loop-sentinel] LAUNCH LOG WRITE FAILED (busy-check blind):', logErr.message)
  }

  return { action: 'launched', reason: 'loop was dormant with eligible work', agentId, openNodes, orphanReleases }
}
