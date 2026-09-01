/**
 * /join funnel — visits from visitor_events, conversions written here.
 * Packet recruit-retain stops being UNKNOWN when the probe reads this DAL.
 * reachability: collectCompanyScoreboardSignals, /admin/today, contact form
 */
import { revalidateTag, unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

export const JOIN_CONVERT_EVENT = 'join_convert'
export const JOIN_PAGE_CATEGORY = 'join'
export const RECRUIT_JOIN_TAG = 'recruit:join'
export const JOIN_CONVERSION_SOURCE =
  'visitor_events via getJoinConversionStats (page_url path /join + event_type=join_convert)'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAGE = 1000

export type JoinConversionDay = {
  day: string
  visits: number
  conversions: number
}

export type JoinConversionStats = {
  status: 'ok' | 'unreadable'
  visits7d: number
  visitsAll: number
  conversions7d: number
  conversionsAll: number
  series: JoinConversionDay[]
  source: string
}

export type JoinConvertChannel = 'contact-form' | 'phone' | 'accept-probe'

type EventRow = {
  session_id: string | null
  event_type: string | null
  event_at: string | null
  page_url: string | null
  metadata: Record<string, unknown> | null
}

export function isJoinInquiry(inquiryType: string | null | undefined): boolean {
  const raw = String(inquiryType ?? '').trim()
  if (!raw) return false
  if (raw === 'Join the team') return true
  return /\b(join the team|join ryan|recruit|brokerage career)\b/i.test(raw)
}

export function isJoinPageUrl(pageUrl: string | null | undefined): boolean {
  const raw = String(pageUrl ?? '').trim()
  if (!raw) return false
  try {
    const path = new URL(raw, 'https://ryan-realty.com').pathname.replace(/\/+$/, '') || '/'
    return path === '/join'
  } catch {
    const path = raw.split(/[?#]/)[0]?.replace(/\/+$/, '') ?? ''
    return path === '/join' || path.endsWith('/join')
  }
}

function isFleetTest(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return metadata.fleetTest === true || metadata.fleet_test === true
}

function dayKey(iso: string | null, fallback: Date): string {
  const d = iso ? new Date(iso) : fallback
  if (Number.isNaN(d.getTime())) return fallback.toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export function summarizeJoinEvents(
  rows: EventRow[],
  now: Date = new Date(),
): Omit<JoinConversionStats, 'status' | 'source'> {
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const since28d = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const visitSessionsAll = new Set<string>()
  const visitSessions7d = new Set<string>()
  const convertSessionsAll = new Set<string>()
  const convertSessions7d = new Set<string>()
  const seriesMap = new Map<string, JoinConversionDay>()

  const bump = (day: string) => {
    const row = seriesMap.get(day) ?? { day, visits: 0, conversions: 0 }
    seriesMap.set(day, row)
    return row
  }

  for (const row of rows) {
    if (isFleetTest(row.metadata)) continue
    const at = row.event_at ? new Date(row.event_at) : now
    const in7d = at.getTime() >= since7d.getTime()
    const in28d = at.getTime() >= since28d.getTime()
    const session = String(row.session_id ?? '').trim() || `anon:${row.event_at ?? 'x'}`
    const convert = row.event_type === JOIN_CONVERT_EVENT
    const visit = !convert && isJoinPageUrl(row.page_url) && (row.event_type === 'page_view' || row.event_type === 'section_view')
    if (!convert && !visit) continue
    if (convert) {
      convertSessionsAll.add(session)
      if (in7d) convertSessions7d.add(session)
      if (in28d) bump(dayKey(row.event_at, now)).conversions += 1
    } else {
      visitSessionsAll.add(session)
      if (in7d) visitSessions7d.add(session)
      if (in28d) bump(dayKey(row.event_at, now)).visits += 1
    }
  }

  const series = [...seriesMap.values()].sort((a, b) => a.day.localeCompare(b.day))
  return {
    visits7d: visitSessions7d.size,
    visitsAll: visitSessionsAll.size,
    conversions7d: convertSessions7d.size,
    conversionsAll: convertSessionsAll.size,
    series,
  }
}

async function pageAll(
  build: (from: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: EventRow[]; error: string | null }> {
  const rows: EventRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from)
    if (error) return { rows: [], error: error.message }
    const batch = (data ?? []) as EventRow[]
    rows.push(...batch)
    if (batch.length < PAGE) return { rows, error: null }
  }
}

/**
 * The old single query OR'd a leading-wildcard ilike with an event_type match —
 * un-indexable, so every OFFSET page re-ran a full visitor_events scan (the
 * /admin/today ~15s class, 2026-09-01). Split into the two branches
 * summarizeJoinEvents actually reads — conversions (event_type=join_convert)
 * and visit-shaped rows (page_view/section_view on a /join URL; line 98 ignores
 * every other event_type, so the narrower SQL returns the identical input set —
 * the branches cannot overlap because their event_types differ). Each branch is
 * a small result, so the pagination loop exits on page one instead of
 * re-scanning history per page.
 */
async function fetchJoinFunnelRows(
  sb: SupabaseClient,
): Promise<{ rows: EventRow[]; error: string | null }> {
  const [converts, visits] = await Promise.all([
    pageAll((from) =>
      sb
        .from('visitor_events')
        .select('session_id,event_type,event_at,page_url,metadata')
        .eq('event_type', JOIN_CONVERT_EVENT)
        .order('event_at', { ascending: false })
        .range(from, from + PAGE - 1),
    ),
    pageAll((from) =>
      sb
        .from('visitor_events')
        .select('session_id,event_type,event_at,page_url,metadata')
        .ilike('page_url', '%/join%')
        .in('event_type', ['page_view', 'section_view'])
        .order('event_at', { ascending: false })
        .range(from, from + PAGE - 1),
    ),
  ])
  if (converts.error) return { rows: [], error: converts.error }
  if (visits.error) return { rows: [], error: visits.error }
  return { rows: [...converts.rows, ...visits.rows], error: null }
}

export async function readJoinConversionStats(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<JoinConversionStats> {
  const fetched = await fetchJoinFunnelRows(sb)
  if (fetched.error) {
    return {
      status: 'unreadable',
      visits7d: 0,
      visitsAll: 0,
      conversions7d: 0,
      conversionsAll: 0,
      series: [],
      source: `${JOIN_CONVERSION_SOURCE} (unreadable: ${fetched.error})`,
    }
  }
  return {
    status: 'ok',
    ...summarizeJoinEvents(fetched.rows, now),
    source: JOIN_CONVERSION_SOURCE,
  }
}

async function serviceClient(): Promise<SupabaseClient> {
  const { createServiceClient } = await import('@/lib/data/client')
  return createServiceClient()
}

/**
 * Dashboard-cadence cache (5 min, tag join-conversion): the stat rides the
 * /admin/today critical path, and a recorded conversion busts the tag so a
 * fresh one still shows immediately. An explicit `now` (tests, scoreboard
 * re-reads) bypasses the cache.
 */
const readJoinConversionStatsCached = unstable_cache(
  async (): Promise<JoinConversionStats> => readJoinConversionStats(await serviceClient()),
  ['join-conversion-stats-v1'],
  { revalidate: 300, tags: ['join-conversion'] },
)

export async function getJoinConversionStats(now?: Date): Promise<JoinConversionStats> {
  try {
    if (now) return await readJoinConversionStats(await serviceClient(), now)
    return await readJoinConversionStatsCached()
  } catch (err) {
    console.error('[getJoinConversionStats]', err)
    return {
      status: 'unreadable',
      visits7d: 0,
      visitsAll: 0,
      conversions7d: 0,
      conversionsAll: 0,
      series: [],
      source: `${JOIN_CONVERSION_SOURCE} (unreadable)`,
    }
  }
}

export async function recordJoinConversion(params: {
  sessionId?: string | null
  rrVid?: string | null
  personId?: number | null
  channel: JoinConvertChannel
  inquiryType?: string | null
  fleetTest?: boolean
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const sb = await serviceClient()
    let sessionId = params.sessionId && UUID_V4.test(params.sessionId) ? params.sessionId : null
    if (!sessionId && params.rrVid && UUID_V4.test(params.rrVid)) {
      const { data: sessions } = await sb
        .from('visitor_sessions')
        .select('session_id')
        .eq('rr_vid', params.rrVid)
        .order('last_seen_at', { ascending: false })
        .limit(1)
      sessionId = (sessions?.[0]?.session_id as string | undefined) ?? null
    }
    if (!sessionId) sessionId = crypto.randomUUID()

    const ensureSession = async () => {
      const { error: sessionErr } = await sb.from('visitor_sessions').insert({
        session_id: sessionId,
        source_domain: 'ryan-realty.com',
        landing_page: 'https://ryan-realty.com/join',
        rr_vid: params.rrVid && UUID_V4.test(params.rrVid) ? params.rrVid : null,
        crm_person_id: params.personId ?? null,
      })
      if (sessionErr && sessionErr.code !== '23505') return sessionErr.message
      return null
    }

    const eventRow = {
      session_id: sessionId,
      source_domain: 'ryan-realty.com',
      event_type: JOIN_CONVERT_EVENT,
      page_url: 'https://ryan-realty.com/join',
      page_category: JOIN_PAGE_CATEGORY,
      metadata: {
        channel: params.channel,
        inquiryType: params.inquiryType ?? 'Join the team',
        crm_person_id: params.personId ?? null,
        emitted_by: 'server_action',
        fleetTest: params.fleetTest === true,
      },
    }

    let { error } = await sb.from('visitor_events').insert(eventRow)
    if (error) {
      const sessionError = await ensureSession()
      if (sessionError) return { ok: false, error: sessionError }
      const retry = await sb.from('visitor_events').insert(eventRow)
      error = retry.error
    }
    if (error) return { ok: false, error: error.message }
    try {
      // Bust the dashboard cache so the conversion shows on the next read.
      revalidateTag('join-conversion', 'max')
    } catch {
      // Outside a request context (scripts/tests) revalidateTag throws; the
      // 5-minute revalidate window covers it.
    }
    return { ok: true, error: null }
  } catch (err) {
    console.error('[recordJoinConversion]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'record failed' }
  }
}

export async function tagRecruitJoin(personId: number): Promise<{ ok: boolean; error: string | null }> {
  try {
    const sb = await serviceClient()
    const { data, error: readErr } = await sb
      .from('crm_people')
      .select('tags')
      .eq('id', personId)
      .maybeSingle()
    if (readErr) return { ok: false, error: readErr.message }
    const tags = Array.isArray(data?.tags) ? (data.tags as string[]) : []
    if (tags.includes(RECRUIT_JOIN_TAG)) return { ok: true, error: null }
    const { error } = await sb
      .from('crm_people')
      .update({ tags: [...tags, RECRUIT_JOIN_TAG] })
      .eq('id', personId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, error: null }
  } catch (err) {
    console.error('[tagRecruitJoin]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'tag failed' }
  }
}
