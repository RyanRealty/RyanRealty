/**
 * getRecipientOptionsForContact — the address book for the email composer's
 * To/Cc/Bcc pickers on a contact page: every email on the contact's own record
 * (labeled with type + primary flag) plus each linked contact's primary email
 * ("Jane Smith · Spouse"). Free-typed addresses are still allowed in the
 * composer — these are just the one-click options.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { humanizeRelationshipType } from '@/lib/data/crm/getContactRelationships'

export type RecipientOption = { email: string; label: string }

type EmailEntry = { value?: string; type?: string; isPrimary?: number | boolean }

function primaryFirst(emails: EmailEntry[] | null | undefined): EmailEntry[] {
  return [...(emails ?? [])].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))
}

export async function getRecipientOptionsForContact(crmPersonId: number): Promise<RecipientOption[]> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []
  const sb = createServiceClient()

  const { data: person } = await sb
    .from('crm_people')
    .select('id,name,emails')
    .eq('id', crmPersonId)
    .maybeSingle()
  if (!person) return []

  const seen = new Set<string>()
  const options: RecipientOption[] = []
  const push = (email: string | undefined, label: string) => {
    const v = (email ?? '').trim().toLowerCase()
    if (!v || seen.has(v)) return
    seen.add(v)
    options.push({ email: v, label })
  }

  const personName = String(person.name ?? '').trim() || `Contact #${crmPersonId}`
  for (const e of primaryFirst(person.emails as EmailEntry[] | null)) {
    push(e.value, `${personName}${e.isPrimary ? ' · primary' : e.type ? ` · ${e.type}` : ''}`)
  }

  // Linked people (spouse, co-buyer, …) — primary email each.
  const { data: links } = await sb
    .from('crm_relationships')
    .select('related_person_id,kind')
    .eq('person_id', crmPersonId)
  const relatedIds = Array.from(
    new Set(
      (links ?? [])
        .map((l) => (l.related_person_id === null ? null : Number(l.related_person_id)))
        .filter((v): v is number => v !== null && Number.isFinite(v)),
    ),
  )
  if (relatedIds.length > 0) {
    const { data: related } = await sb
      .from('crm_people')
      .select('id,name,emails')
      .in('id', relatedIds)
    const kindById = new Map((links ?? []).map((l) => [Number(l.related_person_id), l.kind as string | null]))
    for (const r of related ?? []) {
      const primary = primaryFirst(r.emails as EmailEntry[] | null)[0]
      const name = String(r.name ?? '').trim() || `Contact #${r.id}`
      push(primary?.value, `${name} · ${humanizeRelationshipType(kindById.get(Number(r.id)))}`)
    }
  }

  return options
}
