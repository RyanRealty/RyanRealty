/**
 * assigned_broker source of truth (Matt P12 lock 2026-08-09):
 *   crm_people.assigned_broker wins. Child rows (open tasks, open deals,
 *   conversation shadow) copy from the person on write / reassignment.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FUB_USER_ID_BY_BROKER, type CrmBrokerSlug } from '@/lib/crm/constants'

export type SetPersonBrokerResult = {
  ok: boolean
  error?: string
  previous: string | null
  broker: string
}

/**
 * Set the person's assigned_broker and cascade to open tasks + open deals.
 * Conversations are updated when the column exists on crm_conversations.
 */
export async function setPersonAssignedBroker(
  sb: SupabaseClient,
  personId: number,
  brokerSlug: string,
  opts?: { tags?: string[]; actorEmail?: string | null; source?: string },
): Promise<SetPersonBrokerResult> {
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, error: 'invalid personId', previous: null, broker: brokerSlug }
  }
  const { data: person, error: readErr } = await sb
    .from('crm_people')
    .select('id,assigned_broker,tags')
    .eq('id', personId)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message, previous: null, broker: brokerSlug }
  if (!person) return { ok: false, error: 'not_found', previous: null, broker: brokerSlug }

  const previous = (person.assigned_broker as string | null) ?? null
  if (previous === brokerSlug) {
    return { ok: true, previous, broker: brokerSlug }
  }

  const existingTags = ((person.tags as string[] | null) ?? [])
  const tags =
    opts?.tags ??
    [...existingTags.filter((t) => !t.startsWith('broker:')), `broker:${brokerSlug}`]

  const fubUserId = FUB_USER_ID_BY_BROKER[brokerSlug as CrmBrokerSlug] ?? null
  const { error: upErr } = await sb
    .from('crm_people')
    .update({
      assigned_broker: brokerSlug,
      assigned_fub_user_id: fubUserId,
      tags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)
  if (upErr) return { ok: false, error: upErr.message, previous, broker: brokerSlug }

  // Cascade: open (incomplete) tasks follow the person.
  await sb
    .from('crm_tasks')
    .update({ assigned_broker: brokerSlug, updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .is('completed_at', null)

  // Cascade: open deals (no close_date) follow the person.
  await sb
    .from('crm_deals')
    .update({ assigned_broker: brokerSlug, updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .is('close_date', null)

  // Best-effort conversation shadow (column may not exist on older schemas).
  try {
    await sb
      .from('crm_conversations')
      .update({ assigned_broker: brokerSlug, updated_at: new Date().toISOString() })
      .eq('primary_person_id', personId)
  } catch {
    /* non-fatal */
  }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Assigned to ${brokerSlug}${previous ? ` (was ${previous})` : ''}`,
    source: opts?.source ?? 'app',
    broker: brokerSlug,
    payload: { actor: opts?.actorEmail ?? null, previous, cascade: true },
  })

  return { ok: true, previous, broker: brokerSlug }
}

/** Resolve broker for a new child row: always prefer the person's current assignment. */
export async function resolveBrokerFromPerson(
  sb: SupabaseClient,
  personId: number,
  fallback: string | null = null,
): Promise<string | null> {
  if (!Number.isFinite(personId) || personId <= 0) return fallback
  const { data, error } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (error || !data) return fallback
  return ((data.assigned_broker as string | null) ?? null) || fallback
}
