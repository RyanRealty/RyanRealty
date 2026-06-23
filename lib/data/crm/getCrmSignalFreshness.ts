/**
 * getCrmSignalFreshness — when did each inbound channel last produce an event?
 * (CONTACT360 Phase 9.5, webhook-freshness read side.)
 *
 * The CRM only captures inbound texts / calls / emails if the Twilio + Resend
 * webhooks are actually firing into crm_timeline. When a webhook silently breaks
 * (a rotated token, a changed callback URL, a 404 relay), the timeline just stops
 * getting that kind of row — and nobody notices until a lead is missed. This
 * reader surfaces the LATEST timestamp per watched inbound kind so the health
 * board can age it and flag a cold channel red.
 *
 * Watched kinds map to the same crm_timeline `kind` enum the activity feed
 * classifies (lib/data/crm/getContactActivityFeed): sms_in, call/voicemail,
 * email_open/email_click. The reader returns the freshest ts across each group.
 *
 * Pure age math lives in lib/crm/health-levels (freshnessLevel / ageMinutesSince)
 * so the timestamp -> color decision is unit-tested separately. This reader does
 * ONLY the DB read.
 *
 * DAL boundary (G1): the raw .from() read of crm_timeline lives here. Fails SOFT
 * (latest=null) so a cold/unreadable signal renders as a stale tile, not a crash.
 */
import { createServiceClient } from '@/lib/supabase/service'

/** The inbound signal groups the board watches. */
export type CrmSignalKey = 'sms_in' | 'call' | 'email_engagement'

export type CrmSignalFreshness = {
  key: CrmSignalKey
  /** Human label for the tile. */
  label: string
  /** The crm_timeline kinds that count toward this signal. */
  kinds: ReadonlyArray<string>
  /** ISO timestamp of the most recent matching row, or null if never seen. */
  latest: string | null
}

/** Definition of each watched signal (kept here so the page never re-lists kinds). */
const SIGNALS: ReadonlyArray<{ key: CrmSignalKey; label: string; kinds: ReadonlyArray<string> }> = [
  { key: 'sms_in', label: 'Inbound texts', kinds: ['sms_in'] },
  { key: 'call', label: 'Inbound calls', kinds: ['call', 'voicemail'] },
  { key: 'email_engagement', label: 'Email engagement', kinds: ['email_open', 'email_click'] },
]

/** All kinds across all signals, flattened for one query. */
const ALL_KINDS = SIGNALS.flatMap((s) => s.kinds)

export async function getCrmSignalFreshness(): Promise<CrmSignalFreshness[]> {
  const sb = createServiceClient()
  // One scan of the recent inbound rows, newest first. Cap is generous enough to
  // include the freshest row of every watched kind even on a busy day, and avoids
  // a per-kind round trip.
  const { data, error } = await sb
    .from('crm_timeline')
    .select('kind,ts')
    .in('kind', ALL_KINDS)
    .order('ts', { ascending: false })
    .limit(500)

  const latestByKind = new Map<string, string>()
  if (!error && data) {
    for (const row of data) {
      const kind = String(row.kind ?? '')
      const ts = row.ts ? String(row.ts) : null
      // Rows arrive newest-first, so the first time we see a kind is its latest.
      if (ts && !latestByKind.has(kind)) latestByKind.set(kind, ts)
    }
  }

  return SIGNALS.map((s) => {
    let latest: string | null = null
    for (const kind of s.kinds) {
      const ts = latestByKind.get(kind)
      if (ts && (latest === null || ts > latest)) latest = ts
    }
    return { key: s.key, label: s.label, kinds: s.kinds, latest }
  })
}

export type CrmLeadVolume = {
  last24h: number
  last7d: number
  /** True when crm_people could not be read (board shows a degraded tile). */
  unreadable: boolean
}

/**
 * getCrmLeadVolume — new crm_people created in the trailing 24h / 7d.
 *
 * `created_at` is the native-row birth, independent of FUB, so this measures the
 * CRM's own intake rate. Excludes soft-deleted rows. Two count-only queries (no
 * row payload). `nowMs` is injectable so callers/tests pin the window.
 */
export async function getCrmLeadVolume(nowMs: number = Date.now()): Promise<CrmLeadVolume> {
  const sb = createServiceClient()
  const since24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [day, week] = await Promise.all([
    sb.from('crm_people').select('id', { count: 'exact', head: true }).eq('deleted', false).gte('created_at', since24h),
    sb.from('crm_people').select('id', { count: 'exact', head: true }).eq('deleted', false).gte('created_at', since7d),
  ])

  if (day.error || week.error) {
    return { last24h: 0, last7d: 0, unreadable: true }
  }
  return { last24h: day.count ?? 0, last7d: week.count ?? 0, unreadable: false }
}

/**
 * getCrmContactTotal — count of live (non-deleted) crm_people. Used as the
 * denominator for the suppression rate on the health board. Count-only query
 * (head: true, no payload). Returns 0 on an unreadable table.
 */
export async function getCrmContactTotal(): Promise<number> {
  const sb = createServiceClient()
  const { count, error } = await sb
    .from('crm_people')
    .select('id', { count: 'exact', head: true })
    .eq('deleted', false)
  if (error) return 0
  return count ?? 0
}
