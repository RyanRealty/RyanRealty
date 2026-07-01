/**
 * INFERRED report — no dedicated FUB screen was observed for this view. Built
 * to the described "Call Logs" feature: a chronological, broker-scoped,
 * paginated list of individual inbound calls and voicemails with recording
 * playback and transcript links.
 *
 * The Calls report (/admin/crm/reporting/calls) surfaces per-broker aggregate
 * counts and links here for drill-down into individual call records.
 */

import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'

// Re-export the date preset type from the shared module
export type { DatePreset } from './getAgentActivityReport'

// ── Constants ──────────────────────────────────────────────────────────────────

export const CALL_LOGS_PAGE_SIZE = 50

/** Fallback display names when the brokers table doesn't resolve */
const BROKER_DISPLAY_FALLBACK: Record<string, string> = {
  matt: 'Matt Ryan',
  rebecca: 'Rebecca Peterson',
  paul: 'Paul Stevenson',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallLogParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
  /** 0-indexed page number for pagination */
  page?: number
}

/**
 * Derived outcome for a single call log entry.
 *
 * | Value       | Meaning                                                     |
 * |-------------|-------------------------------------------------------------|
 * | connected   | kind='call' + Twilio recording SID attached (answered)      |
 * | received    | kind='call' + no recording yet (too short, pre-recording CB)|
 * | voicemail   | kind='voicemail' (broker didn't answer within the dial TTL) |
 */
export type CallLogOutcome = 'connected' | 'received' | 'voicemail'

/**
 * One row in the Call Logs table.
 *
 * Metric → crm_* source mapping:
 *
 * | Field         | Source                                                         |
 * |---------------|----------------------------------------------------------------|
 * | ts            | crm_timeline.ts                                                |
 * | kind          | crm_timeline.kind  ('call' | 'voicemail')                      |
 * | broker        | crm_timeline.broker                                            |
 * | personName    | crm_people.name  (LEFT JOIN via person_id FK)                  |
 * | fromNumber    | crm_timeline.payload->>'fromNumber'  (Twilio voice webhook)   |
 * | direction     | always 'inbound' (V1 — outbound click-to-call not yet tracked)|
 * | durationSec   | crm_timeline.payload->>'recordingDurationSec' (recording CB)  |
 * | outcome       | Derived: voicemail → 'voicemail'; call+recordingSid → 'connected'; else 'received' |
 * | hasRecording  | payload.recordingSid present && durationSec > 0               |
 * | recordingPath | /api/admin/crm/recording/<payload.recordingSid>               |
 * | hasTranscript | crm_timeline.body IS NOT NULL (written by ElevenLabs STT CB) |
 */
export type CallLogEntry = {
  id: number
  /** ISO timestamp from crm_timeline.ts */
  ts: string
  kind: 'call' | 'voicemail'
  /** Broker slug (e.g. 'matt') from crm_timeline.broker */
  broker: string | null
  /** Broker display name resolved from the brokers table */
  brokerName: string | null
  personId: number
  /** Contact name from crm_people.name — null for unresolved callers */
  personName: string | null
  /**
   * Inbound caller phone number (payload.fromNumber).
   * Shown when personName is null to give context.
   */
  fromNumber: string | null
  /**
   * Call direction. Always 'inbound' in V1.
   * Outbound click-to-call is not yet tracked in crm_timeline.
   */
  direction: 'inbound'
  /** Recording duration in seconds (payload.recordingDurationSec). null = not recorded. */
  durationSec: number | null
  /** Derived outcome from crm_timeline.kind + payload fields */
  outcome: CallLogOutcome
  /** True when a Twilio recording has been attached to this timeline entry */
  hasRecording: boolean
  /**
   * Relative URL to stream the recording MP3 through the admin proxy.
   * null when no recording. Route: /api/admin/crm/recording/[recordingSid]
   */
  recordingPath: string | null
  /**
   * True when an ElevenLabs STT transcript is stored in crm_timeline.body.
   * The transcript body is not returned in the list — visit the contact
   * timeline (/admin/crm/:personId) to read it inline.
   */
  hasTranscript: boolean
}

