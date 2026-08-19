/**
 * Resolve a CMA the broker may attach in CRM compose for this person.
 * person_id first; client_email fallback for older rows.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type CmaComposeTarget = {
  slug: string
  subjectAddress: string
  status: string
  personId: number | null
}

export function cmaComposeRowMatchesPerson(opts: {
  rowPersonId: number | null
  clientEmail: string | null
  personId: number
  personEmails: string[]
}): boolean {
  if (opts.rowPersonId === opts.personId) return true
  const clientEmail = String(opts.clientEmail ?? '')
    .trim()
    .toLowerCase()
  if (!clientEmail) return false
  return opts.personEmails.map((e) => e.trim().toLowerCase()).includes(clientEmail)
}

export async function getCmaComposeTarget(opts: {
  personId: number
  slug: string
}): Promise<CmaComposeTarget | null> {
  const personId = Number(opts.personId)
  const slug = opts.slug.trim().toLowerCase()
  if (!Number.isFinite(personId) || personId <= 0 || !slug) return null

  const sb = createServiceClient()
  const { data: row } = await sb
    .from('cmas')
    .select('slug, subject_address, status, person_id, client_email, archived_at')
    .eq('slug', slug)
    .maybeSingle()
  if (!row || row.archived_at) return null

  const rowPerson = row.person_id == null ? null : Number(row.person_id)
  const emailsWait = rowPerson === personId ? null : await sb.from('crm_people').select('id, emails').eq('id', personId).maybeSingle()
  const emails = Array.isArray(emailsWait?.data?.emails)
    ? emailsWait.data.emails
        .map((e) => String((e as { value?: string })?.value ?? '').trim().toLowerCase())
        .filter(Boolean)
    : []
  if (
    !cmaComposeRowMatchesPerson({
      rowPersonId: rowPerson,
      clientEmail: String(row.client_email ?? ''),
      personId,
      personEmails: emails,
    })
  ) {
    return null
  }

  return {
    slug: String(row.slug),
    subjectAddress: String(row.subject_address ?? ''),
    status: String(row.status ?? 'draft'),
    personId: rowPerson,
  }
}
