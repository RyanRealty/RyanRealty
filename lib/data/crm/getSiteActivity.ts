/**
 * Known-contact site activity (P7 identity loop, Matt 2026-09-23): "when I go
 * and see who's been active, I can see exactly what they're looking at."
 *
 *   getActiveKnownPeople  -> /admin/visitors/live?filter=people : identified
 *                            contacts active in the last 1 / 7 / 30 days, most
 *                            recent first, each with their pages.
 *   getPersonSiteActivity -> the CRM person page: one contact's visits, page by
 *                            page, across every browser and device stitched to
 *                            them.
 *
 * Sources (all first-party, docs/DATABASE_SCHEMA_SNAPSHOT.md):
 *   visitor_sessions  crm_person_id (the identity loop stamps it), first touch,
 *                     is_automated (migration 20260923120000; automation is
 *                     excluded, and the read degrades to "no filter" until the
 *                     migration is applied)
 *   visitor_events    page_url (identity params already stripped), page_title,
 *                     event_at, listing_mls
 *   crm_people        name, stage, assigned broker (deleted people excluded;
 *                     scripted form submits the p06 intake screen flags are
 *                     left off the Known people list, isSuspectContact)
 *   listings          CURRENT address, price and status for each MLS number a
 *                     page view names (§0: a price shown to a broker is the live
 *                     row, never a snapshot from when the page was viewed)
 *
 * Shaping (visits, time on page, source) is pure: lib/crm/site-activity.ts.
 * DAL boundary (G1): the raw .from() reads live here. Fails soft to empty.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveLeadSessionIds } from '@/lib/data/crm/getViewedListings'
import { isMissingColumnError } from '@/lib/data/identity/sessionIdentity'
import { PROVISIONAL_AUTOMATION_REASONS } from '@/lib/analytics/automation'
import {
  buildVisits,
  isSuspectContact,
  type ActivityEventRow,
  type ActivitySessionRow,
  type ActivityVisit,
} from '@/lib/crm/site-activity'

export const ACTIVITY_WINDOWS = [1, 7, 30] as const
export type ActivityWindowDays = (typeof ACTIVITY_WINDOWS)[number]

export type ListingFact = {
  mls: string
  address: string | null
  city: string | null
  listPrice: number | null
  status: string | null
}

export type KnownPersonActivity = {
  personId: number
  name: string
  stage: string | null
  assignedBroker: string | null
  lastSeenAt: string
  visits: ActivityVisit[]
  pageViews: number
  listingViews: number
  /** How the person was identified on their most recent session. */
  identifiedVia: string | null
}

export type ActiveKnownPeopleResult = {
  windowDays: ActivityWindowDays
  people: KnownPersonActivity[]
  listings: Record<string, ListingFact>
  /** Identified sessions in the window (after the automation filter). */
  sessionsInWindow: number
  /**
   * Identified contacts active in the window who were left off because they
   * read as scripted form submits (quality:suspect, lib/crm/lead-quality.ts).
   */
  suspectPeopleHidden: number
  /** False until migration 20260923120000 is applied (no automation filter yet). */
  automationFilterApplied: boolean
  /** True when a row cap was hit and older activity may be missing. */
  truncated: boolean
}

const SESSION_SELECT =
  'session_id, crm_person_id, first_seen_at, last_seen_at, utm_source, utm_medium, utm_campaign, referrer, identified_via'
const EVENT_SELECT = 'session_id, event_at, event_type, page_url, page_title, listing_mls'
const PAGE = 1000
const SESSION_CAP = 3000
/** Distinct people screened before the display cap (suspects drop out first). */
const CANDIDATE_CAP = 400
const EVENT_CAP = 8000
const IN_CHUNK = 100

/**
 * The automation filter for IDENTIFIED sessions: leave out what the user agent
 * says is a machine (is_automated), but keep a PROVISIONAL behavioural flag
 * (lib/analytics/automation.ts): a session that became a known contact through
 * a form submit or a link is a person's, even when it landed on the crawler's
 * page shape and never posted a second event. Scripted form submits are screened
 * at the person level instead (isSuspectContact).
 */