export type CallLogResult = {
  entries: CallLogEntry[]
  /**
   * Total count of call+voicemail rows in the scoped period.
   * Comes from { count: 'exact' } on the paginated query — never rows.length.
   * Used for pagination controls (total pages = ceil(totalCount / pageSize)).
   */
  totalCount: number
  /**
   * Count of kind='call' rows in the period (answered + unanswered combined).
   * From a separate { count: 'exact', head: true } query.
   */
  callCount: number
  /**
   * Count of kind='voicemail' rows in the period.
   * From a separate { count: 'exact', head: true } query.
   */
  voicemailCount: number
  page: number
  pageSize: number
  dateStart: string
  dateEnd: string
}

// ── Core reader (uncached) ─────────────────────────────────────────────────────

async function readCallLogs(params: CallLogParams): Promise<CallLogResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)
  const page = Math.max(0, params.page ?? 0)
  const offset = page * CALL_LOGS_PAGE_SIZE

  // 1. Broker roster — CRM-active brokers with a crm_slug.
  //    Same pattern as getCallsReport. Gives us the allowed slug list and
  //    display names without repeating the broker map.
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getCallLogsReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
  }>

  // Scope: single broker or all known brokers.
  // Using .in() for both cases (in() with a single element works like .eq()).
  const brokerSlugs = params.brokerSlug
    ? [params.brokerSlug]
    : allBrokers.map((b) => b.crm_slug)

  // Build a slug → display name map for the transform step.
  const brokerDisplayMap: Record<string, string> = {}
  for (const b of allBrokers) {
    brokerDisplayMap[b.crm_slug] = b.display_name ?? BROKER_DISPLAY_FALLBACK[b.crm_slug] ?? b.crm_slug
  }

  if (brokerSlugs.length === 0) {
    return {
      entries: [],
      totalCount: 0,
      callCount: 0,
      voicemailCount: 0,
      page,
      pageSize: CALL_LOGS_PAGE_SIZE,
      dateStart: start,
      dateEnd: end,
    }
  }

  // 2. Three parallel queries.
  //
  //    (a) KPI count — calls (kind='call') in the period.
  //        { count: 'exact', head: true } returns the database COUNT(*) via
  //        the Content-Range header — never capped by the Supabase max_rows
  //        limit. NEVER use rows.length for a count.
  //
  //    (b) KPI count — voicemails (kind='voicemail') in the period.
  //        Same count strategy.
  //
  //    (c) Paginated list — call+voicemail rows, most-recent first.
  //        crm_people!inner embedded for person name (FK: crm_timeline.person_id
  //        → crm_people.id). count:'exact' gives the period total without a
  //        separate query; the range() call provides the page slice.
  //        Paginated with .range(offset, offset+PAGE_SIZE-1) — never SELECT *
  //        all rows and slice in memory.
  //
  const [callCountRes, vmCountRes, listRes] = await Promise.all([
    // a — call count (exact, no row data)
    sb.from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'call')
      .in('broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end),

    // b — voicemail count (exact, no row data)
    sb.from('crm_timeline')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'voicemail')
      .in('broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end),

    // c — paginated list with person join and total count
    sb.from('crm_timeline')
      .select('id, ts, kind, broker, person_id, payload, body, crm_people!inner(name)', { count: 'exact' })
      .in('kind', ['call', 'voicemail'])
      .in('broker', brokerSlugs)
      .gte('ts', start)
      .lte('ts', end)
      .order('ts', { ascending: false })
      .range(offset, offset + CALL_LOGS_PAGE_SIZE - 1),
  ])

  if (listRes.error) console.error('[getCallLogsReport] list error', listRes.error.message)

  // 3. Type the raw list rows (PostgREST may return embedded rows as object or
  //    array; handle both via the Array.isArray guard used throughout the DAL).
  type RawRow = {
    id: number
    ts: string
    kind: string
    broker: string | null
    person_id: number
    payload: Record<string, unknown> | null
    body: string | null
    crm_people:
      | { name: string | null }
      | Array<{ name: string | null }>
      | null
  }

  const rawRows = (listRes.data ?? []) as unknown as RawRow[]

  // 4. Transform into CallLogEntry[]
  const entries: CallLogEntry[] = rawRows.map((r) => {
    const payload = r.payload ?? {}

    // Recording fields come from the /api/twilio/recording callback that patches
    // the timeline row after Twilio delivers the recording-completed webhook.
    const recordingSid = (payload.recordingSid as string | undefined) ?? null
    const durationRaw = payload.recordingDurationSec
    const durationSec =
      typeof durationRaw === 'number' && durationRaw > 0 ? durationRaw : null

    // Outcome derivation:
    //   'voicemail'  — kind='voicemail' (broker didn't answer within the 25 s dial timeout)
    //   'connected'  — kind='call' + recordingSid present + duration > 0
    //                  (answered, recorded; recording CB has fired)
    //   'received'   — kind='call' + no recording yet
    //                  (could be unanswered-but-no-voicemail, too short to record,
    //                  or recording CB not yet fired — honest 'received' is safest)
    let outcome: CallLogOutcome
    if (r.kind === 'voicemail') {
      outcome = 'voicemail'
    } else if (recordingSid && durationSec !== null) {
      outcome = 'connected'
    } else {
      outcome = 'received'
    }

    const hasRecording = !!recordingSid && durationSec !== null
    const recordingPath = hasRecording ? `/api/admin/crm/recording/${recordingSid}` : null

    // Embedded person (LEFT/INNER JOIN — handle object or array shape from PostgREST).
    const personEmbed = Array.isArray(r.crm_people) ? r.crm_people[0] : r.crm_people
    const personName = personEmbed?.name ?? null

    return {
      id: r.id,
      ts: r.ts,
      kind: r.kind as 'call' | 'voicemail',
      broker: r.broker,
      brokerName: r.broker
        ? (brokerDisplayMap[r.broker] ?? BROKER_DISPLAY_FALLBACK[r.broker] ?? r.broker)
        : null,
      personId: r.person_id,
      personName,
      fromNumber: (payload.fromNumber as string | undefined) ?? null,
      direction: 'inbound',
      durationSec,
      outcome,
      hasRecording,
      recordingPath,
      hasTranscript: !!(r.body && r.body.trim().length > 0),
    }
  })

  return {
    entries,
    // listRes.count is the database COUNT(*) for the full query (not just this page).
    // This is what the pagination controls need.
    totalCount: listRes.count ?? 0,
    callCount: callCountRes.count ?? 0,
    voicemailCount: vmCountRes.count ?? 0,
    page,
    pageSize: CALL_LOGS_PAGE_SIZE,
    dateStart: start,
    dateEnd: end,
  }
}

