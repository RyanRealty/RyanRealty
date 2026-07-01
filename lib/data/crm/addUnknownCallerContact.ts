/**
 * Name an unknown-caller contact from the Inbox (FUB-parity delivery #5, spec §9).
 *
 * Every inbound text/call already creates a crm_people row via the inbound
 * webhooks (findOrCreatePersonByPhone) with a phone-derived placeholder name
 * ("Text lead 5412079190", …). The Inbox "Add Person" flow does not create a
 * second row — it NAMES that placeholder: sets first/last/name and merges an
 * optional email, converting an unrecognized caller into a real named contact.
 * After this, the thread header shows the name instead of the raw number
 * (AC-20). No message is sent here (compliance untouched).
 *
 * DAL boundary (G1): the crm_people update + timeline write live here.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** Pure: compose the display name from first + last, trimmed. Shared with tests. */
export function composeContactName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

/** Pure: loose email-shape check (a real value, not a strict RFC validator). */
export function isLikelyEmail(email: string): boolean {
  const e = email.trim()
  if (!e) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

type EmailEntry = { value?: string; isPrimary?: number | boolean }

/**
 * Pure: merge a new email into the existing emails jsonb, de-duped case-
 * insensitively by value. The first email on an empty list becomes primary.
 * Exported for unit testing without Supabase.
 */
export function mergeEmail(existing: EmailEntry[], email: string): EmailEntry[] {
  const e = email.trim()
  if (!e) return existing
  const has = existing.some((x) => (x.value ?? '').trim().toLowerCase() === e.toLowerCase())
  if (has) return existing
  return [...existing, { value: e, isPrimary: existing.length === 0 ? 1 : 0 }]
}

export async function nameUnknownCallerContact(params: {
  personId: number
  firstName: string
  lastName: string
  email: string | null
  broker: string | null
}): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const first = params.firstName.trim()
  const last = params.lastName.trim()
  const name = composeContactName(first, last)
  if (!name) return { ok: false, error: 'A first or last name is required' }
  const email = (params.email ?? '').trim()
  if (email && !isLikelyEmail(email)) return { ok: false, error: 'Enter a valid email or leave it blank' }

  const sb = createServiceClient()
  const { data: existing } = await sb
    .from('crm_people')
    .select('emails')
    .eq('id', params.personId)
    .maybeSingle()
  if (!existing) return { ok: false, error: 'Contact not found' }
  const emails = Array.isArray(existing.emails) ? (existing.emails as EmailEntry[]) : []
  const nextEmails = mergeEmail(emails, email)

  const { error } = await sb
    .from('crm_people')
    .update({
      first_name: first || null,
      last_name: last || null,
      name,
      emails: nextEmails,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', params.personId)
  if (error) return { ok: false, error: error.message }

  // Record the identification on the contact timeline (best-effort — a failed
  // note write must not undo the successful naming).
  await sb.from('crm_timeline').insert({
    person_id: params.personId,
    kind: 'note',
    title: 'Contact identified from unknown caller',
    body: `Named ${name}${email ? ` and added ${email}` : ''} from the inbox.`,
    broker: params.broker,
    source: 'app',
  })

  return { ok: true, name }
}
