/**
 * CMA threads for a sync page: one bounded read per source for the people
 * in the window, not one query per message. Fail-open. Raw .from() stays
 * in the DAL (G1). A chunk that hits the PostgREST cap warns and returns
 * what it has; the sync still writes the mail.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { assembleCmaThreadRecords, type CmaThreadRecord } from '@/lib/crm/cma-thread-label'

const PERSON_CHUNK = 80
const PAGE_CAP = 1000

type EventRow = {
  person_id?: unknown
  recipient_email?: unknown
  subject?: unknown
  email_key?: unknown
  meta?: unknown
}
type TimelineRow = { person_id?: unknown; title?: unknown; payload?: unknown }
type CmaRow = { person_id?: unknown; slug?: unknown; client_email?: unknown }

function chunkIds(ids: number[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < ids.length; i += PERSON_CHUNK) out.push(ids.slice(i, i + PERSON_CHUNK))
  return out
}

export async function getCmaThreadsForPeople(personIds: readonly number[]): Promise<CmaThreadRecord[]> {
  const ids = [...new Set(personIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (!ids.length) return []
  try {
    const sb = createServiceClient()
    const events: EventRow[] = []
    const timeline: TimelineRow[] = []
    const cmas: CmaRow[] = []
    for (const chunk of chunkIds(ids)) {
      const [eventRes, timelineRes, cmaRes] = await Promise.all([
        sb
          .from('email_events')
          .select('person_id, recipient_email, subject, email_key, meta')
          .eq('send_type', 'cma')
          .eq('event', 'sent')
          .in('person_id', chunk)
          .order('occurred_at', { ascending: false })
          .limit(PAGE_CAP),
        sb
          .from('crm_timeline')
          .select('person_id, title, payload')
          .eq('kind', 'email_out')
          .contains('payload', { artifact: 'cma' })
          .in('person_id', chunk)
          .order('ts', { ascending: false })
          .limit(PAGE_CAP),
        sb
          .from('cmas')
          .select('person_id, slug, client_email')
          .in('person_id', chunk)
          .not('delivered_at', 'is', null)
          .order('delivered_at', { ascending: false })
          .limit(PAGE_CAP),
      ])
      if (eventRes.error) console.warn('[getCmaThreadsForPeople] email_events', eventRes.error.message)
      else {
        events.push(...((eventRes.data ?? []) as EventRow[]))
        if ((eventRes.data ?? []).length === PAGE_CAP) {
          console.warn('[getCmaThreadsForPeople] email_events page hit 1000; older CMA threads may be unlabeled')
        }
      }
      if (timelineRes.error) console.warn('[getCmaThreadsForPeople] crm_timeline', timelineRes.error.message)
      else {
        timeline.push(...((timelineRes.data ?? []) as TimelineRow[]))
        if ((timelineRes.data ?? []).length === PAGE_CAP) {
          console.warn('[getCmaThreadsForPeople] crm_timeline page hit 1000; older CMA threads may be unlabeled')
        }
      }
      if (cmaRes.error) console.warn('[getCmaThreadsForPeople] cmas', cmaRes.error.message)
      else {
        cmas.push(...((cmaRes.data ?? []) as CmaRow[]))
        if ((cmaRes.data ?? []).length === PAGE_CAP) {
          console.warn('[getCmaThreadsForPeople] cmas page hit 1000; older CMA threads may be unlabeled')
        }
      }
    }
    return assembleCmaThreadRecords({ emailEvents: events, timeline, cmas })
  } catch (err) {
    console.warn('[getCmaThreadsForPeople]', err instanceof Error ? err.message : err)
    return []
  }
}
