/**
 * THE LOOP live status — the one read behind /admin/loop (pre-arm item 1,
 * ARMING-RUNBOOK Step 1). Not on the public barrel (file-size budget).
 * reachability: entry-point /admin/loop
 *
 * Renders from the SAME rows the agents mutate (work graph, ledger, findings,
 * sentinel launch log) — there is no self-reported status anywhere, so the
 * page cannot drift from reality.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { listWorkNodes, type WorkNode } from './work-graph'
import { shipClassKey } from './ship-class'
import { fleetNodePriority, type WorkNodeState } from './work-node'
import { upcomingBucket } from './status-copy'
import { isExpiredUnlearned, windowEndsAt } from './ledger-draft'

const ACTIVE_WINDOW_MIN = 180

export type LoopNodeSummary = {
  id: string
  title: string
  versionGap: string | null
  domain: string
  shipClass: string
  state: WorkNodeState
  ownerSession: string | null
  blockedReason: string | null
  evidenceFirstLine: string | null
  updatedAt: string
}

export type LoopFindingSummary = {
  bot: string
  severity: string
  caseId: string
  url: string
  observed: string
  status: string
  createdAt: string
}

export type LoopUpcomingCounts = {
  urgent: number
  fix: number
  polish: number
  plan: number
}

export type LoopLedgerWindow = {
  id: string
  domain: string
  changeClass: string
  shippedAt: string
  windowDays: number
  endsAt: string
  expired: boolean
}

export type LoopSentinelLaunch = {
  loggedAt: string
  agentId: string
  kind: 'launch' | 'orphan-release'
}

export type LoopStatus = {
  generatedAt: string
  /** Reads the runtime env the sentinel itself reads — same truth. */
  armed: boolean
  nodes: {
    total: number
    byState: Record<WorkNodeState, number>
    /** in_progress with a fresh heartbeat (the standdown window). */
    runningNow: LoopNodeSummary[]
    /** in_progress but past the fresh window — candidates for orphan release. */
    staleClaims: LoopNodeSummary[]
    blocked: LoopNodeSummary[]
    recentDone: LoopNodeSummary[]
    /** What the brief would serve next, in queue order. */
    queueNext: LoopNodeSummary[]
    upcomingCounts: LoopUpcomingCounts
  }
  version: { gapsTotal: number; gapsDone: number }
  findings: { newCount: number; recent: LoopFindingSummary[] }
  ledger: { openWindows: LoopLedgerWindow[]; expiredCount: number }
  sentinel: { launchesToday: number; recent: LoopSentinelLaunch[] }
}

function summarize(n: WorkNode): LoopNodeSummary {
  return {
    id: n.id,
    title: n.title,
    versionGap: n.versionGap,
    domain: n.domain,
    shipClass: shipClassKey({
      id: n.id,
      domain: n.domain,
      title: n.title,
      objective: n.objective,
      versionGap: n.versionGap,
    }),
    state: n.state,
    ownerSession: n.ownerSession,
    blockedReason: n.blockedReason,
    evidenceFirstLine: n.evidence ? n.evidence.split('\n')[0] : null,
    updatedAt: n.updatedAt,
  }
}

export async function getLoopStatus(now: Date = new Date()): Promise<LoopStatus> {
  const sb = createServiceClient()
  const nowMs = now.getTime()

  const [allNodes, findingsRes, ledgerRes, launchesRes] = await Promise.all([
    listWorkNodes(),
    sb
      .from('fleet_findings')
      .select('bot,severity,case_id,url,observed,status,created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    sb
      .from('site_improvement_ledger')
      .select('id,domain,change_class,shipped_at,window_days')
      .is('verdict', null)
      .order('shipped_at', { ascending: false })
      .limit(20),
    sb
      .from('sync_logs')
      .select('logged_at,sync_cycle_id,endpoint')
      .in('endpoint', ['loop_sentinel:launch', 'loop_sentinel:orphan-release'])
      .gte('logged_at', new Date(nowMs - 24 * 60 * 60_000).toISOString())
      .order('logged_at', { ascending: false })
      .limit(20),
  ])

  const byState: Record<WorkNodeState, number> = { open: 0, in_progress: 0, blocked: 0, done: 0, killed: 0 }
  for (const n of allNodes) byState[n.state] += 1

  const inProgress = allNodes.filter((n) => n.state === 'in_progress')
  const fresh = (n: WorkNode) => nowMs - Date.parse(n.updatedAt) < ACTIVE_WINDOW_MIN * 60_000
  const runningNow = inProgress.filter(fresh).map(summarize)
  const staleClaims = inProgress.filter((n) => !fresh(n)).map(summarize)

  const blocked = allNodes.filter((n) => n.state === 'blocked').map(summarize)

  const recentDone = allNodes
    .filter((n) => n.state === 'done')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 10)
    .map(summarize)

  const openSorted = allNodes
    .filter((n) => n.state === 'open')
    .sort((a, b) => fleetNodePriority(a.title) - fleetNodePriority(b.title) || Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const upcomingCounts: LoopUpcomingCounts = { urgent: 0, fix: 0, polish: 0, plan: 0 }
  for (const n of openSorted) upcomingCounts[upcomingBucket(n.title)] += 1
  const queueNext = openSorted.slice(0, 12).map(summarize)

  const gapNodes = allNodes.filter((n) => n.versionGap)
  const gapsDone = gapNodes.filter((n) => n.state === 'done').length

  const findings = (findingsRes.data ?? []).map((r) => ({
    bot: String(r.bot),
    severity: String(r.severity),
    caseId: String(r.case_id),
    url: String(r.url),
    observed: String(r.observed ?? ''),
    status: String(r.status),
    createdAt: String(r.created_at),
  }))
  const newCount = findings.filter((f) => f.status === 'new').length

  const openWindows: LoopLedgerWindow[] = (ledgerRes.data ?? []).map((r) => {
    const shippedAt = String(r.shipped_at)
    const windowDays = Number(r.window_days ?? 14)
    return {
      id: String(r.id),
      domain: String(r.domain),
      changeClass: String(r.change_class),
      shippedAt,
      windowDays,
      endsAt: windowEndsAt(shippedAt, windowDays).toISOString(),
      expired: isExpiredUnlearned({ shippedAt, windowDays, actualDelta: null }, now),
    }
  })

  const launches = (launchesRes.data ?? []).map((r) => ({
    loggedAt: String(r.logged_at),
    agentId: String(r.sync_cycle_id ?? ''),
    kind: (String(r.endpoint).endsWith('orphan-release') ? 'orphan-release' : 'launch') as 'launch' | 'orphan-release',
  }))

  return {
    generatedAt: now.toISOString(),
    armed: process.env.LOOP_SENTINEL !== 'off',
    nodes: { total: allNodes.length, byState, runningNow, staleClaims, blocked, recentDone, queueNext, upcomingCounts },
    version: { gapsTotal: gapNodes.length, gapsDone },
    findings: { newCount, recent: findings },
    ledger: { openWindows, expiredCount: openWindows.filter((w) => w.expired).length },
    sentinel: {
      launchesToday: launches.filter((l) => l.kind === 'launch').length,
      recent: launches,
    },
  }
}
