/**
 * CRM side-effects of a CMA send — person resolution, cmaLink stamping, and
 * the timeline entry. Kept behind the DAL boundary so lib/cma/send.ts stays
 * free of raw table access.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/** First crm_people id carrying this email (case-insensitive), or null. */
export async function findCrmPersonIdByEmail(email: string): Promise<number | null> {
  const sb = client()
  if (!sb) return null
  try {
    const ids = await personIdsByEmailCi(sb, email)
    return ids[0] ?? null
  } catch (e) {
    console.warn('[findCrmPersonIdByEmail]', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Stamp the live CMA link + slug onto the person's custom fields. */
export async function stampCmaLinkOnPerson(
  personId: number,
  opts: { cmaLink: string; cmaSlug: string },
): Promise<void> {
  const sb = client()
  if (!sb) return
  try {
    const { data: person } = await sb.from('crm_people').select('id, custom').eq('id', personId).maybeSingle()
    if (!person) return
    const custom = {
      ...((person.custom as Record<string, unknown>) ?? {}),
      cmaLink: opts.cmaLink,
      cmaSlug: opts.cmaSlug,
    }
    await sb.from('crm_people').update({ custom, updated_at: new Date().toISOString() }).eq('id', personId)
  } catch (e) {
    console.warn('[stampCmaLinkOnPerson]', e instanceof Error ? e.message : String(e))
  }
}

/** Best-effort crm_timeline entry (email_out for sends, system otherwise). */
export async function logCmaTimelineEvent(
  personId: number,
  entry: {
    kind: string
    title: string
    body: string
    broker?: string | null
    dedupeKey?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const sb = client()
  if (!sb) return
  try {
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      broker: entry.broker ?? null,
      source: 'app',
      payload: entry.payload ?? {},
      dedupe_key: entry.dedupeKey ?? null,
    })
  } catch (e) {
    console.warn('[logCmaTimelineEvent]', e instanceof Error ? e.message : String(e))
  }
}

/**
 * Stamp cmas.person_id for a kicked-off build (W5.1 person link). The build
 * engine has no person concept; the kickoff DOES — without this stamp the
 * person page's Valuations lane cannot see the doc (found live 2026-08-05 on
 * the litmus fixture: person_id null on a person-kicked CMA). Fills only when
 * unset — never re-links a row that already belongs to someone.
 */
export async function stampCmaPersonId(slug: string, personId: number): Promise<void> {
  const sb = client()
  if (!sb) return
  try {
    await sb
      .from('cmas')
      .update({ person_id: personId })
      .eq('slug', slug)
      .is('person_id', null)
  } catch (e) {
    console.warn('[stampCmaPersonId]', e instanceof Error ? e.message : String(e))
  }
}

export type AttachCmaPersonResult =
  | {
      ok: true
      personId: number
      clientName: string | null
      clientEmail: string | null
      clientPhone: string | null
    }
  | { ok: false; error: string }

/**
 * Real person-link on a CMA. Sets `person_id` and fills blank client name /
 * email / phone from the person. `replace: false` (kickoff) will not steal a
 * row that already belongs to someone else; the review picker passes true.
 */
export async function attachCmaToPerson(
  slug: string,
  personId: number,
  opts?: { replace?: boolean },
): Promise<AttachCmaPersonResult> {
  const safeSlug = slug.trim().toLowerCase()
  if (!safeSlug || !Number.isFinite(personId) || personId <= 0) {
    return { ok: false, error: 'CMA slug and a person are required.' }
  }
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const person = await getPersonForCmaKickoff(personId)
  if (!person) return { ok: false, error: 'Contact not found' }
  try {
    const { data: row, error: readErr } = await sb
      .from('cmas')
      .select('person_id, client_name, client_email, client_phone')
      .eq('slug', safeSlug)
      .maybeSingle()
    if (readErr) return { ok: false, error: readErr.message }
    if (!row) return { ok: false, error: 'CMA not found' }
    const existingId = row.person_id == null ? null : Number(row.person_id)
    if (existingId && existingId !== personId && !opts?.replace) {
      return { ok: false, error: 'This CMA is already linked to another person.' }
    }
    const clientName = (row.client_name as string | null) || person.name || null
    const clientEmail = (row.client_email as string | null) || person.primaryEmail
    const clientPhone = (row.client_phone as string | null) || person.primaryPhone
    const { error } = await sb
      .from('cmas')
      .update({
        person_id: personId,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
      })
      .eq('slug', safeSlug)
    if (error) return { ok: false, error: error.message }
    return { ok: true, personId, clientName, clientEmail, clientPhone }
  } catch (e) {
    console.error('[attachCmaToPerson]', e)
    return { ok: false, error: 'Could not link this CMA to the person.' }
  }
}
