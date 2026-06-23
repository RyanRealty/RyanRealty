/**
 * getContactIdentityStrip — the header strip for the Contact-360 view
 * (CONTACT360 Phase 2.7): who this contact is, where they came from, and their
 * CMA history.
 *
 * Identity (name / stage / source / source_url / broker / primary email+phone /
 * tags) comes straight off crm_people. CMA history is matched by client_email
 * against the contact's emails (resolved via resolvePersonIdentity) — the cmas
 * table has no crm_person_id bridge yet (that is the flagged Phase 1.1
 * migration), so email is the join key, consistent with the rest of CONTACT360.
 *
 * There is no contact-photo column on crm_people; the view renders an initials
 * avatar, so the strip carries the name parts, not a photo URL.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { resolvePersonIdentity } from './resolvePersonIdentity'

type JsonbContact = { value?: string; type?: string; isPrimary?: number | boolean }

export type ContactCma = {
  slug: string
  subjectAddress: string
  status: string
  recommendedList: number | null
  valueLow: number | null
  valueHigh: number | null
  createdAt: string | null
  previewUrl: string | null
}

export type ContactIdentityStrip = {
  crmPersonId: number
  name: string | null
  firstName: string | null
  lastName: string | null
  stage: string
  source: string | null
  sourceUrl: string | null
  assignedBroker: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  tags: string[]
  createdAt: string | null
  cmaHistory: ContactCma[]
}

/** Pick the primary value from a crm_people emails/phones jsonb array (else the first). */
export function pickPrimary(items: JsonbContact[] | null | undefined): string | null {
  if (!Array.isArray(items) || items.length === 0) return null
  const primary = items.find((i) => i?.isPrimary === 1 || i?.isPrimary === true)
  const chosen = primary ?? items[0]
  const v = chosen?.value
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Map a raw cmas row to the strip's CMA shape. */
export function mapCmaRow(r: Record<string, unknown>): ContactCma {
  return {
    slug: String(r.slug ?? ''),
    subjectAddress: String(r.subject_address ?? ''),
    status: String(r.status ?? 'draft'),
    recommendedList: r.recommended_list == null ? null : Number(r.recommended_list),
    valueLow: r.value_low == null ? null : Number(r.value_low),
    valueHigh: r.value_high == null ? null : Number(r.value_high),
    createdAt: (r.created_at as string | null) ?? null,
    previewUrl: (r.preview_url as string | null) ?? null,
  }
}

export async function getContactIdentityStrip(crmPersonId: number): Promise<ContactIdentityStrip | null> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return null
  const sb = createServiceClient()

  const { data: person } = await sb
    .from('crm_people')
    .select('id,name,first_name,last_name,stage,source,source_url,assigned_broker,emails,phones,tags,created_at')
    .eq('id', crmPersonId)
    .maybeSingle()
  if (!person) return null

  const identity = await resolvePersonIdentity(crmPersonId)
  const emails = identity.emails

  let cmaHistory: ContactCma[] = []
  if (emails.length > 0) {
    const { data: cmaRows } = await sb
      .from('cmas')
      .select('slug,subject_address,status,recommended_list,value_low,value_high,created_at,preview_url,client_email')
      .in('client_email', emails)
      .order('created_at', { ascending: false })
    if (cmaRows) cmaHistory = cmaRows.map((r) => mapCmaRow(r as Record<string, unknown>))
  }

  return {
    crmPersonId,
    name: (person.name as string | null) ?? null,
    firstName: (person.first_name as string | null) ?? null,
    lastName: (person.last_name as string | null) ?? null,
    stage: (person.stage as string | null) ?? 'Lead',
    source: (person.source as string | null) ?? null,
    sourceUrl: (person.source_url as string | null) ?? null,
    assignedBroker: (person.assigned_broker as string | null) ?? null,
    primaryEmail: pickPrimary(person.emails as JsonbContact[] | null),
    primaryPhone: pickPrimary(person.phones as JsonbContact[] | null),
    tags: Array.isArray(person.tags) ? (person.tags as string[]) : [],
    createdAt: (person.created_at as string | null) ?? null,
    cmaHistory,
  }
}
