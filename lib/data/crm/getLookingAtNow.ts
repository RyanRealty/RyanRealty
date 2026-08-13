/**
 * getLookingAtNow — Today lane for identified people looking at a specific home
 * (A1 / A48). SMS is the poke; this list is the job if the broker misses the
 * text. Same 24h window as the person-header NOW line. Assigned-broker scoped.
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { RECENT_LISTING_VIEW_MS } from '@/lib/crm/person-header-lines'
import {
  BROKER_ALERT_MAILBOXES,
  collapseLookingAtByPerson,
  formatLookingAtAddress,
  lookingAtAskHref,
  lookingAtTodayTitle,
  type LookingAtRaw,
} from '@/lib/crm/looking-at'

export type LookingAtNowItem = {
  personId: number
  personName: string
  listingKey: string
  address: string
  occurredAt: string
  deepLink: string
  /** Person composer with the D1 ask prefilled. Draft only. Never a send. */
  askHref: string
  title: string
}

const IN_CHUNK = 100
const SESSION_CAP = 200
const EVENT_CAP = 500
const ROW_CAP = 20

type Sb = ReturnType<typeof createServiceClient>

const safeRows = async <T,>(q: PromiseLike<{ data: unknown }>): Promise<T[]> => {
  try {
    const { data } = await q
    return (data ?? []) as T[]
  } catch {
    return []
  }
}

async function fetchPeople(
  sb: Sb,
  ids: number[],
  brokerScope: string | null,
): Promise<Map<number, { name: string | null }>> {
  const out = new Map<number, { name: string | null }>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    let q = sb
      .from('crm_people')
      .select('id,name,assigned_broker')
      .eq('deleted', false)
      .in('id', ids.slice(i, i + IN_CHUNK))
    if (brokerScope) q = q.eq('assigned_broker', brokerScope)
    const { data } = await q
    for (const p of data ?? []) out.set(p.id as number, { name: (p.name as string | null) ?? null })
  }
  return out
}

async function brokerPersonIds(sb: Sb, ids: number[]): Promise<Set<number>> {
  const brokers = new Set<number>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data } = await sb
      .from('crm_contact_points')
      .select('person_id,value')
      .eq('kind', 'email')
      .in('person_id', ids.slice(i, i + IN_CHUNK))
    for (const row of data ?? []) {
      if (BROKER_ALERT_MAILBOXES.has(String(row.value).toLowerCase())) {
        brokers.add(row.person_id as number)
      }
    }
  }
  return brokers
}

async function streetByMls(sb: Sb, mlsNumbers: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < mlsNumbers.length; i += IN_CHUNK) {
    const chunk = mlsNumbers.slice(i, i + IN_CHUNK)
    const rows = await safeRows<{
      ListNumber: string
      StreetNumber: string | null
      StreetName: string | null
    }>(sb.from('listings').select('ListNumber,StreetNumber,StreetName').in('ListNumber', chunk))
    for (const row of rows) {
      const addr = formatLookingAtAddress({
        streetNumber: row.StreetNumber,
        streetName: row.StreetName,
      })
      if (addr) out.set(row.ListNumber, addr)
    }
  }
  return out
}

export async function getLookingAtNow(brokerScope: string | null): Promise<LookingAtNowItem[]> {
  const sb = createServiceClient()
  const cutoffIso = new Date(Date.now() - RECENT_LISTING_VIEW_MS).toISOString()

  type Sess = { session_id: string; crm_person_id: number }
  const sessions = (
    await safeRows<Sess>(
      sb
        .from('visitor_sessions')
        .select('session_id,crm_person_id')
        .not('crm_person_id', 'is', null)
        .gte('last_seen_at', cutoffIso)
        .limit(SESSION_CAP),
    )
  ).filter((s) => Number.isFinite(s.crm_person_id) && s.crm_person_id > 0)

  if (sessions.length === 0) return []

  const sessionToPerson = new Map<string, number>()
  for (const s of sessions) sessionToPerson.set(s.session_id, s.crm_person_id)
  const sessionIds = [...sessionToPerson.keys()]

  type Ev = {
    session_id: string
    listing_mls: string | null
    listing_street: string | null
    page_url: string | null
    event_at: string
  }
  const events: Ev[] = []
  for (let i = 0; i < sessionIds.length; i += IN_CHUNK) {
    const chunk = sessionIds.slice(i, i + IN_CHUNK)
    const rows = await safeRows<Ev>(
      sb
        .from('visitor_events')
        .select('session_id,listing_mls,listing_street,page_url,event_at')
        .eq('event_type', 'listing_view')
        .in('session_id', chunk)
        .not('listing_mls', 'is', null)
        .gte('event_at', cutoffIso)
        .order('event_at', { ascending: false })
        .limit(EVENT_CAP),
    )
    events.push(...rows)
  }

  const raw: LookingAtRaw[] = events.map((e) => ({
    personId: sessionToPerson.get(e.session_id) ?? 0,
    listingKey: (e.listing_mls ?? '').trim(),
    occurredAt: e.event_at,
    listingStreet: e.listing_street,
    pageUrl: e.page_url,
  }))

  const needMls = [
    ...new Set(
      raw
        .filter((r) => r.listingKey && !formatLookingAtAddress({ street: r.listingStreet }))
        .map((r) => r.listingKey),
    ),
  ]
  const addressByMls = needMls.length > 0 ? await streetByMls(sb, needMls) : new Map<string, string>()
  const collapsed = collapseLookingAtByPerson(raw, addressByMls)
  if (collapsed.length === 0) return []

  const ids = collapsed.map((c) => c.personId)
  const [people, brokers] = await Promise.all([
    fetchPeople(sb, ids, brokerScope).catch(() => new Map<number, { name: string | null }>()),
    brokerPersonIds(sb, ids).catch(() => new Set<number>()),
  ])

  const items: LookingAtNowItem[] = []
  for (const row of collapsed) {
    if (!people.has(row.personId) || brokers.has(row.personId)) continue
    const personName = people.get(row.personId)?.name?.trim() || 'Someone'
    items.push({
      personId: row.personId,
      personName,
      listingKey: row.listingKey,
      address: row.address,
      occurredAt: row.occurredAt,
      deepLink: `/admin/people/${row.personId}`,
      askHref: lookingAtAskHref(row.personId, row.address),
      title: lookingAtTodayTitle(personName, row.address),
    })
    if (items.length >= ROW_CAP) break
  }
  return items
}
