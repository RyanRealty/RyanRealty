import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { PersonAddress } from '@/lib/crm/person-address'

export async function resolveCreatedPersonId(input: {
  sentPersonId?: number
  email?: string
  phone?: string
}): Promise<number | undefined> {
  const sb = createServiceClient()
  let personId = input.sentPersonId
  if (!personId && input.email) {
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', input.email)
      .order('person_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    personId = (pt?.person_id as number | undefined) ?? undefined
  }
  if (!personId && input.phone) {
    const digits = input.phone.replace(/\D/g, '').slice(-10)
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id,value')
      .eq('kind', 'phone')
      .ilike('value', `%${digits}`)
      .order('person_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    personId = (pt?.person_id as number | undefined) ?? undefined
  }
  return personId
}

export async function persistCreatedContactAddress(
  personId: number,
  address: PersonAddress,
): Promise<void> {
  const sb = createServiceClient()
  const { data: person } = await sb.from('crm_people').select('addresses').eq('id', personId).maybeSingle()
  const rest = Array.isArray(person?.addresses) ? (person!.addresses as unknown[]).slice(1) : []
  const { error } = await sb
    .from('crm_people')
    .update({ addresses: [address, ...rest], updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) console.error('[persistCreatedContactAddress]', error.message)
}
