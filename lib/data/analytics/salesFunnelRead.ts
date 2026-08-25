/**
 * Shared readers for the sales-funnel DAL. Not a public page import.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { SELLER_CLIENT_STAGES, WORKING_TIMELINE_KINDS } from './salesFunnelMath'
import { DISCOVERY_CHANNELS } from './discoveryPlatforms'
import { JOIN_CONVERT_EVENT } from '@/lib/data/loop/join-conversion'

export type PersonRow = {
  id: number
  name: string | null
  source: string | null
  tags: string[] | null
  created_at: string
  assigned_broker: string | null
}

export type SessionRow = {
  session_id: string
  first_seen_at: string
  engagement_score: number | null
  intent_tags: string[] | null
  crm_person_id: number | null
  identified_at: string | null
  landing_page: string | null
}

export type DealRow = {
  person_id: number | null
  pipeline: string | null
  stage: string | null
}

const PAGE = 1000
const PERSON_CHUNK = 200
const SELLER_CLIENT = new Set<string>(SELLER_CLIENT_STAGES)

export function rangeToIso(startDate: string, endDate: string): { startIso: string; endIso: string } {
  return {
    startIso: `${startDate}T00:00:00.000Z`,
    endIso: `${endDate}T23:59:59.999Z`,
  }
}

async function pageRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { rows, error: error.message }
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return { rows, error: null }
}

export function personName(row: Pick<PersonRow, 'id' | 'name'>): string {
  const n = row.name?.trim()
  return n || `Lead ${row.id}`
}

export function personHref(id: number): string {
  return `/admin/crm/${id}`
}

export async function readPeople(startIso: string, endIso: string): Promise<{ rows: PersonRow[]; error: string | null }> {
  const sb = createServiceClient()
  return pageRows<PersonRow>(async (from, to) => {
    const { data, error } = await sb
      .from('crm_people')
      .select('id, name, source, tags, created_at, assigned_broker')
      .eq('deleted', false)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
    return { data: (data ?? null) as PersonRow[] | null, error }
  })
}

export async function readSessions(
  startIso: string,
  endIso: string,
): Promise<{ rows: SessionRow[]; error: string | null }> {
  const sb = createServiceClient()
  return pageRows<SessionRow>(async (from, to) => {
    const { data, error } = await sb
      .from('visitor_sessions')
      .select(
        'session_id, first_seen_at, engagement_score, intent_tags, crm_person_id, identified_at, landing_page',
      )
      .gte('first_seen_at', startIso)
      .lte('first_seen_at', endIso)
      .order('first_seen_at', { ascending: true })
      .order('session_id', { ascending: true })
      .range(from, to)
    return { data: (data ?? null) as SessionRow[] | null, error }
  })
}

export type SessionCounts = {
  total: number
  visited: number
  engaged: number
  identified: number
  error: string | null
}

export async function countAudienceSessions(
  startIso: string,
  endIso: string,
  audience: 'seller' | 'buyer' | 'recruit',
  engagedMin: number,
): Promise<SessionCounts> {
  const sb = createServiceClient()
  const dated = () =>
    sb
      .from('visitor_sessions')
      .select('session_id', { count: 'exact', head: true })
      .gte('first_seen_at', startIso)
      .lte('first_seen_at', endIso)
  const forAudience = (q: ReturnType<typeof dated>) => {
    if (audience === 'recruit') {
      return q.or('landing_page.ilike.%/join%,landing_page.ilike.%/careers%,landing_page.ilike.%join-the%')
    }
    const tag = audience === 'seller' ? 'seller_intent' : 'buyer_intent'
    return q.contains('intent_tags', [tag])
  }
  const asCount = async (q: ReturnType<typeof dated> | ReturnType<typeof forAudience>) => {
    const { count, error } = await q
    if (error) return { count: 0, error: error.message as string }
    return { count: count ?? 0, error: null as string | null }
  }
  const [totalRes, visitedRes, engagedRes, identifiedRes] = await Promise.all([
    asCount(dated()),
    asCount(forAudience(dated())),
    asCount(forAudience(dated().gte('engagement_score', engagedMin))),
    asCount(forAudience(dated().or('crm_person_id.not.is.null,identified_at.not.is.null'))),
  ])
  const error = totalRes.error || visitedRes.error || engagedRes.error || identifiedRes.error
  return {
    total: totalRes.count,
    visited: visitedRes.count,
    engaged: engagedRes.count,
    identified: identifiedRes.count,
    error,
  }
}

export async function readAccountSnapshots(
  startDate: string,
  endDate: string,
): Promise<{ rows: Array<{ channel: string; metric: string; value: number | string | null }>; error: string | null }> {
  const channels = [...DISCOVERY_CHANNELS, 'ga4']
  const sb = createServiceClient()
  return pageRows(async (from, to) => {
    const { data, error } = await sb
      .from('marketing_channel_daily')
      .select('channel, metric, value')
      .eq('scope', 'account')
      .in('channel', channels)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('channel', { ascending: true })
      .order('metric', { ascending: true })
      .range(from, to)
    return {
      data: (data ?? null) as Array<{ channel: string; metric: string; value: number | string | null }> | null,
      error,
    }
  })
}

export async function readDeals(): Promise<{ rows: DealRow[]; error: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('crm_deals').select('person_id, pipeline, stage')
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as DealRow[], error: null }
}

export async function readWorkingPersonIds(
  personIds: number[],
  startIso: string,
): Promise<{ ids: Set<number>; error: string | null }> {
  const ids = new Set<number>()
  if (personIds.length === 0) return { ids, error: null }
  const sb = createServiceClient()
  for (let i = 0; i < personIds.length; i += PERSON_CHUNK) {
    const chunk = personIds.slice(i, i + PERSON_CHUNK)
    let from = 0
    for (;;) {
      const { data, error } = await sb
        .from('crm_timeline')
        .select('person_id, kind, source, ts')
        .in('person_id', chunk)
        .in('kind', [...WORKING_TIMELINE_KINDS])
        .gte('ts', startIso)
        .order('ts', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) return { ids, error: error.message }
      const page = (data ?? []) as Array<{
        person_id: number
        kind: string
        source: string | null
        ts: string
      }>
      for (const ev of page) {
        if (ev.kind === 'email_out' && (ev.source ?? '') === 'sequence') continue
        ids.add(Number(ev.person_id))
      }
      if (page.length < PAGE) break
      from += PAGE
    }
  }
  return { ids, error: null }
}

export function sellerClientPersonIds(deals: DealRow[]): Set<number> {
  const ids = new Set<number>()
  for (const d of deals) {
    if (!d.person_id) continue
    if ((d.pipeline ?? '') !== 'Sellers') continue
    if (!SELLER_CLIENT.has(d.stage ?? '')) continue
    ids.add(Number(d.person_id))
  }
  return ids
}

export type ActiveBrokerRow = {
  slug: string
  crmSlug: string
  name: string
}

export async function readActiveBrokers(): Promise<{ rows: ActiveBrokerRow[]; error: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('brokers')
    .select('slug, crm_slug, display_name, crm_active, is_active, sort_order')
    .eq('crm_active', true)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) return { rows: [], error: error.message }
  const rows: ActiveBrokerRow[] = []
  for (const r of data ?? []) {
    const crmSlug = String(r.crm_slug ?? '').trim().toLowerCase()
    const slug = String(r.slug ?? '').trim()
    if (!crmSlug && !slug) continue
    rows.push({
      slug: crmSlug || slug,
      crmSlug: crmSlug || slug,
      name: String(r.display_name ?? '').trim() || slug || crmSlug,
    })
  }
  return { rows, error: null }
}

export type JoinConvertRead = {
  sessions: number
  personIds: number[]
  error: string | null
}

export async function readJoinConverts(startIso: string, endIso: string): Promise<JoinConvertRead> {
  const sb = createServiceClient()
  const sessions = new Set<string>()
  const personIds = new Set<number>()
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await sb
      .from('visitor_events')
      .select('session_id, metadata, event_at')
      .eq('event_type', JOIN_CONVERT_EVENT)
      .gte('event_at', startIso)
      .lte('event_at', endIso)
      .order('event_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { sessions: 0, personIds: [], error: error.message }
    const page = (data ?? []) as Array<{
      session_id: string | null
      metadata: Record<string, unknown> | null
    }>
    for (const ev of page) {
      if (ev.metadata && (ev.metadata.fleetTest === true || ev.metadata.fleet_test === true)) continue
      sessions.add(String(ev.session_id ?? '').trim() || `anon:${sessions.size}`)
      const pid = Number(ev.metadata?.crm_person_id)
      if (Number.isFinite(pid) && pid > 0) personIds.add(pid)
    }
    if (page.length < PAGE) break
  }
  return { sessions: sessions.size, personIds: [...personIds], error: null }
}

export async function namesForIds(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (ids.length === 0) return map
  const sb = createServiceClient()
  for (let i = 0; i < ids.length; i += PERSON_CHUNK) {
    const chunk = ids.slice(i, i + PERSON_CHUNK)
    const { data, error } = await sb.from('crm_people').select('id, name').in('id', chunk)
    if (error) {
      console.error('[salesFunnelRead] names', error.message)
      continue
    }
    for (const r of (data ?? []) as Array<{ id: number; name: string | null }>) {
      map.set(Number(r.id), personName(r))
    }
  }
  return map
}


