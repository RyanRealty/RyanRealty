/**
 * Row read behind the visitor automation audit (scripts/audit-visitor-automation.ts,
 * 2026-10-14): every visitor_sessions row born in a window, with a per-session
 * summary of its visitor_events, plus the browsers (rr_vid) the identity map
 * knows as a contact.
 *
 * The audit runs the classifier in lib/analytics/automation.ts over these rows,
 * so a rule's hit count on history and a rule's behaviour on a live request come
 * from ONE definition. This read returns rows only; every count is computed by
 * the caller, in the open, from what came back (CLAUDE.md §0: row counts, the
 * window and the filter are printed with every figure).
 *
 * DAL boundary (G1): the raw .from() reads live here. Read-only. Fails soft:
 * `unreadable` with the error instead of a silent partial window.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type AuditSessionRow = {
  session_id: string
  first_seen_at: string
  last_seen_at: string
  referrer: string | null
  landing_page: string | null
  user_agent: string | null
  ip_country: string | null
  ip_region: string | null
  ip_city: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  fbclid: string | null
  gclid: string | null
  rr_vid: string | null
  crm_person_id: number | null
  identified_at: string | null
  identified_via: string | null
  engagement_score: number | null
  is_automated: boolean | null
  automation_reason: string | null
}

/** One visitor_events row, trimmed to what the classifier reads. */
export type AuditEvent = { type: string; pageUrl: string | null; at: string }

export type AutomationAuditWindow = {
  sinceIso: string
  untilIso: string
  sessions: AuditSessionRow[]
  /** session_id -> its events, oldest first (sessions with no event are absent). */
  events: Map<string, AuditEvent[]>
  /** rr_vids visitor_identity_map holds against a contact. */
  knownBrowsers: Set<string>
  eventRowsRead: number
  unreadable: boolean
  errorMessage?: string
}

const SESSION_SELECT =
  'session_id, first_seen_at, last_seen_at, referrer, landing_page, user_agent, ip_country, ip_region, ip_city, ' +
  'utm_source, utm_medium, utm_campaign, fbclid, gclid, rr_vid, crm_person_id, identified_at, identified_via, ' +
  'engagement_score, is_automated, automation_reason'

/** A session's events can trail its birth; read this far past the window's end. */
const EVENT_TAIL_MS = 2 * 86_400_000

export async function readAutomationAuditWindow(args: {
  sinceIso: string
  untilIso: string
}): Promise<AutomationAuditWindow> {
  const { sinceIso, untilIso } = args
  const empty = (errorMessage: string): AutomationAuditWindow => ({
    sinceIso,
    untilIso,
    sessions: [],
    events: new Map(),
    knownBrowsers: new Set(),
    eventRowsRead: 0,
    unreadable: true,
    errorMessage,
  })
  let sb
  try {
    sb = createServiceClient()
  } catch (err) {
    return empty(err instanceof Error ? err.message : String(err))
  }

  const sessionsRead = await fetchPagedRows<AuditSessionRow>((from, to) =>
    sb
      .from('visitor_sessions')
      .select(SESSION_SELECT)
      .gte('first_seen_at', sinceIso)
      .lt('first_seen_at', untilIso)
      .order('first_seen_at', { ascending: true })
      .order('session_id', { ascending: true })
      .range(from, to),
  )
  if (sessionsRead.error) return empty(`visitor_sessions: ${sessionsRead.error.message}`)

  const inWindow = new Set(sessionsRead.rows.map((r) => r.session_id))
  const eventUntil = new Date(new Date(untilIso).getTime() + EVENT_TAIL_MS).toISOString()
  type EventRow = { id: number; session_id: string; event_type: string; event_at: string; page_url: string | null }
  const eventsRead = await fetchPagedRows<EventRow>((from, to) =>
    sb
      .from('visitor_events')
      .select('id, session_id, event_type, event_at, page_url')
      .gte('event_at', sinceIso)
      .lt('event_at', eventUntil)
      .order('id', { ascending: true })
      .range(from, to),
  )
  if (eventsRead.error) return empty(`visitor_events: ${eventsRead.error.message}`)

  const events = new Map<string, AuditEvent[]>()
  for (const e of eventsRead.rows) {
    if (!inWindow.has(e.session_id)) continue
    let list = events.get(e.session_id)
    if (!list) {
      list = []
      events.set(e.session_id, list)
    }
    list.push({ type: e.event_type, pageUrl: e.page_url, at: e.event_at })
  }
  for (const list of events.values()) list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  type MapRow = { rr_vid: string }
  const mapRead = await fetchPagedRows<MapRow>((from, to) =>
    sb
      .from('visitor_identity_map')
      .select('rr_vid')
      .not('crm_person_id', 'is', null)
      .order('rr_vid', { ascending: true })
      .range(from, to),
  )
  if (mapRead.error) return empty(`visitor_identity_map: ${mapRead.error.message}`)

  return {
    sinceIso,
    untilIso,
    sessions: sessionsRead.rows,
    events,
    knownBrowsers: new Set(mapRead.rows.map((r) => r.rr_vid)),
    eventRowsRead: eventsRead.rows.length,
    unreadable: false,
  }
}
