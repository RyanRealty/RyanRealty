/**
 * CRM assigned-broker lookup for Sarah's public desk.
 * Fail-open to null (the caller maps null to Matt). A public widget must not
 * 500 because identity is missing.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

export type SarahAssignedLookup = {
  authEmail?: string | null
  authUserId?: string | null
  rrVid?: string | null
}

async function assignedForPersonId(
  sb: NonNullable<ReturnType<typeof createServiceClient>>,
  personId: number,
): Promise<string | null> {
  const { data, error } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (error || !data) return null
  const assigned = String((data as { assigned_broker: string | null }).assigned_broker ?? '').trim()
  return assigned || null
}

/**
 * Return crm_people.assigned_broker for a logged-in or identified visitor.
 * Null means no person, or the person has no assignment (Matt fallback).
 */
export async function lookupSarahAssignedBroker(input: SarahAssignedLookup): Promise<string | null> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    return null
  }

  try {
    const email = input.authEmail?.trim().toLowerCase() || ''
    if (email) {
      const ids = await personIdsByEmailCi(sb, email)
      if (ids[0]) return assignedForPersonId(sb, ids[0])
    }

    const authUserId = input.authUserId?.trim() || ''
    if (authUserId) {
      const { data } = await sb
        .from('visitor_identity_map')
        .select('crm_person_id')
        .eq('user_id', authUserId)
        .not('crm_person_id', 'is', null)
        .limit(1)
        .maybeSingle()
      const personId = Number((data as { crm_person_id?: number | null } | null)?.crm_person_id)
      if (Number.isFinite(personId) && personId > 0) return assignedForPersonId(sb, personId)
    }

    const rrVid = input.rrVid?.trim() || ''
    if (rrVid) {
      const { data } = await sb
        .from('visitor_identity_map')
        .select('crm_person_id')
        .eq('rr_vid', rrVid)
        .maybeSingle()
      const personId = Number((data as { crm_person_id?: number | null } | null)?.crm_person_id)
      if (Number.isFinite(personId) && personId > 0) return assignedForPersonId(sb, personId)
    }
  } catch (err) {
    console.error('[lookupSarahAssignedBroker]', err)
    return null
  }

  return null
}
