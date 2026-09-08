/**
 * THE LOOP durable work graph — server DAL. Not on the public barrel (file-size budget).
 * reachability: entry-point loop-brief / seed-work-graph / loop sessions
 *
 * The graph is the source of record for in-flight work. Chat todo lists are
 * mirrors. A node moves to done only with evidence (the Auditor rule: only
 * environment-verified facts enter durable state).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { CompanyImprovementDomain } from './domains'
import {
  appendPunchDispositions,
  canCompletePunchList,
  isFleetPunchListNode,
  openPunchLines,
  type PunchDisposition,
} from './fleet-intake-core'
import {
  assertTransition,
  assertWorkNodeDraft,
  isStaleInProgress,
  type WorkNodeDraft,
  type WorkNodeState,
  MAX_SITE_CLAIMS_PER_SESSION,
  isSiteClaim,
} from './work-node'

export type { WorkNodeDraft, WorkNodeState }

export type WorkNode = {
  id: string
  parentId: string | null
  dependsOn: string[]
  domain: CompanyImprovementDomain
  versionGap: string | null
  title: string
  objective: string
  output: string
  accept: string
  state: WorkNodeState
  evidence: string | null
  blockedReason: string | null
  ownerSession: string | null
  ledgerRowId: string | null
  createdAt: string
  updatedAt: string
}

const COLS =
  'id,parent_id,depends_on,domain,version_gap,title,objective,output,accept,state,evidence,blocked_reason,owner_session,ledger_row_id,created_at,updated_at'

export async function createWorkNode(
  draft: WorkNodeDraft,
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    assertWorkNodeDraft(draft)
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('loop_work_nodes')
      .insert({
        domain: draft.domain,
        title: draft.title,
        objective: draft.objective,
        output: draft.output,
        accept: draft.accept,
        version_gap: draft.versionGap ?? null,
        parent_id: draft.parentId ?? null,
        depends_on: draft.dependsOn ?? [],
      })
      .select('id')
      .single()
    if (error || !data?.id) {
      console.error('[createWorkNode]', error?.message)
      return { data: null, error: error?.message ?? 'insert returned no id' }
    }
    return { data: { id: data.id as string }, error: null }
  } catch (err) {
    console.error('[createWorkNode]', err)
    return { data: null, error: err instanceof Error ? err.message : 'create failed' }
  }
}

export async function listWorkNodes(input?: {
  states?: WorkNodeState[]
  domain?: CompanyImprovementDomain
}): Promise<WorkNode[]> {
  const sb = createServiceClient()
  let q = sb.from('loop_work_nodes').select(COLS).order('created_at', { ascending: true })
  if (input?.states?.length) q = q.in('state', input.states)
  if (input?.domain) q = q.eq('domain', input.domain)
  const { data, error } = await q
  if (error) {
    console.error('[listWorkNodes]', error.message)
    return []
  }
  return (data ?? []).map(mapRow)
}

/** in_progress nodes untouched past the stale window — stranded work for the packet. */
export async function listStaleInProgressNodes(now: Date = new Date()): Promise<WorkNode[]> {
  const open = await listWorkNodes({ states: ['in_progress'] })
  return open.filter((n) => isStaleInProgress({ state: n.state, updatedAt: n.updatedAt }, now))
}

