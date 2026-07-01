/**
 * getContactCollaborators — reads the additional brokers who collaborate on a
 * contact (FUB §7c.8.9 Collaborators widget). The contact's assigned_broker is
 * NOT returned here — this table holds the supplementary set only.
 *
 * DAL boundary (G1): raw .from() lives here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'

export type ContactCollaborator = {
  brokerSlug: string
  displayName: string
  addedAt: string | null
}

export async function getContactCollaborators(personId: number): Promise<ContactCollaborator[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_people_collaborators')
    .select('broker_slug, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => ({
    brokerSlug: String(row.broker_slug),
    displayName:
      CRM_BROKER_DISPLAY[row.broker_slug as keyof typeof CRM_BROKER_DISPLAY] ??
      String(row.broker_slug),
    addedAt: typeof row.created_at === 'string' ? row.created_at : null,
  }))
}
