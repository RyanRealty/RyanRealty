import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getPeopleListSignals — per-row signals for the §05 People list
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md §6 columns 5 + 8).
 *
 * For one PAGE of person ids (≤ 50) returns:
 *   - lastVisit    — max visitor_sessions.last_seen_at for the person's
 *                    identity-stitched sessions (crm_person_id). The §6 "Last
 *                    Visit" website column.
 *   - lastActivity — the person's latest LEAD-INITIATED crm_timeline event
 *                    (inbound comms, inquiry, lead created — never agent
 *                    outreach), with kind + title for the icon + description.
 *
 * DAL boundary (G1): raw .from() reads live here. Not cached — the page is
 * force-dynamic and the input set changes per request; two IN-list queries on
 * indexed columns are cheap at page size.
 */

export type PersonListSignal = {
  personId: number
  lastVisit: string | null
  lastActivity: { kind: string; title: string | null; ts: string } | null
}

/** Lead-initiated timeline kinds (§6 col 8: lead-side signals only). */
const LEAD_KINDS = [
  'lead_created', 'email_in', 'sms_in', 'call', 'voicemail',
  'inquiry', 'form_submission', 'property_inquiry', 'page_view', 'property_view',
] as const

export async function getPeopleListSignals(personIds: number[]): Promise<Map<number, PersonListSignal>> {
  const out = new Map<number, PersonListSignal>()
  const ids = Array.from(new Set(personIds.filter((n) => Number.isInteger(n) && n > 0)))
  if (ids.length === 0) return out
  for (const id of ids) out.set(id, { personId: id, lastVisit: null, lastActivity: null })

  const sb = createServiceClient()
  const [visits, events] = await Promise.all([
    sb
      .from('visitor_sessions')
      .select('crm_person_id,last_seen_at')
      .in('crm_person_id', ids)
      .order('last_seen_at', { ascending: false })
      .limit(1000),
    sb
      .from('crm_timeline')
      .select('person_id,kind,title,ts')
      .in('person_id', ids)
      .in('kind', LEAD_KINDS as unknown as string[])
      .order('ts', { ascending: false })
      .limit(2000),
  ])

  if (visits.error) console.error('[getPeopleListSignals] visits', visits.error.message)
  for (const v of visits.data ?? []) {
    const pid = Number(v.crm_person_id)
    const sig = out.get(pid)
    if (sig && !sig.lastVisit && v.last_seen_at) sig.lastVisit = v.last_seen_at as string
  }

  if (events.error) console.error('[getPeopleListSignals] timeline', events.error.message)
  for (const e of events.data ?? []) {
    const pid = Number(e.person_id)
    const sig = out.get(pid)
    if (sig && !sig.lastActivity && e.ts) {
      sig.lastActivity = { kind: String(e.kind), title: (e.title as string | null) ?? null, ts: e.ts as string }
    }
  }

  return out
}
