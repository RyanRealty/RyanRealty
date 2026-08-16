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
  assertTransition,
  assertWorkNodeDraft,
  isStaleInProgress,
  type WorkNodeDraft,
  type WorkNodeState,
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

export async function claimWorkNode(id: string, ownerSession: string) {
  return transition(id, 'in_progress', { owner_session: ownerSession, blocked_reason: null })
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

export async function blockWorkNode(id: string, reason: string) {
  if (!reason.trim()) return { data: null, error: 'blocked_reason is required' }
  return transition(id, 'blocked', { blocked_reason: reason })
}

export async function releaseWorkNode(id: string) {
  return transition(id, 'open', { owner_session: null, blocked_reason: null })
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
  return transition(input.id, 'done', {
    evidence: input.evidence,
    ledger_row_id: input.ledgerRowId ?? null,
  })
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