async function transition(
  id: string,
  to: WorkNodeState,
  patch: Record<string, unknown>,
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const sb = createServiceClient()
    const { data: row, error: readErr } = await sb
      .from('loop_work_nodes')
      .select('state')
      .eq('id', id)
      .single()
    if (readErr || !row) return { data: null, error: readErr?.message ?? 'node not found' }
    assertTransition(row.state as WorkNodeState, to)
    // Optimistic concurrency: the update only lands if the state is still the
    // one we asserted from (audit 2026-08-15 found the read-then-write race).
    // The DB trigger loop_work_nodes_guard enforces legality below us too.
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({ ...patch, state: to, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('state', row.state)
      .select('id')
      .single()
    if (error || !data?.id) {
      return { data: null, error: error?.message ?? 'update matched no row (state changed concurrently — re-read and retry)' }
    }
    return { data: { id: data.id as string }, error: null }
  } catch (err) {
    console.error('[workNodeTransition]', err)
    return { data: null, error: err instanceof Error ? err.message : 'transition failed' }
  }
}

/**
 * Heartbeat: the owning session says it is still alive on this node.
 *
 * It writes ONLY heartbeat_at, and only for the session that actually holds the
 * node, so it cannot revive someone else's claim and cannot be mistaken for
 * progress. loop_work_nodes_guard fires on a state change, so this never
 * touches it. Call it at every lane report, at each round boundary, and at
 * least every hour while a lane is building — the boot brief releases a site
 * claim whose heartbeat is older than SITE_CLAIM_IDLE_HOURS.
 */
export async function touchWorkNode(
  id: string,
  ownerSession: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('id', id)
      .eq('state', 'in_progress')
      .eq('owner_session', ownerSession)
      .select('id')
      .maybeSingle()
    if (error) return { data: null, error: error.message }
    if (!data?.id) {
      return { data: null, error: 'heartbeat matched no row — this session no longer holds the node (released or taken)' }
    }
    return { data: { id: data.id as string }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'heartbeat failed' }
  }
}

/**
 * How many site nodes this session already holds. The cap exists because a
 * session takes every node it holds down with it: on 2026-09-08 one session
 * held four and froze all four for hours when the shared account allowance ran
 * out (Matt: "three lanes, hard cap").
 */
export async function countSiteClaims(ownerSession: string): Promise<number> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('loop_work_nodes')
    .select('domain,version_gap')
    .eq('state', 'in_progress')
    .eq('owner_session', ownerSession)
  if (error) return 0
  return (data ?? []).filter((r) =>
    isSiteClaim({ domain: r.domain as string, versionGap: r.version_gap as string | null }),
  ).length
}

export async function claimWorkNode(id: string, ownerSession: string) {
  // The cap is enforced here rather than left to a session's own discipline,
  // because the session that most needs the limit is the one already in
  // trouble. A refused claim is not an error the caller must handle specially:
  // it takes the next eligible node, or none.
  const sb = createServiceClient()
  const { data: node } = await sb
    .from('loop_work_nodes')
    .select('domain,version_gap')
    .eq('id', id)
    .maybeSingle()
  const wantsSite = node
    ? isSiteClaim({ domain: node.domain as string, versionGap: node.version_gap as string | null })
    : false
  if (wantsSite) {
    const held = await countSiteClaims(ownerSession)
    if (held >= MAX_SITE_CLAIMS_PER_SESSION) {
      return {
        data: null,
        error: `claim refused: ${ownerSession} already holds ${held} site node(s), cap is ${MAX_SITE_CLAIMS_PER_SESSION} (Matt 2026-09-08). Finish or release one first.`,
      }
    }
  }
  return transition(id, 'in_progress', {
    owner_session: ownerSession,
    blocked_reason: null,
    heartbeat_at: new Date().toISOString(),
  })
}

/** Claim every node in a ship class so another session cannot steal a sibling and push alone. */
export async function claimShipClass(ids: string[], ownerSession: string) {
  const claimed: string[] = []
  const failed: string[] = []
  for (const id of ids) {
    const result = await claimWorkNode(id, ownerSession)
    if (result.data?.id) claimed.push(result.data.id)
    else failed.push(`${id}: ${result.error ?? 'claim failed'}`)
  }
  if (claimed.length === 0) {
    return { data: null, error: failed.join('; ') || 'no ids to claim' }
  }
  return { data: { claimed, failed }, error: null }
}

/**
 * `until` marks a node blocked on TIME rather than on a person: the boot brief
 * reopens it once the date passes, with nobody in the path. Omit it and the
 * node is blocked on a human and stays blocked until one acts.
 */
