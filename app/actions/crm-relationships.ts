'use server'

/**
 * Link two existing people. Writes both crm_relationships rows so the
 * relationship shows on each record (parent on A is child on B).
 */

import { revalidatePerson } from '@/lib/crm/revalidate-person'
import { scopeBroker } from '@/lib/crm/scope'
import {
  RELATIONSHIP_LABELS,
  reciprocalType,
  validateLink,
} from '@/lib/crm/relationships'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { getPersonNamesByIds, relationshipLinkExists } from '@/lib/data/crm/findRelationshipLink'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { createServiceClient } from '@/lib/supabase/service'

export type RelationshipActionResult = { ok: true } | { ok: false; error: string }

export type RelationshipSearchHit = {
  id: number
  name: string
  phone: string | null
  email: string | null
}

export async function searchPeopleForLinkAction(
  q: string,
  excludePersonId: number,
): Promise<RelationshipSearchHit[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const term = q.trim()
  if (term.length < 2) return []
  const hits = await searchCrmPeople({
    q: term,
    brokerScope: scopeBroker(access),
    limit: 8,
  })
  return hits
    .filter((h) => h.id !== excludePersonId)
    .map((h) => ({
      id: h.id,
      name: h.name?.trim() || `Person ${h.id}`,
      phone: h.phones?.[0]?.value ?? null,
      email: h.emails?.[0]?.value ?? null,
    }))
}

export async function linkExistingRelationshipAction(
  fromPersonId: number,
  toPersonId: number,
  type: string,
): Promise<RelationshipActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const valid = validateLink({ fromPersonId, toPersonId, type })
  if (!valid.ok) return valid
  const fromScope = await requirePersonInScope(fromPersonId, access)
  if (!fromScope.ok) return fromScope
  const toScope = await requirePersonInScope(toPersonId, access)
  if (!toScope.ok) return { ok: false, error: 'That person is outside your book' }

  const sb = createServiceClient()
  if (await relationshipLinkExists(fromPersonId, toPersonId)) {
    return { ok: false, error: 'Those two people are already linked' }
  }

  const nameById = await getPersonNamesByIds([fromPersonId, toPersonId])
  const fromName = nameById.get(fromPersonId) ?? `Person ${fromPersonId}`
  const toName = nameById.get(toPersonId) ?? `Person ${toPersonId}`
  const inverse = reciprocalType(valid.type)

  const { error } = await sb.from('crm_relationships').insert([
    {
      person_id: fromPersonId,
      related_person_id: toPersonId,
      related_name: toName,
      kind: valid.type,
    },
    {
      person_id: toPersonId,
      related_person_id: fromPersonId,
      related_name: fromName,
      kind: inverse,
    },
  ])
  if (error) {
    console.error('[linkExistingRelationshipAction]', error.message)
    return { ok: false, error: 'Could not save the relationship' }
  }

  await sb.from('crm_timeline').insert([
    {
      person_id: fromPersonId,
      kind: 'system',
      title: `${RELATIONSHIP_LABELS[valid.type]}: ${toName}`,
      source: 'app',
      broker: access.brokerSlug ?? null,
    },
    {
      person_id: toPersonId,
      kind: 'system',
      title: `${RELATIONSHIP_LABELS[inverse]}: ${fromName}`,
      source: 'app',
      broker: access.brokerSlug ?? null,
    },
  ])

  revalidatePerson(fromPersonId)
  revalidatePerson(toPersonId)
  return { ok: true }
}
