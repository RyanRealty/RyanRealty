'use server'

/**
 * CRM contact-relationship actions (CONTACT360 Phase 4.2).
 *
 * Link two contacts with a typed, reciprocal relationship ("married /
 * co-buyer / referrer"). Every mutation here writes BOTH directions to
 * crm_relationships — the row plus its reciprocal — so a relationship is never
 * one-sided: "married" shows on both records. Each change also drops a
 * crm_timeline note on BOTH contacts so the link is auditable from either side.
 *
 * Admin-guarded via the shared getCrmAccess() in app/actions/crm.ts (one source
 * of CRM auth). Raw .from() lives here because app/actions is exempt from the
 * DAL boundary gate (G1) — this mirrors the existing app/actions/crm.ts
 * mutation pattern (assign/stage/tag), which writes crm_people + crm_timeline
 * the same way.
 *
 * The type vocabulary + the pure reciprocal map live in lib/crm/relationships.ts
 * (unit-tested). This file is the side-effecting layer on top of that core.
 *
 * Phase 4.4 will add a UNIQUE(person_id, related_person_id) constraint +
 * a CHECK(person_id <> related_person_id). Until that migration lands, this
 * code enforces both invariants in application code (validateLink + an
 * existence check before insert).
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope, type CrmActionResult } from '@/app/actions/crm'
import {
  reciprocalType,
  validateLink,
  RELATIONSHIP_LABELS,
  type RelationshipType,
} from '@/lib/crm/relationships'

type RelationshipParams = {
  fromPersonId: number
  toPersonId: number
  type: string
}

type PersonName = { id: number; name: string | null; fub_legacy_id: number | null }

function revalidatePair(a: number, b: number) {
  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${a}`)
  revalidatePath(`/admin/crm/${b}`)
}

/** Best-effort display name for a contact (for related_name + the timeline note). */
function displayName(p: PersonName | undefined, fallbackId: number): string {
  return (p?.name && p.name.trim()) || `Contact #${fallbackId}`
}

/**
 * Link two contacts with a typed relationship, writing both directions.
 *
 * crm_relationships rows written:
 *   { person_id: from, related_person_id: to,   kind: type }
 *   { person_id: to,   related_person_id: from, kind: reciprocalType(type) }
 *
 * Guards (Phase 4.4 will move these into DB constraints): no self-link, no
 * duplicate pair (regardless of which side initiated or the prior type).
 */
export async function linkContacts(params: RelationshipParams): Promise<CrmActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const valid = validateLink(params)
  if (!valid.ok) return { ok: false, error: valid.error }
  const type: RelationshipType = valid.type
  const { fromPersonId, toPersonId } = params

  // Broker-RBAC (GAP-W): BOTH contacts must be in the caller's scope to relate them.
  const fromScope = await requirePersonInScope(fromPersonId, access)
  if (!fromScope.ok) return fromScope
  const toScope = await requirePersonInScope(toPersonId, access)
  if (!toScope.ok) return toScope

  const sb = createServiceClient()

  // Both people must exist (and resolve their names for related_name + note).
  const { data: people } = await sb
    .from('crm_people')
    .select('id,name,fub_legacy_id')
    .in('id', [fromPersonId, toPersonId])
  const byId = new Map<number, PersonName>((people ?? []).map((p) => [p.id as number, p as PersonName]))
  const from = byId.get(fromPersonId)
  const to = byId.get(toPersonId)
  if (!from || !to) return { ok: false, error: 'Contact not found' }

  // Duplicate guard: a row already linking these two in EITHER direction.
  const { data: existing } = await sb
    .from('crm_relationships')
    .select('id')
    .or(
      `and(person_id.eq.${fromPersonId},related_person_id.eq.${toPersonId}),` +
        `and(person_id.eq.${toPersonId},related_person_id.eq.${fromPersonId})`,
    )
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, error: 'These contacts are already linked' }
  }

  const recip = reciprocalType(type)
  const fromName = displayName(from, fromPersonId)
  const toName = displayName(to, toPersonId)

  const { error: insErr } = await sb.from('crm_relationships').insert([
    { person_id: fromPersonId, related_person_id: toPersonId, related_name: toName, kind: type },
    { person_id: toPersonId, related_person_id: fromPersonId, related_name: fromName, kind: recip },
  ])
  if (insErr) return { ok: false, error: insErr.message }

  const broker = access.brokerSlug ?? null
  await sb.from('crm_timeline').insert([
    {
      person_id: fromPersonId,
      kind: 'system',
      title: `Linked ${toName} as ${RELATIONSHIP_LABELS[type]}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: toPersonId, type },
    },
    {
      person_id: toPersonId,
      kind: 'system',
      title: `Linked ${fromName} as ${RELATIONSHIP_LABELS[recip]}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: fromPersonId, type: recip },
    },
  ])

  revalidatePair(fromPersonId, toPersonId)
  return { ok: true }
}

