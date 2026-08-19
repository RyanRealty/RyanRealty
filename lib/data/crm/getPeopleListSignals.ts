import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { composeListNextStep } from '@/lib/crm/person-header-lines'

/**
 * getPeopleListSignals — per-row signals for the §05 People list
 * (docs/crm-spec/05-people-list-and-bulk-actions.md §6 columns 5 + 8).
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
  nextLine: string
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
  for (const id of ids) out.set(id, { personId: id, lastVisit: null, lastActivity: null, nextLine: 'No next step queued.' })

  const sb = createServiceClient()
  const [visits, events, waiting] = await Promise.all([
    sb
      .from('visitor_sessions')
      .select('crm_person_id,last_seen_at')
      .in('crm_person_id', ids)
      .order('last_seen_at', { ascending: false })
      .limit(1000),
    // Paged read (PostgREST caps single responses at 1,000 rows — a bare
    // .limit(2000) silently truncated there, dropping low-activity people's
    // latest events behind chattier ones). Newest-first, id tiebreaker.
    fetchPagedRows<{ person_id: number; kind: string; title: string | null; ts: string | null }>(
      (from, to) =>
        sb
          .from('crm_timeline')
          .select('person_id,kind,title,ts')
          .in('person_id', ids)
          .in('kind', LEAD_KINDS as unknown as string[])
          .order('ts', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      2000,
    ),
    sb
      .from('crm_sequence_enrollments')
      .select('person_id,step_index,crm_sequences!inner(name,steps)')
      .in('person_id', ids)
      .eq('status', 'awaiting_broker_next'),
  ])

  if (visits.error) console.error('[getPeopleListSignals] visits', visits.error.message)
  for (const v of visits.data ?? []) {
    const pid = Number(v.crm_person_id)
    const sig = out.get(pid)
    if (sig && !sig.lastVisit && v.last_seen_at) sig.lastVisit = v.last_seen_at as string
  }

  if (events.error) console.error('[getPeopleListSignals] timeline', events.error.message)
  for (const e of events.rows) {
    const pid = Number(e.person_id)
    const sig = out.get(pid)
    if (sig && !sig.lastActivity && e.ts) {
      sig.lastActivity = { kind: String(e.kind), title: (e.title as string | null) ?? null, ts: e.ts as string }
    }
  }

  if (waiting.error) console.error('[getPeopleListSignals] waiting', waiting.error.message)
  const waitingByPerson = new Map<number, { sequenceName: string; channel: string }>()
  for (const row of waiting.data ?? []) {
    const pid = Number(row.person_id)
    if (waitingByPerson.has(pid)) continue
    const seq = row.crm_sequences as unknown as { name?: string; steps?: Array<Record<string, unknown>> }
    const step = (seq.steps ?? [])[row.step_index as number]
    waitingByPerson.set(pid, {
      sequenceName: String(seq.name ?? ''),
      channel: String(step?.channel ?? 'step'),
    })
  }
  for (const sig of out.values()) {
    sig.nextLine = composeListNextStep({
      lastActivityKind: sig.lastActivity?.kind ?? null,
      sequenceWaiting: waitingByPerson.get(sig.personId) ?? null,
    })
  }

  return out
}
