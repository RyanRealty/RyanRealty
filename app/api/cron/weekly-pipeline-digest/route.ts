/**
 * Weekly pipeline-health digest for Matt only.
 *
 * Schedule: 0 15 * * 1  (Monday 15:00 UTC = 08:00 PT during DST).
 *
 * Aggregates the prior 7 days:
 *   1. Count new leads by audience (seller, buyer, unknown) — from crm_people.
 *   2. Count new leads by source (top 10) — from crm_people.
 *   3. Compare smart-list counts week-over-week — FUB (no crm_* equivalent).
 *   4. Pull totals: conversations + active deals + pipeline value from crm_*,
 *      appointments from FUB (no crm_* equivalent).
 *   5. Compose one key insight (e.g. expired-listing detection cadence).
 *
 * Phase 10.4 repoint: new leads, deals, pipeline value, and conversation volume
 * now read our own crm_* tables via getWeeklyPipelineDigest. FLAG: smart-list
 * movement and appointment count are still FUB-sourced because neither maps to a
 * crm_* table (smart lists are a FUB construct; appointments are not modeled in
 * crm_*). The email/delivery mechanism is unchanged.
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
import { getWeeklyPipelineDigest, summarizeWeeklyLeads } from '@/lib/data/crm/getBrokerDigest'
import { getFubApiKey } from '@/lib/crm/fub-env'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const FUB_BASE = 'https://api.followupboss.com/v1'

type FubAppointment = { id?: number; start?: string | null; status?: string | null }
type FubSmartList = { id?: number; name?: string; total?: number }

function fubHeaders(): HeadersInit {
  const apiKey = (getFubApiKey() || '').trim()
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
    void supabase
    const { getExpiredListingsForDigest } = await import('@/lib/data')
    const data = await getExpiredListingsForDigest({ sinceIso, limit: 100 })
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) {
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
    const total = rows.length
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

  // Pull data in parallel. Leads + deals + conversations come from our crm_*
  // tables (getWeeklyPipelineDigest). Smart lists + appointments stay on FUB
  // because neither maps to a crm_* table (FLAG in the header doc).
  const [crm, smartLists, appointments, keyInsight, prevSnapshot] = await Promise.all([
    getWeeklyPipelineDigest({ weekStartIso: sinceIso }),
    fetchSmartLists(),
    fetchAppointmentsThisWeek(sinceIso),
    buildKeyInsight(supabase, sinceIso),
    loadPreviousSmartListSnapshot(supabase),
  ])

  const leadSummary = summarizeWeeklyLeads(crm.newLeads)
  const deals = crm.activeDeals
  const conversations = crm.conversations

  const newLeadsByAudience: AudienceCount[] = leadSummary.byAudience
  const newLeadsBySource: SourceCount[] = leadSummary.bySource

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