export async function blockWorkNode(id: string, reason: string, until?: Date | string | null) {
  if (!reason.trim()) return { data: null, error: 'blocked_reason is required' }
  const blockedUntil = until ? new Date(until).toISOString() : null
  return transition(id, 'blocked', { blocked_reason: reason, blocked_until: blockedUntil })
}

export async function releaseWorkNode(id: string) {
  return transition(id, 'open', { owner_session: null, blocked_reason: null, heartbeat_at: null })
}

/** Done requires evidence — an unaudited claim never enters durable state. */
export async function completeWorkNode(input: {
  id: string
  evidence: string
  ledgerRowId?: string | null
}) {
  if (!input.evidence.trim()) {
    return { data: null, error: 'evidence is required — a node is done when the environment says so, not the session' }
  }
  const sb = createServiceClient()
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('title,objective,version_gap')
    .eq('id', input.id)
    .single()
  if (readErr || !row) return { data: null, error: readErr?.message ?? 'node not found' }
  if (
    isFleetPunchListNode({
      title: String(row.title),
      version_gap: row.version_gap == null ? null : String(row.version_gap),
      objective: String(row.objective ?? ''),
    }) &&
    !canCompletePunchList(String(row.objective ?? ''))
  ) {
    const open = openPunchLines(String(row.objective ?? '')).length
    return {
      data: null,
      error: `FLEET-PUNCH cannot be done while ${open} open punch line(s) remain. Resolve this slice (fixed/rejected) and leave the parent open.`,
    }
  }
  return transition(input.id, 'done', {
    evidence: input.evidence,
    ledger_row_id: input.ledgerRowId ?? null,
  })
}

/** Append-only punch-line dispositions. Does not complete the parent. */
export async function resolvePunchLines(input: {
  id: string
  resolutions: PunchDisposition[]
}): Promise<{ data: { id: string; openRemaining: number } | null; error: string | null }> {
  if (!input.resolutions.length) return { data: null, error: 'resolutions are required' }
  try {
    const sb = createServiceClient()
    const { data: row, error: readErr } = await sb
      .from('loop_work_nodes')
      .select('title,objective,version_gap')
      .eq('id', input.id)
      .single()
    if (readErr || !row) return { data: null, error: readErr?.message ?? 'node not found' }
    if (
      !isFleetPunchListNode({
        title: String(row.title),
        version_gap: row.version_gap == null ? null : String(row.version_gap),
        objective: String(row.objective ?? ''),
      })
    ) {
      return { data: null, error: 'resolvePunchLines only applies to the FLEET-PUNCH inbox' }
    }
    const objective = appendPunchDispositions(String(row.objective ?? ''), input.resolutions)
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({ objective, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .select('id,objective')
      .single()
    if (error || !data?.id) return { data: null, error: error?.message ?? 'punch disposition update failed' }
    return { data: { id: String(data.id), openRemaining: openPunchLines(String(data.objective ?? '')).length }, error: null }
  } catch (err) {
    console.error('[resolvePunchLines]', err)
    return { data: null, error: err instanceof Error ? err.message : 'resolve failed' }
  }
}

export async function killWorkNode(id: string, reason: string) {
  if (!reason.trim()) return { data: null, error: 'a kill needs a reason' }
  return transition(id, 'killed', { blocked_reason: reason })
}

function mapRow(r: Record<string, unknown>): WorkNode {
  return {
    id: String(r.id),
    parentId: r.parent_id == null ? null : String(r.parent_id),
    dependsOn: Array.isArray(r.depends_on) ? r.depends_on.map(String) : [],
    domain: r.domain as CompanyImprovementDomain,
    versionGap: r.version_gap == null ? null : String(r.version_gap),
    title: String(r.title),
    objective: String(r.objective),
    output: String(r.output),
    accept: String(r.accept),
    state: r.state as WorkNodeState,
    evidence: r.evidence == null ? null : String(r.evidence),
    blockedReason: r.blocked_reason == null ? null : String(r.blocked_reason),
    ownerSession: r.owner_session == null ? null : String(r.owner_session),
    ledgerRowId: r.ledger_row_id == null ? null : String(r.ledger_row_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}
