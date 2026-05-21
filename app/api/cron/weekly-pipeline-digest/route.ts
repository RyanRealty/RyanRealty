/**
 * Weekly pipeline-health digest for Matt only.
 *
 * Schedule: 0 15 * * 1  (Monday 15:00 UTC = 08:00 PT during DST).
 *
 * Aggregates the prior 7 days of FUB activity:
 *   1. Count new leads by audience (seller, buyer, unknown).
 *   2. Count new leads by source (top 10).
 *   3. Compare smart-list counts week-over-week.
 *   4. Pull totals: conversations, appointments, active deals, pipeline value.
 *   5. Compose one key insight (e.g. expired-listing detection cadence).
 *
 * Brand voice §4.7. Sentence case, no em-dashes, no banned cliches.
 * Auth: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import {
  WeeklyPipelineDigestEmail,
  type AudienceCount,
  type SourceCount,
  type SmartListMovement,
} from '@/lib/digest-email-templates'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const FUB_BASE = 'https://api.followupboss.com/v1'

type FubPerson = {
  id?: number
  tags?: string[] | null
  source?: string | null
  created?: string | null
}

type FubAppointment = { id?: number; start?: string | null; status?: string | null }
type FubDeal = { id?: number; stage?: string | null; price?: number | null; status?: string | null }
type FubSmartList = { id?: number; name?: string; total?: number }

function fubHeaders(): HeadersInit {
  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY || '').trim()
  if (!apiKey) throw new Error('FOLLOWUPBOSS_API_KEY not set')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  }
  const system = (process.env.FOLLOWUPBOSS_SYSTEM || '').trim()
  const systemKey = (process.env.FOLLOWUPBOSS_SYSTEM_KEY || '').trim()
  if (system) headers['X-System'] = system
  if (systemKey) headers['X-System-Key'] = systemKey
  return headers
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function classifyAudience(tags: string[] | null | undefined): 'seller' | 'buyer' | 'unknown' {
  if (!Array.isArray(tags)) return 'unknown'
  const lower = tags.map((t) => t.toLowerCase())
  if (lower.includes('audience:seller')) return 'seller'
  if (lower.includes('audience:buyer')) return 'buyer'
  if (lower.includes('seller')) return 'seller'
  if (lower.includes('buyer')) return 'buyer'
  return 'unknown'
}

async function fetchPeopleCreatedSince(sinceIso: string): Promise<FubPerson[]> {
  const pageSize = 100
  const all: FubPerson[] = []
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const q = new URLSearchParams({
      createdAfter: sinceIso,
      sort: '-created',
      limit: String(pageSize),
      offset: String(offset),
      fields: 'id,tags,source,created',
    })
    const res = await fetch(`${FUB_BASE}/people?${q.toString()}`, {
      headers: fubHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) break
    const data = (await res.json().catch(() => null)) as { people?: FubPerson[] } | null
    const people = Array.isArray(data?.people) ? data!.people : []
    if (people.length === 0) break
    all.push(...people)
    if (people.length < pageSize) break
  }
  return all
}

async function fetchSmartLists(): Promise<FubSmartList[]> {
  try {
    const res = await fetch(`${FUB_BASE}/smartLists?limit=100`, {
      headers: fubHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json().catch(() => null)) as { smartlists?: FubSmartList[]; smartLists?: FubSmartList[] } | null
    return data?.smartlists ?? data?.smartLists ?? []
  } catch {
    return []
  }
}

async function fetchAppointmentsThisWeek(sinceIso: string): Promise<number> {
  try {
    const q = new URLSearchParams({ createdAfter: sinceIso, limit: '100' })
    const res = await fetch(`${FUB_BASE}/appointments?${q.toString()}`, {
      headers: fubHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return 0
    const data = (await res.json().catch(() => null)) as { appointments?: FubAppointment[]; _metadata?: { total?: number } } | null
    return data?._metadata?.total ?? (data?.appointments?.length ?? 0)
  } catch {
    return 0
  }
}

async function fetchActiveDeals(): Promise<{ count: number; value: number }> {
  try {
    const res = await fetch(`${FUB_BASE}/deals?limit=100`, {
      headers: fubHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return { count: 0, value: 0 }
    const data = (await res.json().catch(() => null)) as { deals?: FubDeal[] } | null
    const deals = data?.deals ?? []
    let count = 0
    let value = 0
    for (const d of deals) {
      const stage = (d.stage || '').toLowerCase()
      if (stage.includes('lost') || stage.includes('closed') || stage.includes('won')) continue
      count += 1
      const p = Number(d.price)
      if (Number.isFinite(p)) value += p
    }
    return { count, value }
  } catch {
    return { count: 0, value: 0 }
  }
}

async function fetchConversationsCount(sinceIso: string): Promise<number> {
  try {
    const q = new URLSearchParams({ createdAfter: sinceIso, limit: '1' })
    const [textsRes, emailsRes, callsRes] = await Promise.all([
      fetch(`${FUB_BASE}/textMessages?${q.toString()}`, { headers: fubHeaders(), cache: 'no-store' }).catch(() => null),
      fetch(`${FUB_BASE}/emails?${q.toString()}`, { headers: fubHeaders(), cache: 'no-store' }).catch(() => null),
      fetch(`${FUB_BASE}/calls?${q.toString()}`, { headers: fubHeaders(), cache: 'no-store' }).catch(() => null),
    ])
    let total = 0
    for (const res of [textsRes, emailsRes, callsRes]) {
      if (!res || !res.ok) continue
      const data = (await res.json().catch(() => null)) as { _metadata?: { total?: number } } | null
      total += data?._metadata?.total ?? 0
    }
    return total
  } catch {
    return 0
  }
}

type SmartListSnapshot = {
  date: string
  payload: Record<string, number>
}

async function loadPreviousSmartListSnapshot(supabase: ReturnType<typeof getServiceSupabase>): Promise<SmartListSnapshot | null> {
  if (!supabase) return null
  try {
    const cutoff = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('date, metadata')
      .eq('channel', 'fub')
      .eq('metric', 'smart_list_snapshot')
      .lte('date', cutoff)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    const md = (data as { date: string; metadata?: Record<string, unknown> }).metadata ?? {}
    const payload: Record<string, number> = {}
    for (const [k, v] of Object.entries(md)) {
      if (typeof v === 'number') payload[k] = v
    }
    return { date: data.date, payload }
  } catch {
    return null
  }
}

async function persistSmartListSnapshot(
  supabase: ReturnType<typeof getServiceSupabase>,
  asOfDate: string,
  lists: FubSmartList[],
): Promise<void> {
  if (!supabase) return
  const payload: Record<string, number> = {}
  for (const sl of lists) {
    if (sl.name && typeof sl.total === 'number') payload[sl.name] = sl.total
  }
  try {
    await supabase.from('marketing_channel_daily').upsert(
      {
        date: asOfDate,
        channel: 'fub',
        scope: 'channel',
        scope_id: 'smart_lists',
        metric: 'smart_list_snapshot',
        value: lists.length,
        metadata: payload,
        source: 'weekly-pipeline-digest',
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'date,channel,scope,scope_id,metric' },
    )
  } catch {
    // non-blocking
  }
}

async function buildKeyInsight(supabase: ReturnType<typeof getServiceSupabase>, sinceIso: string): Promise<string> {
  if (!supabase) return 'No insight available this week.'
  try {
    const { data, count } = await supabase
      .from('expired_listings')
      .select('listing_key, detected_at, alert_sent_at', { count: 'exact' })
      .gte('detected_at', sinceIso)
      .order('detected_at', { ascending: false })
      .limit(100)
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0 || (typeof count === 'number' && count === 0)) {
      return 'No expired listings detected this week.'
    }
    // Compute average hours from detected_at to alert_sent_at when present.
    const deltas: number[] = []
    for (const r of rows as Array<{ detected_at?: string; alert_sent_at?: string }>) {
      if (!r.detected_at || !r.alert_sent_at) continue
      const a = new Date(r.detected_at).getTime()
      const b = new Date(r.alert_sent_at).getTime()
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        deltas.push((b - a) / 3600000)
      }
    }
    const total = count ?? rows.length
    if (deltas.length === 0) {
      return `Expired-listing detection caught ${total} new this week.`
    }
    const avg = deltas.reduce((s, x) => s + x, 0) / deltas.length
    return `Expired-listing detection caught ${total} new this week. Average ${avg.toFixed(1)} hours from detection to alert.`
  } catch {
    return 'No insight available this week.'
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'

  const fromEnv = process.env.RESEND_FROM?.trim() || 'Matt Ryan <matt@ryan-realty.com>'
  const recipient = process.env.WEEKLY_DIGEST_EMAIL?.trim() || 'matt@ryan-realty.com'

  const now = new Date()
  const asOfDate = now.toISOString().slice(0, 10)
  // Monday-of-this-week label
  const day = now.getUTCDay() // 0=Sun, 1=Mon
  const daysBackToMon = day === 0 ? 6 : day - 1
  const monday = new Date(now.getTime() - daysBackToMon * 86400000)
  const weekOfDate = monday.toISOString().slice(0, 10)
  const sinceIso = new Date(now.getTime() - 7 * 86400000).toISOString()

  const supabase = getServiceSupabase()

  // Pull data in parallel
  const [people, smartLists, appointments, deals, conversations, keyInsight, prevSnapshot] = await Promise.all([
    fetchPeopleCreatedSince(sinceIso),
    fetchSmartLists(),
    fetchAppointmentsThisWeek(sinceIso),
    fetchActiveDeals(),
    fetchConversationsCount(sinceIso),
    buildKeyInsight(supabase, sinceIso),
    loadPreviousSmartListSnapshot(supabase),
  ])

  // Audience tally
  const audienceMap = new Map<string, number>()
  for (const p of people) {
    const a = classifyAudience(p.tags)
    audienceMap.set(a, (audienceMap.get(a) ?? 0) + 1)
  }
  const newLeadsByAudience: AudienceCount[] = [
    { label: 'Seller', count: audienceMap.get('seller') ?? 0 },
    { label: 'Buyer', count: audienceMap.get('buyer') ?? 0 },
    { label: 'Unclassified', count: audienceMap.get('unknown') ?? 0 },
  ].filter((r) => r.count > 0)

  // Source tally
  const sourceMap = new Map<string, number>()
  for (const p of people) {
    const s = (p.source || 'Unknown').trim() || 'Unknown'
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1)
  }
  const newLeadsBySource: SourceCount[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // Smart list movement
  const smartListMovement: SmartListMovement[] = smartLists
    .filter((sl) => sl.name && typeof sl.total === 'number')
    .map((sl) => {
      const prev = prevSnapshot?.payload[sl.name!] ?? sl.total!
      return {
        name: sl.name!,
        current: sl.total!,
        previous: prev,
        delta: sl.total! - prev,
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10)

  // Persist this week's snapshot for next week's comparison.
  if (!dryRun && smartLists.length > 0) {
    await persistSmartListSnapshot(supabase, asOfDate, smartLists)
  }

  const subject = `Ryan Realty pipeline, week of ${weekOfDate}`
  const payload = {
    weekOfDate,
    newLeadsByAudience,
    newLeadsBySource,
    smartListMovement,
    totals: {
      conversations,
      appointments,
      activeDeals: deals.count,
      pipelineValue: deals.value,
    },
    keyInsight,
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, subject, payload })
  }

  const sent = await sendEmail({
    to: recipient,
    from: fromEnv,
    subject,
    replyTo: 'matt@ryan-realty.com',
    react: WeeklyPipelineDigestEmail(payload),
  })

  return NextResponse.json({
    ok: !sent.error,
    subject,
    emailId: sent.id,
    error: sent.error,
    payload,
  })
}
