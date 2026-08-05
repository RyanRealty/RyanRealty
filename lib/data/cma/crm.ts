/**
 * CRM side-effects of a CMA send — person resolution, cmaLink stamping, and
 * the timeline entry. Kept behind the DAL boundary so lib/cma/send.ts stays
 * free of raw table access.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

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