const HUMAN_SESSION_OR = `is_automated.eq.false,automation_reason.in.(${[...PROVISIONAL_AUTOMATION_REASONS].join(',')})`

type SessionRow = {
  session_id: string
  crm_person_id: number | null
  first_seen_at: string | null
  last_seen_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  identified_via: string | null
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function toSessionRow(r: SessionRow): ActivitySessionRow {
  return {
    sessionId: r.session_id,
    firstSeenAt: r.first_seen_at,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    referrer: r.referrer,
    identifiedVia: r.identified_via,
  }
}

/** Identified, non-automated sessions active since `since`, newest first. */
async function readIdentifiedSessions(
  sb: SupabaseClient,
  since: string,
): Promise<{ rows: SessionRow[]; filtered: boolean; truncated: boolean }> {
  const page = async (withFilter: boolean, from: number) => {
    let q = sb
      .from('visitor_sessions')
      .select(SESSION_SELECT)
      .not('crm_person_id', 'is', null)
      .gte('last_seen_at', since)
    if (withFilter) q = q.or(HUMAN_SESSION_OR)
    return q.order('last_seen_at', { ascending: false }).range(from, from + PAGE - 1)
  }
  let filtered = true
  const rows: SessionRow[] = []
  for (let from = 0; from < SESSION_CAP; from += PAGE) {
    let res = await page(filtered, from)
    if (res.error && filtered && isMissingColumnError(res.error)) {
      filtered = false
      res = await page(false, from)
    }
    if (res.error) break
    const data = (res.data ?? []) as unknown as SessionRow[]
    rows.push(...data)
    if (data.length < PAGE) return { rows, filtered, truncated: false }
  }
  return { rows, filtered, truncated: rows.length >= SESSION_CAP }
}

async function readEvents(
  sb: SupabaseClient,
  sessionIds: string[],
  since: string,
): Promise<{ rows: ActivityEventRow[]; truncated: boolean }> {
  const out: ActivityEventRow[] = []
  let truncated = false
  for (let i = 0; i < sessionIds.length && out.length < EVENT_CAP; i += IN_CHUNK) {
    const chunk = sessionIds.slice(i, i + IN_CHUNK)
    for (let from = 0; from < EVENT_CAP; from += PAGE) {
      const { data, error } = await sb
        .from('visitor_events')
        .select(EVENT_SELECT)
        .in('session_id', chunk)
        .gte('event_at', since)
        .order('event_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) break
      const page = (data ?? []) as Array<{
        session_id: string
        event_at: string
        event_type: string
        page_url: string
        page_title: string | null
        listing_mls: string | null
      }>
      for (const e of page) {
        out.push({
          sessionId: e.session_id,
          at: e.event_at,
          type: e.event_type,
          url: e.page_url,
          title: e.page_title,
          listingMls: e.listing_mls,
        })
      }
      if (page.length < PAGE) break
      if (out.length >= EVENT_CAP) {
        truncated = true
        break
      }
    }
  }
  return { rows: out, truncated }
}

/** Live address / price / status for the MLS numbers the pages name. */
export async function readListingFacts(sb: SupabaseClient, mlsNumbers: string[]): Promise<Record<string, ListingFact>> {
  const out: Record<string, ListingFact> = {}
  const unique = [...new Set(mlsNumbers.filter((m) => /^\d{6,}$/.test(m)))].slice(0, 400)
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK)
    const { data, error } = await sb
      .from('listings')
      .select('ListNumber, StreetNumber, StreetName, City, ListPrice, StandardStatus')
      .in('ListNumber', chunk)
      .limit(chunk.length * 3)
    if (error) continue
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const mls = String(r.ListNumber ?? '')
      if (!mls || out[mls]) continue
      const address = [r.StreetNumber, r.StreetName].filter((v) => v != null && String(v).trim()).join(' ')
      out[mls] = {
        mls,
        address: address || null,
        city: (r.City as string | null) ?? null,
        listPrice: r.ListPrice == null ? null : Number(r.ListPrice),
        status: (r.StandardStatus as string | null) ?? null,
      }
    }
  }
  return out
}

