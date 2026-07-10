/**
 * getContactSendTarget — the minimal identity a deliverable send needs for one
 * CRM contact: primary email + name + phone + assigned broker. Shared by the
 * BPO / listing-matches send actions so none of them raw-query crm_people.
 *
 * DAL boundary (G1): the raw .from('crm_people') read lives here.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type ContactSendTarget = {
  personId: number
  fubPersonId: number | null
  name: string | null
  email: string | null
  phone: string | null
  assignedBroker: string | null
}

function primary(arr: Array<{ value?: string; isPrimary?: number | boolean }> | null | undefined): string | null {
  const list = arr ?? []
  const sorted = list.slice().sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))
  return sorted[0]?.value?.trim() || null
}

export async function getContactSendTarget(personId: number): Promise<ContactSendTarget | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_people')
    .select('id, fub_legacy_id, name, emails, phones, assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (!data) return null
  return {
    personId: Number(data.id),
    fubPersonId: (data.fub_legacy_id as number | null) ?? null,
    name: (data.name as string | null)?.trim() || null,
    email: primary(data.emails as Array<{ value?: string; isPrimary?: number | boolean }> | null)?.toLowerCase() ?? null,
    phone: primary(data.phones as Array<{ value?: string; isPrimary?: number | boolean }> | null),
    assignedBroker: (data.assigned_broker as string | null) ?? null,
  }
}
