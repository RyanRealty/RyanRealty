import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** The person fields the SMS composer + click-to-call need (merge + routing). */
export type SendTargetPerson = {
  id: number
  fub_legacy_id: number | null
  phones: unknown
  assigned_broker: string | null
  name: string | null
  first_name: string | null
  custom: Record<string, unknown>
}
export type SendTarget = { person: SendTargetPerson; phone: string }

/**
 * Resolve a contact's outbound send target: the full person row (for merge +
 * broker routing) plus the best phone number (primary phone, falling back to the
 * first crm_contact_points phone). Centralizes the crm_people +
 * crm_contact_points reads out of the action layer so the composer and
 * click-to-call share one DAL path (DAL boundary discipline). `phone` is '' when
 * none is on file; null is returned only when the person does not exist.
 */
export async function getSendTarget(personId: number): Promise<SendTarget | null> {
  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,phones,assigned_broker,name,first_name,custom')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return null

  let phone =
    (person.phones as Array<{ value?: string; isPrimary?: number | boolean }> | null)
      ?.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value ?? ''
  if (!phone) {
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('value')
      .eq('person_id', personId)
      .eq('kind', 'phone')
      .limit(1)
      .maybeSingle()
    phone = pt?.value ?? ''
  }
  return {
    person: { ...person, custom: (person.custom ?? {}) as Record<string, unknown> } as SendTargetPerson,
    phone,
  }
}