type PersonRow = {
  id: number
  name: string | null
  first_name: string | null
  last_name: string | null
  stage: string | null
  assigned_broker: string | null
  tags: string[] | null
  emails: unknown
}

async function readPeople(sb: SupabaseClient, ids: number[]): Promise<Map<number, PersonRow>> {
  const out = new Map<number, PersonRow>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { data, error } = await sb
      .from('crm_people')
      .select('id, name, first_name, last_name, stage, assigned_broker, tags, emails')
      .in('id', chunk)
      .eq('deleted', false)
      .limit(chunk.length)
    if (error) continue
    for (const r of (data ?? []) as PersonRow[]) out.set(Number(r.id), r)
  }
  return out
}

function displayName(p: PersonRow): string {
  const full = (p.name ?? '').trim() || [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return full || `Contact #${p.id}`
}

function countViews(visits: ActivityVisit[]): { pageViews: number; listingViews: number } {
  let pageViews = 0
  let listingViews = 0
  for (const v of visits) {
    pageViews += v.pages.length
    listingViews += v.pages.filter((p) => p.listingMls).length
  }
  return { pageViews, listingViews }
}

/**
 * Identified contacts active in the last `days`, most recent first, each with
 * their visits and pages in that window. Automation-flagged sessions are
 * excluded (once the flag column exists).
 */
export async function getActiveKnownPeople(opts: {
  days: ActivityWindowDays
  limit?: number
}): Promise<ActiveKnownPeopleResult> {
  const windowDays = opts.days
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const empty: ActiveKnownPeopleResult = {
    windowDays,
    people: [],
    listings: {},
    sessionsInWindow: 0,
    suspectPeopleHidden: 0,
    automationFilterApplied: false,
    truncated: false,
  }
  try {
    const sb = createServiceClient()
    const since = sinceIso(windowDays)
    const sessions = await readIdentifiedSessions(sb, since)
    if (sessions.rows.length === 0) return { ...empty, automationFilterApplied: sessions.filtered }

    // Most recent first -> the first time a person appears is their latest.
    const candidates: number[] = []
    const sessionsByPerson = new Map<number, SessionRow[]>()
    for (const r of sessions.rows) {
      const pid = Number(r.crm_person_id)
      if (!Number.isInteger(pid) || pid <= 0) continue
      if (!sessionsByPerson.has(pid)) {
        if (candidates.length >= CANDIDATE_CAP) continue
        candidates.push(pid)
        sessionsByPerson.set(pid, [])
      }
      sessionsByPerson.get(pid)!.push(r)
    }

    // Screen BEFORE the display cap, so scripted submits never take a slot.
    const people = await readPeople(sb, candidates)
    let suspectPeopleHidden = 0
    const order: number[] = []
    for (const pid of candidates) {
      const person = people.get(pid)
      if (!person) continue // deleted or unreadable
      if (isSuspectContact(person)) {
        suspectPeopleHidden++
        continue
      }
      if (order.length < limit) order.push(pid)
    }

    const sessionIds = order.flatMap((pid) => sessionsByPerson.get(pid)!.map((s) => s.session_id))
    const events = await readEvents(sb, sessionIds, since)

    const eventsBySession = new Map<string, ActivityEventRow[]>()
    for (const e of events.rows) {
      const list = eventsBySession.get(e.sessionId) ?? []
      list.push(e)
      eventsBySession.set(e.sessionId, list)
    }

    const result: KnownPersonActivity[] = []
    const mls: string[] = []
    for (const pid of order) {
      const person = people.get(pid)!
      const rows = sessionsByPerson.get(pid)!
      const personEvents = rows.flatMap((s) => eventsBySession.get(s.session_id) ?? [])
      const visits = buildVisits(personEvents, rows.map(toSessionRow))
      for (const v of visits) for (const p of v.pages) if (p.listingMls) mls.push(p.listingMls)
      result.push({
        personId: pid,
        name: displayName(person),
        stage: person.stage,
        assignedBroker: person.assigned_broker,
        lastSeenAt: rows[0].last_seen_at,
        visits,
        ...countViews(visits),
        identifiedVia: rows[0].identified_via,
      })
    }

    const listings = await readListingFacts(sb, mls)
    return {
      windowDays,
      people: result,
      listings,
      sessionsInWindow: sessions.rows.length,
      suspectPeopleHidden,
      automationFilterApplied: sessions.filtered,
      truncated: sessions.truncated || events.truncated || candidates.length >= CANDIDATE_CAP,
    }
  } catch (err) {
    console.warn('[getActiveKnownPeople] read failed:', err instanceof Error ? err.message : String(err))
    return empty
  }
}

export type PersonSiteActivity = {
  windowDays: number
  visits: ActivityVisit[]
  listings: Record<string, ListingFact>
  pageViews: number
  listingViews: number
  lastSeenAt: string | null
  truncated: boolean
}

/**
 * One contact's visits, page by page, over the last `days`, across every
 * session the identity chain resolves to them (crm_person_id, the legacy
 * lockstep id, identity-map rr_vids on any device, their emails).
 */
export async function getPersonSiteActivity(args: {
  personId: number
  fubLegacyId?: number | null
  emails?: string[]
  days?: number
}): Promise<PersonSiteActivity> {
  const windowDays = Math.min(Math.max(args.days ?? 30, 1), 365)
  const empty: PersonSiteActivity = {
    windowDays,
    visits: [],
    listings: {},
    pageViews: 0,
    listingViews: 0,
    lastSeenAt: null,
    truncated: false,
  }
  if (!Number.isInteger(args.personId) || args.personId <= 0) return empty
  try {
    const sb = createServiceClient()
    const sessionIds = await resolveLeadSessionIds(sb, {
      crmPersonId: args.personId,
      fubLegacyId: args.fubLegacyId ?? null,
      emails: args.emails ?? [],
    })
    if (sessionIds.length === 0) return empty
    const since = sinceIso(windowDays)

    // Session meta for the source labels; automation excluded when the flag exists.
    const metaRows: SessionRow[] = []
    let filtered = true
    for (let i = 0; i < sessionIds.length; i += IN_CHUNK) {
      const chunk = sessionIds.slice(i, i + IN_CHUNK)
      const run = (withFilter: boolean) => {
        let q = sb.from('visitor_sessions').select(SESSION_SELECT).in('session_id', chunk)
        if (withFilter) q = q.or(HUMAN_SESSION_OR)
        return q.limit(chunk.length)
      }
      let res = await run(filtered)
      if (res.error && filtered && isMissingColumnError(res.error)) {
        filtered = false
        res = await run(false)
      }
      if (!res.error) metaRows.push(...((res.data ?? []) as unknown as SessionRow[]))
    }
    const humanIds = metaRows.map((r) => r.session_id)
    if (humanIds.length === 0) return empty

    const events = await readEvents(sb, humanIds, since)
    const visits = buildVisits(events.rows, metaRows.map(toSessionRow))
    const mls = visits.flatMap((v) => v.pages.map((p) => p.listingMls).filter((m): m is string => !!m))
    const listings = await readListingFacts(sb, mls)
    const lastSeenAt = metaRows.reduce<string | null>(
      (acc, r) => (!acc || (r.last_seen_at && r.last_seen_at > acc) ? r.last_seen_at : acc),
      null,
    )
    return { windowDays, visits, listings, ...countViews(visits), lastSeenAt, truncated: events.truncated }
  } catch (err) {
    console.warn('[getPersonSiteActivity] read failed:', err instanceof Error ? err.message : String(err))
    return empty
  }
}
