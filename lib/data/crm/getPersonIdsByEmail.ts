import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve a recipient email to EVERY crm_people id that carries it as a contact
 * point. Returns all siblings, not just one — farm imports create one person row
 * per parcel, so a bounce/complaint must suppress the email across all rows
 * sharing the address, not only the first (CONTACT360 Phase 9.2 edge case).
 *
 * Matches on the normalized (lowercased) email. Service-role read (the webhook
 * has no user session); lives in lib/data so it's inside the DAL boundary.
 */
export async function getPersonIdsByEmail(email: string): Promise<number[]> {
  const norm = email.trim().toLowerCase()
  if (!norm) return []
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_contact_points')
    .select('person_id')
    .eq('kind', 'email')
    .eq('value', norm)
  if (error || !data) return []
  return [...new Set(data.map((r) => r.person_id as number).filter((n) => typeof n === 'number'))]
}
