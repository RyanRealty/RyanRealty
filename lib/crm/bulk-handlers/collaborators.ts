/**
 * Bulk handlers: crm:add-collaborator / crm:remove-collaborator — §14.3 items
 * 6 + 7 (Add Collaborators / Remove Collaborators) from
 * docs/fub-crm-spec/05-people-list-and-bulk-actions.md.
 *
 * Mirrors the single-record collaborator actions in
 * app/actions/crm-person-gaps.ts: the junction is crm_people_collaborators
 * (person_id, broker_slug), a person's ASSIGNED broker is never added as their
 * own collaborator, and every change writes a crm_timeline audit row. No
 * automation triggers fire (§14.3 mass-action rule).
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { CRM_BROKERS } from '@/lib/crm/constants'

function normalizeBroker(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toLowerCase()
  return (CRM_BROKERS as readonly string[]).includes(v) ? v : null
}

export const addCollaboratorHandler: BulkHandler = async (ids, params, ctx): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const broker = normalizeBroker(params.brokerSlug)
  if (!broker) {
    result.skipped = ids.length
    bump('invalid_broker', ids.length)
    return result
  }

  const sb = createServiceClient()
  const [{ data: people, error }, { data: existing }] = await Promise.all([
    sb.from('crm_people').select('id,assigned_broker').in('id', ids),
    sb.from('crm_people_collaborators').select('person_id').eq('broker_slug', broker).in('person_id', ids),
  ])
  if (error) {
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }
  const assignedById = new Map<number, string | null>()
  for (const p of people ?? []) assignedById.set(Number(p.id), (p.assigned_broker as string | null) ?? null)
  const already = new Set((existing ?? []).map((r) => Number(r.person_id)))

  for (const id of ids) {
    if (!assignedById.has(id)) { result.skipped++; bump('not_found'); continue }
    // The assigned agent is never their own collaborator (§07 collaborator rule).
    if (assignedById.get(id) === broker) { result.skipped++; bump('is_assigned_agent'); continue }
    if (already.has(id)) { result.skipped++; bump('already_collaborator'); continue }

    const { error: insErr } = await sb
      .from('crm_people_collaborators')
      .insert({ person_id: id, broker_slug: broker, added_by: ctx.actorEmail })
    if (insErr) { result.skipped++; bump('insert_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'system',
      title: `Collaborator ${broker} added (bulk)`,
      source: 'app',
    })
    result.processed++
    bump('added')
  }
  return result
}

export const removeCollaboratorHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const broker = normalizeBroker(params.brokerSlug)
  if (!broker) {
    result.skipped = ids.length
    bump('invalid_broker', ids.length)
    return result
  }

  const sb = createServiceClient()
  const { data: existing, error } = await sb
    .from('crm_people_collaborators')
    .select('person_id')
    .eq('broker_slug', broker)
    .in('person_id', ids)
  if (error) {
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }
  const has = new Set((existing ?? []).map((r) => Number(r.person_id)))

  for (const id of ids) {
    if (!has.has(id)) { result.skipped++; bump('not_a_collaborator'); continue }

    const { error: delErr } = await sb
      .from('crm_people_collaborators')
      .delete()
      .eq('person_id', id)
      .eq('broker_slug', broker)
    if (delErr) { result.skipped++; bump('delete_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'system',
      title: `Collaborator ${broker} removed (bulk)`,
      source: 'app',
    })
    result.processed++
    bump('removed')
  }
  return result
}
