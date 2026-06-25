import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve a crm_people id to its best email address, lowercased. Prefers the
 * row flagged is_primary; falls back to any email on file. Used by the email
 * open/click tracker rail (lib/crm/email-events.ts), which signs a personId +
 * emailKey into the pixel token but NOT the recipient address — so the
 * email_events row still gets a recipient_email when one is on file.
 *
 * Returns null when the person has no email contact point. Service-role read
 * (the tracker endpoints have no user session); lives in lib/data so it stays
 * inside the DAL boundary (G1).
 */
export async function getPersonPrimaryEmail(personId: number): Promise<string | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_contact_points')
    .select('value,is_primary')
    .eq('person_id', personId)
    .eq('kind', 'email')
  if (error || !data || data.length === 0) return null
  // Prefer a primary; otherwise the first email on file.
  const primary = data.find((r) => r.is_primary === true)
  const chosen = (primary?.value ?? data[0]?.value) as string | undefined
  const norm = (chosen ?? '').trim().toLowerCase()
  return norm || null
}
