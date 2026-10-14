'use server'

/**
 * Broker-initiated first/last name + lead type write on /admin/people/:id.
 * Timeline audit notes only. Never sends SMS or email.
 */

import { revalidatePerson } from '@/lib/crm/revalidate-person'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import {
  planPersonIdentityEdit,
  type PersonIdentitySnapshot,
} from '@/lib/crm/person-identity-edit'

export type PersonIdentityResult = { ok: true } | { ok: false; error: string }

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export async function updatePersonIdentityAction(
  personId: number,
  firstName: string,
  lastName: string,
  leadType: string,
): Promise<PersonIdentityResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope

  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, error: 'Invalid person' }
  }

  try {
    const sb = createServiceClient()
    const { data: row, error } = await sb
      .from('crm_people')
      .select('id,name,first_name,last_name,tags,custom,deleted')
      .eq('id', personId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!row || row.deleted) return { ok: false, error: 'Person not found' }

    const person: PersonIdentitySnapshot = {
      name: row.name,
      first_name: row.first_name,
      last_name: row.last_name,
      tags: asStringArray(row.tags),
      custom: asRecord(row.custom),
    }
    const plan = planPersonIdentityEdit({
      person,
      firstName,
      lastName,
      leadType,
      actorEmail: access.email,
    })
    if (!plan.ok) return { ok: false, error: plan.error }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (plan.setName) {
      update.first_name = plan.setName.first
      update.last_name = plan.setName.last
      update.name = plan.setName.name
    }
    if (plan.tags) update.tags = plan.tags
    if (Object.keys(plan.customPatch).length) {
      update.custom = { ...person.custom, ...plan.customPatch }
    }

    const writes = plan.setName || plan.tags || Object.keys(plan.customPatch).length
    if (writes) {
      const { error: writeErr } = await sb.from('crm_people').update(update).eq('id', personId)
      if (writeErr) return { ok: false, error: writeErr.message }
    }

    for (const title of plan.auditTitles) {
      const { error: noteErr } = await sb.from('crm_timeline').insert({
        person_id: personId,
        kind: 'system',
        title,
        source: 'app',
        broker: access.brokerSlug ?? null,
      })
      if (noteErr) console.warn('[updatePersonIdentityAction] timeline note failed', noteErr.message)
    }

    revalidatePerson(personId)
    return { ok: true }
  } catch (err) {
    console.error('[updatePersonIdentityAction]', err)
    return { ok: false, error: 'Name not updated' }
  }
}
