/**
 * Bulk handler: crm:assign-broker — reassign a chunk of contacts to one broker.
 *
 * Mirrors the single-record assignCrmBrokerAction (app/actions/crm.ts 1015):
 *   - sets assigned_broker + assigned_fub_user_id
 *   - swaps the broker:<slug> tag (drops any existing broker: tags, adds the new one)
 *   - writes a per-person crm_timeline 'system' row so every move is audited
 *
 * AUTHORIZATION: reassigning a lead is an OWNER (superuser) operation. The
 * single-record action refuses any restricted broker outright. For a bulk job the
 * gate is enforced at ENQUEUE (the action that builds the job verifies
 * access.role==='superuser' before enqueueBulkJob). This handler ADDITIONALLY
 * fail-closes here: if the job's frozen broker_scope is non-null (i.e. a restricted
 * broker somehow enqueued it), every id is skipped and counted under
 * `refused_not_owner` rather than silently reassigning leads. Defense in depth.
 *
 * FUB is decommissioned (2026-06-24) — this writes the CRM system of record only.
 * The single-record path's assignPersonToUser / replacePersonTags FUB calls are
 * intentionally omitted (they would be 18K dead API hits over the full book).
 *
 * Every id in the chunk is accounted for as processed OR skipped so the worker's
 * offset (which advances by processed+skipped) drains the full selection.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKERS, FUB_USER_ID_BY_BROKER, type CrmBrokerSlug } from '@/lib/crm/constants'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

export const assignBrokerHandler: BulkHandler = async (ids, params, ctx): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  // Defense in depth: a restricted broker must never reassign leads in bulk. The
  // enqueue gate already requires superuser; a non-null frozen scope means the
  // gate was bypassed — refuse the whole chunk rather than move leads.
  if (ctx.brokerScope !== null) {
    result.skipped = ids.length
    bump('refused_not_owner', ids.length)
    return result
  }

  const brokerSlug = String(params.brokerSlug ?? '').trim() as CrmBrokerSlug
  if (!(CRM_BROKERS as readonly string[]).includes(brokerSlug)) {
    // Invalid params: skip the whole chunk (every id accounted for) so the job
    // drains visibly instead of looping.
    result.skipped = ids.length
    bump('invalid_broker', ids.length)
    return result
  }
  const fubUserId = FUB_USER_ID_BY_BROKER[brokerSlug]

  const sb = createServiceClient()
  const { data: people, error } = await sb
    .from('crm_people')
    .select('id,tags,assigned_broker')
    .in('id', ids)
  if (error) {
    // A read failure for the chunk: skip it (counted), let the job finish rather
    // than spin. The worker logs the breakdown.
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }

  const byId = new Map<number, { id: number; tags: string[]; assigned_broker: string | null }>()
  for (const p of people ?? []) {
    byId.set(p.id as number, {
      id: p.id as number,
      tags: ((p.tags as string[] | null) ?? []),
      assigned_broker: (p.assigned_broker as string | null) ?? null,
    })
  }

  for (const id of ids) {
    const person = byId.get(id)
    if (!person) { result.skipped++; bump('not_found'); continue }
    if (person.assigned_broker === brokerSlug) { result.skipped++; bump('already_assigned'); continue }

    const newTags = [
      ...person.tags.filter((t) => !t.startsWith('broker:')),
      `broker:${brokerSlug}`,
    ]
    const { error: upErr } = await sb
      .from('crm_people')
      .update({
        assigned_broker: brokerSlug,
        assigned_fub_user_id: fubUserId,
        tags: newTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (upErr) { result.skipped++; bump('update_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'system',
      title: `Assigned to ${brokerSlug}${person.assigned_broker ? ` (was ${person.assigned_broker})` : ''} (bulk)`,
      source: 'app',
      broker: brokerSlug,
    })
    result.processed++
    bump('reassigned')
  }

  return result
}