/**
 * Remove the link between two contacts (both directions) + note both records.
 */
export async function unlinkContacts(params: {
  fromPersonId: number
  toPersonId: number
}): Promise<CrmActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const { fromPersonId, toPersonId } = params
  if (!Number.isInteger(fromPersonId) || fromPersonId <= 0 || !Number.isInteger(toPersonId) || toPersonId <= 0) {
    return { ok: false, error: 'Both contacts required' }
  }
  if (fromPersonId === toPersonId) return { ok: false, error: 'A contact cannot be linked to itself' }

  // Broker-RBAC (GAP-W): BOTH contacts must be in the caller's scope to unrelate them.
  const fromScope = await requirePersonInScope(fromPersonId, access)
  if (!fromScope.ok) return fromScope
  const toScope = await requirePersonInScope(toPersonId, access)
  if (!toScope.ok) return toScope

  const sb = createServiceClient()

  const { data: people } = await sb
    .from('crm_people')
    .select('id,name,fub_legacy_id')
    .in('id', [fromPersonId, toPersonId])
  const byId = new Map<number, PersonName>((people ?? []).map((p) => [p.id as number, p as PersonName]))
  const fromName = displayName(byId.get(fromPersonId), fromPersonId)
  const toName = displayName(byId.get(toPersonId), toPersonId)

  const { error: delErr } = await sb
    .from('crm_relationships')
    .delete()
    .or(
      `and(person_id.eq.${fromPersonId},related_person_id.eq.${toPersonId}),` +
        `and(person_id.eq.${toPersonId},related_person_id.eq.${fromPersonId})`,
    )
  if (delErr) return { ok: false, error: delErr.message }

  const broker = access.brokerSlug ?? null
  await sb.from('crm_timeline').insert([
    {
      person_id: fromPersonId,
      kind: 'system',
      title: `Unlinked ${toName}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: toPersonId },
    },
    {
      person_id: toPersonId,
      kind: 'system',
      title: `Unlinked ${fromName}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: fromPersonId },
    },
  ])

  revalidatePair(fromPersonId, toPersonId)
  return { ok: true }
}

/**
 * Change the type of an existing link, keeping both directions consistent
 * (the reciprocal side is updated to reciprocalType(newType)). Notes both
 * records.
 */
export async function setRelationshipType(params: RelationshipParams): Promise<CrmActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const valid = validateLink(params)
  if (!valid.ok) return { ok: false, error: valid.error }
  const type: RelationshipType = valid.type
  const { fromPersonId, toPersonId } = params

  // Broker-RBAC (GAP-W): BOTH contacts must be in the caller's scope to re-type them.
  const fromScope = await requirePersonInScope(fromPersonId, access)
  if (!fromScope.ok) return fromScope
  const toScope = await requirePersonInScope(toPersonId, access)
  if (!toScope.ok) return toScope

  const sb = createServiceClient()

  const { data: people } = await sb
    .from('crm_people')
    .select('id,name,fub_legacy_id')
    .in('id', [fromPersonId, toPersonId])
  const byId = new Map<number, PersonName>((people ?? []).map((p) => [p.id as number, p as PersonName]))
  const from = byId.get(fromPersonId)
  const to = byId.get(toPersonId)
  if (!from || !to) return { ok: false, error: 'Contact not found' }

  // The link must already exist (in the from->to direction at minimum).
  const { data: existing } = await sb
    .from('crm_relationships')
    .select('id')
    .eq('person_id', fromPersonId)
    .eq('related_person_id', toPersonId)
    .limit(1)
  if (!existing || existing.length === 0) {
    return { ok: false, error: 'These contacts are not linked' }
  }

  const recip = reciprocalType(type)
  const fromName = displayName(from, fromPersonId)
  const toName = displayName(to, toPersonId)

  const { error: e1 } = await sb
    .from('crm_relationships')
    .update({ kind: type, related_name: toName })
    .eq('person_id', fromPersonId)
    .eq('related_person_id', toPersonId)
  if (e1) return { ok: false, error: e1.message }

  const { error: e2 } = await sb
    .from('crm_relationships')
    .update({ kind: recip, related_name: fromName })
    .eq('person_id', toPersonId)
    .eq('related_person_id', fromPersonId)
  if (e2) return { ok: false, error: e2.message }

  const broker = access.brokerSlug ?? null
  await sb.from('crm_timeline').insert([
    {
      person_id: fromPersonId,
      kind: 'system',
      title: `Set ${toName} as ${RELATIONSHIP_LABELS[type]}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: toPersonId, type },
    },
    {
      person_id: toPersonId,
      kind: 'system',
      title: `Set ${fromName} as ${RELATIONSHIP_LABELS[recip]}`,
      source: 'app',
      broker,
      payload: { relatedPersonId: fromPersonId, type: recip },
    },
  ])

  revalidatePair(fromPersonId, toPersonId)
  return { ok: true }
}