// ── Cached public API ──────────────────────────────────────────────────────────

/**
 * Call Logs report — broker-scoped, date-filtered, paginated list of individual
 * call and voicemail events from crm_timeline.
 *
 * Cached 10 minutes (matching the reporting cache TTL used across all CRM
 * reporting DAL functions). Cache is keyed on all filter + pagination params
 * so different combinations get separate cache entries.
 *
 * Source tables:
 *   - crm_timeline  kind IN ('call','voicemail')  — the primary log source
 *   - crm_people                                  — joined for person name
 *   - brokers                                     — for broker display names + active roster
 *
 * Count strategy:
 *   ALL counts use { count: 'exact' } or { count: 'exact', head: true } so the
 *   database COUNT(*) is used. rows.length is NEVER used for a count — the
 *   Supabase default max_rows (1000) would silently truncate high-volume periods.
 *
 * V1 honest gaps:
 *   - direction = 'inbound' always (outbound click-to-call not yet tracked in crm_timeline)
 *   - outcome = 'received' for calls without a Twilio recording SID: could be
 *     genuinely unanswered or recording CB not yet fired (sub-2 s calls not recorded)
 */
export async function getCallLogsReport(params: CallLogParams): Promise<CallLogResult> {
  const cached = unstable_cache(
    () => readCallLogs(params),
    [
      'crm-call-logs-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
      String(params.page ?? 0),
    ],
    { tags: ['crm-call-logs', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
