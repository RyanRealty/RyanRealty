/**
 * getPersonContact — the first email/phone + name for one crm_people row.
 * Feeds the CRM→CAPI qualified-lead event (lib/meta/qualifiedEvent.ts), which
 * hashes these before they leave the server. DAL boundary (G1): the raw .from()
 * read lives here.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type PersonContact = {
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
}

/** First string value out of a crm_people JSONB contact array (emails/phones). */
function firstValue(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) return item.trim()
    if (item && typeof item === 'object') {
      const v = (item as { value?: unknown }).value
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return null
}

export async function getPersonContact(personId: number): Promise<PersonContact | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('first_name,last_name,emails,phones')
    .eq('id', personId)
    .maybeSingle()
  if (error || !data) return null
  return {
    email: firstValue(data.emails),
    phone: firstValue(data.phones),
    firstName: (data.first_name as string | null) ?? null,
    lastName: (data.last_name as string | null) ?? null,
  }
}
